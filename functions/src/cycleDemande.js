import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { AdresseImprecise, GEOCODING_API_KEY, villeDepuisAdresse, villeDepuisPlaceId } from "./geocoding.js";
import { RESEND_API_KEY } from "./courriels.js";
import { STRIPE_SECRET_KEY, avertirCarteRefusee, paiementReel, prelever, verser } from "./paiements.js";

// Cycle de vie d'une demande, entièrement côté serveur (les Firestore rules
// refusent toute écriture client sur demandes/) :
//
//   ouverte ──accepter──> matchee ──marquerFaite──> faite ──confirmer──> completee
//    │  ▲                    │                        │   (ou automatique après 12 h)
//    │  └─relancer─ paiement_refuse (carte refusée à l'acceptation)
//    └─annuler─> annulee     └──────signaler──────────┴──> signalee
//
// Pas d'annulation une fois la demande acceptée, ni par le client ni par le
// déneigeur (décision produit : pas de porte de sortie pour laisser une job
// en plan au profit d'une plus payante). Après l'acceptation, le seul recours
// est « Signaler un problème ».
//
// Paiement (functions/src/paiements.js) : réel par Stripe Connect quand
// PAIEMENT_REEL est vrai, sinon SIMULÉ : mêmes montants (config/frais), mais
// aucun argent ne circule et statutPaiement porte le préfixe « simule_ » pour
// qu'aucune donnée de test ne soit confondue avec un vrai paiement.
// statutPaiement réel : retenu (prélevé à l'acceptation) > a_verser (job
// confirmée) > verse (virement fait au déneigeur) ; bloque si signalée.

const REGION = "northamerica-northeast1";
export const DELAI_CONFIRMATION_MS = 12 * 60 * 60 * 1000;
const FRAIS_PAR_DEFAUT = { fraisFixe: 2, fraisPct: 8 }; // mêmes valeurs que src/lib/config.js
// « toiture » n'est plus proposé (décision produit) : les anciennes demandes
// gardent leur type, mais on n'en publie plus. « autre » exige une description.
const TYPES_SERVICE = new Set(["entree", "entree_balcon", "stationnement", "autre"]);
const MOTIFS_SIGNALEMENT = new Set(["absent", "incomplet", "acces", "autre"]);
const MONTANT_MIN = 10;
const MONTANT_MAX = 1000;
// Précision du geohash public (lisible par tout utilisateur connecté) :
// 7 caractères, environ 150 m, assez pour « À 400 m » sans révéler l'adresse.
// L'adresse exacte reste dans demandes/{id}/prive/adresse.
const PRECISION_GEOHASH_PUBLIC = 7;

// Photos « c'est fait » : OBLIGATOIRES, de 1 à PHOTOS_MAX, prises par le
// déneigeur sur place avant de partir (preuve pour le client et en cas de
// litige). Réencodées en JPEG par l'app (sans métadonnées EXIF, donc sans
// position GPS), une par document dans demandes/{id}/prive/photo-0, photo-1…
// (lisibles par le client et le déneigeur seulement), effacées
// PHOTO_CONSERVATION_MS plus tard par purgerPhotos. Taille limitée pour rester
// loin de la limite de 1 Mio d'un document Firestore.
export const PHOTO_CONSERVATION_MS = 30 * 24 * 60 * 60 * 1000;
export const PHOTO_MAX_CARACTERES = 700_000;
export const PHOTOS_MAX = 3;
// Anciennes jobs (photo unique facultative) : document « photo ».
const DOCS_PHOTOS = ["photo", ...Array.from({ length: PHOTOS_MAX }, (_, i) => `photo-${i}`)];
const PREFIXE_PHOTO = "data:image/jpeg;base64,";

// Évaluation du déneigeur par le client : 1 à 5 étoiles, mot facultatif lu
// par le déneigeur seulement (demandes/{id}/prive/evaluation). Possible en
// confirmant, ou ensuite pendant EVALUATION_DELAI_MS (utile quand la job a été
// confirmée automatiquement).
export const EVALUATION_DELAI_MS = 7 * 24 * 60 * 60 * 1000;
const COMMENTAIRE_MAX = 500;


function exigerConnexion(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  return request.auth.uid;
}

function prenom(nom) {
  return (nom || "").trim().split(/\s+/)[0] || "Voisin";
}

function arrondir(montant) {
  return Math.round(montant * 100) / 100;
}

export function calculerPaiement(montant, { fraisFixe, fraisPct }) {
  const fraisSnowro = arrondir(fraisFixe + (montant * fraisPct) / 100);
  return { montantTotal: montant, fraisSnowro, montantDeneigeur: arrondir(montant - fraisSnowro) };
}

async function lireFrais() {
  const snap = await db.doc("config/frais").get();
  return snap.exists ? { ...FRAIS_PAR_DEFAUT, ...snap.data() } : FRAIS_PAR_DEFAUT;
}

function validerMontant(montant) {
  if (typeof montant !== "number" || !Number.isFinite(montant) || montant < MONTANT_MIN || montant > MONTANT_MAX) {
    throw new HttpsError("invalid-argument", `Montant entre ${MONTANT_MIN} $ et ${MONTANT_MAX} $.`);
  }
  return arrondir(montant);
}

function texte(valeur, { max, requis = false, nom }) {
  if (valeur == null || valeur === "") {
    if (requis) throw new HttpsError("invalid-argument", `${nom} requis.`);
    return "";
  }
  if (typeof valeur !== "string" || valeur.length > max) {
    throw new HttpsError("invalid-argument", `${nom} invalide (${max} caractères max).`);
  }
  return valeur.trim();
}

// Lit la demande dans une transaction et vérifie le rôle de l'appelant et le
// statut attendu. Renvoie { ref, demande }.
async function lireDemande(tx, demandeId, { uid, role, statuts }) {
  if (typeof demandeId !== "string" || !demandeId) {
    throw new HttpsError("invalid-argument", "demandeId requis.");
  }
  const ref = db.doc(`demandes/${demandeId}`);
  const snap = await tx.get(ref);
  if (!snap.exists) throw new HttpsError("not-found", "Demande introuvable.");
  const demande = snap.data();
  const champ = role === "client" ? "donneurOuvrageId" : "deneigeurId";
  if (demande[champ] !== uid) throw new HttpsError("permission-denied", "Cette demande n'est pas la tienne.");
  if (!statuts.includes(demande.statut)) {
    throw new HttpsError("failed-precondition", `Action impossible au statut « ${demande.statut} ».`);
  }
  return { ref, demande };
}

// ---- Publier ----
// L'adresse est géocodée ici (jamais la position du téléphone, qui peut être
// au travail) : ville/villeGeoId en découlent, comme partout ailleurs.
// De préférence `placeId` (adresse choisie dans les suggestions), sinon
// `adresse` en texte. Dans les deux cas, seule une adresse civique précise est
// acceptée, et c'est l'adresse reconnue par Google qui est enregistrée.
// `unite` : appartement ou logement (fréquent dans les plex), ajouté tel quel.
export const publierDemande = onCall({ region: REGION, secrets: [GEOCODING_API_KEY] }, async (request) => {
  const uid = exigerConnexion(request);
  const d = request.data ?? {};
  const placeId = typeof d.placeId === "string" && d.placeId ? d.placeId.slice(0, 300) : null;
  const adresseSaisie = placeId ? "" : texte(d.adresse, { max: 200, requis: true, nom: "Adresse" });
  const unite = texte(d.unite, { max: 20, nom: "Appartement" });
  const titre = texte(d.titre, { max: 80, requis: true, nom: "Titre" });
  const description = texte(d.description, { max: 600, nom: "Description" });
  if (!TYPES_SERVICE.has(d.typeService)) throw new HttpsError("invalid-argument", "Type de service invalide.");
  if (d.typeService === "autre" && !description) {
    throw new HttpsError("invalid-argument", "Décris ce qu'il y a à déneiger.");
  }
  const montant = validerMontant(d.montant);
  const echeance = new Date(d.dateHeureSouhaitee);
  if (Number.isNaN(echeance.getTime()) || echeance.getTime() < Date.now() + 30 * 60 * 1000) {
    throw new HttpsError("invalid-argument", "L'heure souhaitée doit être au moins 30 minutes plus tard.");
  }

  let lieu;
  try {
    lieu = placeId
      ? await villeDepuisPlaceId(placeId)
      : await villeDepuisAdresse(adresseSaisie, { exigerPrecision: true });
  } catch (err) {
    if (err instanceof AdresseImprecise) throw new HttpsError("invalid-argument", err.message);
    throw new HttpsError("failed-precondition", `Adresse introuvable : ${err.message}`);
  }
  const adresseReconnue = lieu.adresseNormalisee.replace(/, Canada$/, "");
  const adresse = unite ? `${adresseReconnue} (app. ${unite})` : adresseReconnue;

  const profil = (await db.doc(`users/${uid}`).get()).data() ?? {};
  // Rien n'est prélevé à la publication, mais il faut une carte pour que
  // l'acceptation puisse prélever.
  if (paiementReel() && !profil.carte?.paymentMethodId) throw new HttpsError("failed-precondition", "carte-requise");
  const ref = db.collection("demandes").doc();
  const batch = db.batch();
  batch.set(ref, {
    donneurOuvrageId: uid,
    donneurPrenom: prenom(profil.displayName),
    statut: "ouverte",
    adresseGeohash: lieu.geohash.slice(0, PRECISION_GEOHASH_PUBLIC),
    postalCodePrefix: lieu.postalCodePrefix,
    quartier: lieu.quartier ?? null,
    ville: lieu.ville,
    villeGeoId: lieu.villeGeoId,
    titre,
    description,
    typeService: d.typeService,
    outilsFournis: d.outilsFournis === true,
    dateHeureSouhaitee: Timestamp.fromDate(echeance),
    remunerationOfferte: montant,
    createdAt: FieldValue.serverTimestamp(),
    deneigeurId: null,
    deneigeurPrenom: null,
    deneigeurNote: null,
    matchedAt: null,
    faiteAt: null,
    confirmationAutoAt: null,
    confirmeeAt: null,
    confirmationAuto: null,
    signalement: null,
    paiement: null,
  });
  // Adresse exacte : lisible seulement par le client et, après acceptation,
  // par le déneigeur choisi (firestore.rules).
  batch.set(db.doc(`demandes/${ref.id}/prive/adresse`), {
    adresse,
    adresseNormalisee: adresseReconnue,
    unite,
    placeId: lieu.placeId ?? null,
    saisie: placeId ? "suggestion" : "texte",
    geohash: lieu.geohash,
  });
  // Publier une demande fait de toi un client, si ce n'était pas déjà le cas.
  batch.set(db.doc(`users/${uid}`), { role: FieldValue.arrayUnion("donneur_ouvrage") }, { merge: true });
  await batch.commit();

  return { demandeId: ref.id, ville: lieu.ville, adresse };
});

// ---- Accepter ----
// Premier arrivé, premier servi (transaction). Le filtre de ville est une
// exclusion dure : un déneigeur ne peut jamais accepter hors de sa ville de
// service, même si la demande est à 500 m de l'autre côté du pont.
export const accepterDemande = onCall({ region: REGION, secrets: [STRIPE_SECRET_KEY, RESEND_API_KEY] }, async (request) => {
  const uid = exigerConnexion(request);
  const { demandeId } = request.data ?? {};
  if (typeof demandeId !== "string" || !demandeId) throw new HttpsError("invalid-argument", "demandeId requis.");
  const frais = await lireFrais();
  const reel = paiementReel();

  const demande = await db.runTransaction(async (tx) => {
    const ref = db.doc(`demandes/${demandeId}`);
    const userRef = db.doc(`users/${uid}`);
    const [snap, userSnap] = await Promise.all([tx.get(ref), tx.get(userRef)]);
    if (!snap.exists) throw new HttpsError("not-found", "Demande introuvable.");
    const demande = snap.data();
    const profil = userSnap.data() ?? {};

    if (demande.statut !== "ouverte") throw new HttpsError("already-exists", "deja-prise");
    if (demande.donneurOuvrageId === uid) throw new HttpsError("permission-denied", "C'est ta propre demande.");
    if (!(profil.role ?? []).includes("deneigeur_x")) {
      throw new HttpsError("permission-denied", "Active le mode déneigeur dans tes paramètres.");
    }
    if (!profil.villeGeoId || profil.villeGeoId !== demande.villeGeoId) {
      throw new HttpsError("permission-denied", "Cette demande est hors de ta ville de service.");
    }
    if (reel && profil.connectStatus !== "actif") {
      throw new HttpsError("failed-precondition", "Configure ton compte de paiement avant d'accepter des jobs.");
    }

    tx.update(ref, {
      statut: "matchee",
      deneigeurId: uid,
      deneigeurPrenom: prenom(profil.displayName),
      deneigeurNote: { moyenne: profil.ratingAvg ?? 0, nombre: profil.nbJobsCompletees ?? 0 },
      matchedAt: FieldValue.serverTimestamp(),
      paiementRefuse: null,
      paiement: {
        ...calculerPaiement(demande.remunerationOfferte, frais),
        statutPaiement: reel ? "prelevement_en_cours" : "simule_retenu",
        stripePaymentIntentId: null,
        stripeChargeId: null,
        stripeTransferId: null,
      },
    });
    return demande;
  });
  if (!reel) return { ok: true };

  // Prélèvement hors transaction (une transaction peut être rejouée ; un
  // prélèvement ne doit pas l'être). La demande est déjà réservée à ce
  // déneigeur : personne d'autre ne peut la prendre pendant ce temps.
  const ref = db.doc(`demandes/${demandeId}`);
  const resultat = await prelever(demandeId, demande);
  if (resultat.ok) {
    await ref.update({
      "paiement.statutPaiement": "retenu",
      "paiement.stripePaymentIntentId": resultat.paymentIntentId,
      "paiement.stripeChargeId": resultat.chargeId,
    });
    return { ok: true };
  }
  await ref.update({
    statut: "paiement_refuse",
    deneigeurId: null,
    deneigeurPrenom: null,
    deneigeurNote: null,
    matchedAt: null,
    paiement: null,
    paiementRefuse: { at: FieldValue.serverTimestamp(), raison: resultat.raison },
  });
  await avertirCarteRefusee(demande);
  throw new HttpsError("failed-precondition", "carte-refusee");
});

// ---- Relancer après une carte refusée (client, une fois la carte à jour) ----
export const relancerDemande = onCall({ region: REGION }, async (request) => {
  const uid = exigerConnexion(request);
  const profil = (await db.doc(`users/${uid}`).get()).data() ?? {};
  if (paiementReel() && !profil.carte?.paymentMethodId) throw new HttpsError("failed-precondition", "carte-requise");
  return db.runTransaction(async (tx) => {
    const { ref, demande } = await lireDemande(tx, request.data?.demandeId, { uid, role: "client", statuts: ["paiement_refuse"] });
    // Il faut une carte enregistrée APRÈS le refus : réessayer la même carte
    // donnerait le même refus (Stripe rejoue la réponse d'une même clé
    // d'idempotence, voir prelever).
    if (paiementReel() && (profil.carteMiseAJourAt?.toMillis() ?? 0) <= (demande.paiementRefuse?.at?.toMillis() ?? 0)) {
      throw new HttpsError("failed-precondition", "carte-requise");
    }
    tx.update(ref, { statut: "ouverte", paiementRefuse: null });
    return { ok: true };
  });
});

export function validerPhotos(photos) {
  if (!Array.isArray(photos) || photos.length === 0) {
    throw new HttpsError("invalid-argument", "photos-requises");
  }
  if (photos.length > PHOTOS_MAX) throw new HttpsError("invalid-argument", `${PHOTOS_MAX} photos au plus.`);
  return photos.map(validerPhoto);
}

function validerPhoto(photo) {
  if (typeof photo !== "string" || !photo.startsWith(PREFIXE_PHOTO)) {
    throw new HttpsError("invalid-argument", "Photo invalide (JPEG attendu).");
  }
  if (photo.length > PHOTO_MAX_CARACTERES) throw new HttpsError("invalid-argument", "Photo trop lourde.");
  const donnees = photo.slice(PREFIXE_PHOTO.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(donnees)) throw new HttpsError("invalid-argument", "Photo invalide.");
  const octets = Buffer.from(donnees.slice(0, 8), "base64");
  if (octets[0] !== 0xff || octets[1] !== 0xd8) throw new HttpsError("invalid-argument", "Photo invalide (JPEG attendu).");
  return photo;
}

// ---- Marquer faite (déneigeur), avec 1 à 3 photos obligatoires ----
export const marquerFaite = onCall({ region: REGION }, async (request) => {
  const uid = exigerConnexion(request);
  const photos = validerPhotos(request.data?.photos);
  return db.runTransaction(async (tx) => {
    const { ref } = await lireDemande(tx, request.data?.demandeId, { uid, role: "deneigeur", statuts: ["matchee"] });
    const expireAt = Timestamp.fromMillis(Date.now() + PHOTO_CONSERVATION_MS);
    tx.update(ref, {
      statut: "faite",
      faiteAt: FieldValue.serverTimestamp(),
      confirmationAutoAt: Timestamp.fromMillis(Date.now() + DELAI_CONFIRMATION_MS),
      photo: true,
      nbPhotos: photos.length,
      photoExpireAt: expireAt,
    });
    photos.forEach((donnees, i) => {
      tx.set(db.doc(`${ref.path}/prive/photo-${i}`), { donnees, ajouteeAt: FieldValue.serverTimestamp(), expireAt });
    });
    return { ok: true };
  });
});

function validerEvaluation(data) {
  const { note } = data ?? {};
  if (!Number.isInteger(note) || note < 1 || note > 5) {
    throw new HttpsError("invalid-argument", "Note de 1 à 5 étoiles.");
  }
  return { note, commentaire: texte(data.commentaire, { max: COMMENTAIRE_MAX, nom: "Commentaire" }) };
}

// À appeler après toutes les lectures de la transaction (`profil` = fiche du
// déneigeur déjà lue) : moyenne recalculée côté serveur seulement
// (ratingAvg/ratingCount sont protégés dans firestore.rules).
function evaluer(tx, ref, demande, profil, { note, commentaire }) {
  const nombre = profil.ratingCount ?? 0;
  const moyenne = profil.ratingAvg ?? 0;
  tx.set(
    db.doc(`users/${demande.deneigeurId}`),
    { ratingAvg: Math.round(((moyenne * nombre + note) / (nombre + 1)) * 100) / 100, ratingCount: nombre + 1 },
    { merge: true },
  );
  tx.set(db.doc(`${ref.path}/prive/evaluation`), { note, commentaire, at: FieldValue.serverTimestamp() });
  tx.update(ref, { evaluee: true });
}

// Le virement réel se fait après la transaction (verser).
function confirmer(tx, ref, demande, { automatique }) {
  tx.update(ref, {
    statut: "completee",
    confirmeeAt: FieldValue.serverTimestamp(),
    confirmationAuto: automatique,
    "paiement.statutPaiement": demande.paiement?.statutPaiement === "retenu" ? "a_verser" : "simule_verse",
  });
  tx.set(db.doc(`users/${demande.deneigeurId}`), { nbJobsCompletees: FieldValue.increment(1) }, { merge: true });
}

// ---- Confirmer (client), avec évaluation facultative ----
export const confirmerJob = onCall({ region: REGION, secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const uid = exigerConnexion(request);
  const evaluation = request.data?.note == null ? null : validerEvaluation(request.data);
  await db.runTransaction(async (tx) => {
    const { ref, demande } = await lireDemande(tx, request.data?.demandeId, { uid, role: "client", statuts: ["faite"] });
    const profil = evaluation ? ((await tx.get(db.doc(`users/${demande.deneigeurId}`))).data() ?? {}) : null;
    confirmer(tx, ref, demande, { automatique: false });
    if (evaluation) evaluer(tx, ref, demande, profil, evaluation);
  });
  await verser(request.data.demandeId);
  return { ok: true };
});

// ---- Évaluer après coup (client), une seule fois, dans les 7 jours ----
export const evaluerJob = onCall({ region: REGION }, async (request) => {
  const uid = exigerConnexion(request);
  const evaluation = validerEvaluation(request.data);
  return db.runTransaction(async (tx) => {
    const { ref, demande } = await lireDemande(tx, request.data?.demandeId, { uid, role: "client", statuts: ["completee"] });
    if (demande.evaluee) throw new HttpsError("already-exists", "Tu as déjà évalué cette job.");
    if (Date.now() - (demande.confirmeeAt?.toMillis() ?? 0) > EVALUATION_DELAI_MS) {
      throw new HttpsError("failed-precondition", "Le délai pour évaluer cette job est passé.");
    }
    const profil = (await tx.get(db.doc(`users/${demande.deneigeurId}`))).data() ?? {};
    evaluer(tx, ref, demande, profil, evaluation);
    return { ok: true };
  });
});

// ---- Confirmation automatique 12 h après « faite » ----
// Réessaie aussi les virements restés « a_verser » (erreur Stripe passagère).
export const confirmerJobsEchues = onSchedule(
  { schedule: "every 15 minutes", timeZone: "America/Toronto", region: REGION, secrets: [STRIPE_SECRET_KEY] },
  async () => {
    const echues = await db
      .collection("demandes")
      .where("statut", "==", "faite")
      .where("confirmationAutoAt", "<=", Timestamp.now())
      .limit(200)
      .get();
    let n = 0;
    for (const doc of echues.docs) {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(doc.ref);
        const demande = snap.data();
        // Revérifié dans la transaction : le client a pu confirmer ou signaler entre-temps.
        if (demande?.statut !== "faite" || demande.confirmationAutoAt.toMillis() > Date.now()) return;
        confirmer(tx, doc.ref, demande, { automatique: true });
        n += 1;
      });
    }
    if (n) logger.info(`${n} job(s) confirmée(s) automatiquement.`);
    const aVerser = await db.collection("demandes").where("paiement.statutPaiement", "==", "a_verser").limit(100).get();
    for (const doc of aVerser.docs) await verser(doc.id);
  },
);

// ---- Effacement des photos après 30 jours ----
// Les photos d'une job signalée sont gardées tant que le signalement n'est
// pas réglé (preuve) : elle sera effacée au passage suivant une fois la job
// sortie de « signalee ».
export const purgerPhotos = onSchedule(
  { schedule: "every day 03:17", timeZone: "America/Toronto", region: REGION },
  async () => {
    const expirees = await db.collection("demandes").where("photoExpireAt", "<=", Timestamp.now()).limit(300).get();
    let n = 0;
    for (const doc of expirees.docs) {
      if (doc.data().statut === "signalee") continue;
      const batch = db.batch();
      for (const nom of DOCS_PHOTOS) batch.delete(db.doc(`${doc.ref.path}/prive/${nom}`));
      batch.update(doc.ref, { photo: false, nbPhotos: 0, photoExpireAt: null });
      await batch.commit();
      n += 1;
    }
    if (n) logger.info(`${n} photo(s) effacée(s) après 30 jours.`);
  },
);

// ---- Signaler un problème (client ou déneigeur) ----
export const signalerProbleme = onCall({ region: REGION }, async (request) => {
  const uid = exigerConnexion(request);
  const { demandeId, motif } = request.data ?? {};
  if (!MOTIFS_SIGNALEMENT.has(motif)) throw new HttpsError("invalid-argument", "Motif invalide.");
  const details = texte(request.data?.details, { max: 1000, nom: "Détails" });

  return db.runTransaction(async (tx) => {
    const ref = db.doc(`demandes/${demandeId}`);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Demande introuvable.");
    const demande = snap.data();
    const par = demande.donneurOuvrageId === uid ? "client" : demande.deneigeurId === uid ? "deneigeur" : null;
    if (!par) throw new HttpsError("permission-denied", "Cette demande n'est pas la tienne.");
    if (!["matchee", "faite"].includes(demande.statut)) {
      throw new HttpsError("failed-precondition", `Action impossible au statut « ${demande.statut} ».`);
    }
    tx.update(ref, {
      statut: "signalee",
      signalement: { par, motif, details, statutPrecedent: demande.statut, at: FieldValue.serverTimestamp() },
      // Plus de versement automatique : Snowro tranche à la main (remboursement
      // si le déneigeur ne s'est pas présenté, voir la FAQ).
      "paiement.statutPaiement": demande.paiement?.statutPaiement === "retenu" ? "bloque" : "simule_bloque",
      confirmationAutoAt: null,
    });
    return { ok: true };
  });
});

// ---- Annuler (client, seulement tant que personne n'a accepté) ----
export const annulerDemande = onCall({ region: REGION }, async (request) => {
  const uid = exigerConnexion(request);
  return db.runTransaction(async (tx) => {
    const { ref } = await lireDemande(tx, request.data?.demandeId, { uid, role: "client", statuts: ["ouverte"] });
    tx.update(ref, { statut: "annulee", annuleeAt: FieldValue.serverTimestamp() });
    return { ok: true };
  });
});

// ---- Augmenter l'offre (client, tant que personne n'a accepté) ----
export const augmenterOffre = onCall({ region: REGION }, async (request) => {
  const uid = exigerConnexion(request);
  const montant = validerMontant(request.data?.montant);
  return db.runTransaction(async (tx) => {
    const { ref, demande } = await lireDemande(tx, request.data?.demandeId, { uid, role: "client", statuts: ["ouverte"] });
    if (montant <= demande.remunerationOfferte) {
      throw new HttpsError("invalid-argument", "La nouvelle offre doit être plus élevée que l'actuelle.");
    }
    tx.update(ref, { remunerationOfferte: montant });
    return { ok: true };
  });
});
