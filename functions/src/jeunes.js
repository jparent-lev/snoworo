import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineBoolean } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import geohash from "ngeohash";
import { db } from "./admin.js";
import { RESEND_API_KEY, echapperHtml, envoyerCourriel, gabaritCourriel } from "./courriels.js";
import { STRIPE_SECRET_KEY, URL_SITE, paiementReel, profilStripe, rembourser } from "./paiements.js";
import { SECRETS_SMS, envoyerTexto } from "./sms.js";

// Jeunes déneigeurs (14 à 17 ans), PROJET PILOTE limité à test.snowro.com
// (JEUNES_PILOTE, functions/.env.snowro-test). Stripe ne permet pas à un
// mineur d'avoir un compte de versement au Canada : le parent est titulaire
// du compte Stripe et reçoit les paiements ; le jeune a son propre accès.
//
// Encadrement sans friction : le parent fixe des règles une fois (heures,
// rayon autour de la maison, demandes par jour), il est avisé de chaque
// demande acceptée et garde un droit de veto (annulerParParent) tant que le
// travail n'est pas fait. Aucune approbation demande par demande.
const REGION = "northamerica-northeast1";
export const JEUNES_PILOTE = defineBoolean("JEUNES_PILOTE", { default: false });
const FUSEAU = "America/Toronto";
const AGE_MIN = 14;
const AGE_MAX = 17;
const DUREE_INVITATION_MS = 7 * 24 * 3600e3;
export const REGLES_DEFAUT = { heureDebut: 7, heureFin: 20, rayonKm: 1, maxParJour: 2 };

function exigerPilote() {
  if (!JEUNES_PILOTE.value()) throw new HttpsError("failed-precondition", "Le programme des jeunes déneigeurs n'est pas offert ici.");
}

export function validerRegles(r = {}) {
  const entier = (v, min, max, defaut) => {
    const n = v === undefined || v === null || v === "" ? defaut : Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new HttpsError("invalid-argument", "Règles invalides.");
    return n;
  };
  const regles = {
    heureDebut: entier(r.heureDebut, 6, 21, REGLES_DEFAUT.heureDebut),
    heureFin: entier(r.heureFin, 7, 22, REGLES_DEFAUT.heureFin),
    rayonKm: entier(r.rayonKm, 1, 5, REGLES_DEFAUT.rayonKm),
    maxParJour: entier(r.maxParJour, 1, 5, REGLES_DEFAUT.maxParJour),
  };
  if (regles.heureFin <= regles.heureDebut) throw new HttpsError("invalid-argument", "L'heure de fin doit suivre l'heure de début.");
  return regles;
}

export function ageSelonAnnee(annee, maintenant = new Date()) {
  return maintenant.getFullYear() - annee;
}

const heureLocale = (ms) => Number(new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, hour: "numeric", hourCycle: "h23" }).format(new Date(ms)));
const jourLocal = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, dateStyle: "short" }).format(new Date(ms));

function distanceKm(h1, h2) {
  const a = geohash.decode(h1);
  const b = geohash.decode(h2);
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.latitude - a.latitude) / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(r(b.longitude - a.longitude) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// Règles du parent (heures permises, rayon autour de la maison) : null si la
// demande les respecte, sinon la raison. Pur : sert à l'acceptation et aux
// avis de nouvelles demandes. Le maximum par jour est vérifié à part.
export function horsRegles(regles = REGLES_DEFAUT, { maison, demande }) {
  const r = { ...REGLES_DEFAUT, ...regles };
  const h = heureLocale(demande.dateHeureSouhaitee.toMillis());
  if (h < r.heureDebut || h >= r.heureFin) return `Hors de tes heures permises (${r.heureDebut} h à ${r.heureFin} h).`;
  if (maison && demande.adresseGeohash && distanceKm(maison, demande.adresseGeohash) > r.rayonKm) {
    return `Trop loin de la maison (plus de ${r.rayonKm} km).`;
  }
  return null;
}

// Vérifie qu'un jeune peut accepter cette demande (appelé dans la
// transaction de accepterDemande). Renvoie le profil du parent.
export async function verifierJeune(tx, { uid, profil, demande }) {
  exigerPilote();
  const parentSnap = await tx.get(db.doc(`users/${profil.parentId}`));
  const parent = parentSnap.data();
  if (!parent) throw new HttpsError("failed-precondition", "Le compte de ton parent est introuvable.");
  const jeune = profil.jeune ?? {};
  if (jeune.retire) throw new HttpsError("permission-denied", "Ton parent a retiré son accord.");
  if (jeune.pause) throw new HttpsError("failed-precondition", "Ton profil est en pause : vois avec ton parent.");
  if (paiementReel() && profilStripe(parent).connectStatus !== "actif") {
    throw new HttpsError("failed-precondition", "Le compte de versement de ton parent n'est pas encore prêt.");
  }
  const regles = { ...REGLES_DEFAUT, ...(jeune.regles ?? {}) };
  const quand = demande.dateHeureSouhaitee.toMillis();
  const raison = horsRegles(regles, { maison: parent.addressGeohash, demande });
  if (raison) throw new HttpsError("failed-precondition", raison);
  const memeJour = await tx.get(db.collection("demandes").where("deneigeurId", "==", uid));
  const jour = jourLocal(quand);
  const nb = memeJour.docs.filter((d) => {
    const x = d.data();
    return x.statut !== "annulee" && x.dateHeureSouhaitee && jourLocal(x.dateHeureSouhaitee.toMillis()) === jour;
  }).length;
  if (nb >= regles.maxParJour) throw new HttpsError("failed-precondition", `Maximum de ${regles.maxParJour} demandes par jour atteint.`);
  return parent;
}

// ---- Le parent invite son jeune ----
export const inviterJeune = onCall({ region: REGION, secrets: [RESEND_API_KEY] }, async (request) => {
  exigerPilote();
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");
  if (request.auth.token?.email_verified === false) throw new HttpsError("failed-precondition", "courriel-non-confirme");
  const d = request.data ?? {};
  const courriel = typeof d.courriel === "string" ? d.courriel.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel) || courriel.length > 254) throw new HttpsError("invalid-argument", "Courriel invalide.");
  const prenom = typeof d.prenom === "string" ? d.prenom.trim().slice(0, 40) : "";
  if (!prenom) throw new HttpsError("invalid-argument", "Prénom requis.");
  const annee = Number(d.anneeNaissance);
  const age = ageSelonAnnee(annee);
  if (!Number.isInteger(annee) || age < AGE_MIN || age > AGE_MAX) {
    throw new HttpsError("invalid-argument", `Le programme est pour les jeunes de ${AGE_MIN} à ${AGE_MAX} ans.`);
  }
  if (d.attestation !== true) throw new HttpsError("invalid-argument", "Confirmez que vous êtes son parent ou tuteur et que vous consentez.");
  const regles = validerRegles(d.regles);

  const parentRef = db.doc(`users/${uid}`);
  const parent = (await parentRef.get()).data() ?? {};
  if (parent.parentId) throw new HttpsError("permission-denied", "Un compte de jeune ne peut pas inviter.");
  if (!(parent.role ?? []).includes("deneigeur_x") || !parent.villeGeoId || !parent.addressGeohash) {
    throw new HttpsError("failed-precondition", "Activez d'abord le mode déneigeur avec l'adresse de la maison.");
  }
  if (paiementReel() && profilStripe(parent).connectStatus !== "actif") {
    throw new HttpsError("failed-precondition", "Terminez d'abord votre compte de versement : c'est là que les paiements de votre jeune arriveront.");
  }
  if (Object.keys(parent.jeunes ?? {}).length >= 5) throw new HttpsError("resource-exhausted", "Cinq jeunes au plus.");

  const jeton = randomBytes(24).toString("base64url");
  const invRef = db.collection("invitationsJeunes").doc();
  const fiche = { statut: "invite", prenom, courriel, anneeNaissance: annee, regles, pause: false, inviteAt: FieldValue.serverTimestamp() };
  await db.runTransaction(async (tx) => {
    tx.set(invRef, {
      parentId: uid,
      jeton,
      ...fiche,
      attestation: { texte: "Je suis son parent ou tuteur et je consens à sa participation au projet pilote.", at: FieldValue.serverTimestamp() },
      expireAt: Timestamp.fromMillis(Date.now() + DUREE_INVITATION_MS),
    });
    tx.set(parentRef, { jeunes: { [invRef.id]: fiche } }, { merge: true });
  });

  const lien = `${URL_SITE.value()}/jeune/rejoindre?i=${invRef.id}&j=${jeton}`;
  const nomParent = (parent.displayName || "").trim().split(/\s+/)[0] || "Ton parent";
  const titre = `${nomParent} t'invite à déneiger avec Snowro`;
  const lignes = [
    `Bonjour ${prenom},`,
    `${nomParent} t'invite à rejoindre Snowro comme jeune déneigeur de quartier. Tu pourras accepter des demandes près de la maison, selon les règles que ${nomParent} a choisies, et ${nomParent} sera avisé à chaque fois.`,
    "Le lien est valide 7 jours.",
  ];
  try {
    await envoyerCourriel({
      a: courriel,
      sujet: titre,
      html: gabaritCourriel({
        titre,
        paragraphes: [
          ...lignes.map(echapperHtml),
          `<a href="${echapperHtml(lien)}" style="display:inline-block;background:#9E4E23;color:#FFFDF8;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px;">Créer mon accès</a>`,
        ],
        piedDePage: "Tu ne connais pas cette personne? Ignore ce courriel : rien ne sera créé.",
      }),
      texte: [titre, "", ...lignes, "", lien].join("\n"),
      type: "invitation_jeune",
    });
  } catch (err) {
    logger.error(`Invitation jeune non envoyée : ${err.message}`);
    throw new HttpsError("unavailable", "Le courriel d'invitation n'a pas pu partir. Réessayez dans un moment.");
  }
  return { invitationId: invRef.id };
});

async function lireInvitation(id, jeton) {
  if (typeof id !== "string" || !id || id.includes("/") || typeof jeton !== "string") throw new HttpsError("invalid-argument", "Lien invalide.");
  const snap = await db.doc(`invitationsJeunes/${id}`).get();
  const inv = snap.data();
  if (!inv || inv.jeton !== jeton) throw new HttpsError("not-found", "invitation-invalide");
  if (inv.statut !== "invite") throw new HttpsError("failed-precondition", "invitation-utilisee");
  if (inv.expireAt.toMillis() < Date.now()) throw new HttpsError("failed-precondition", "invitation-expiree");
  return { ref: snap.ref, inv };
}

// ---- Page du lien : ce qu'il faut afficher au jeune (sans connexion) ----
export const lireInvitationJeune = onCall({ region: REGION }, async (request) => {
  exigerPilote();
  const { inv } = await lireInvitation(request.data?.i, request.data?.j);
  const parent = (await db.doc(`users/${inv.parentId}`).get()).data() ?? {};
  return {
    prenom: inv.prenom,
    courriel: inv.courriel,
    prenomParent: (parent.displayName || "").trim().split(/\s+/)[0] || null,
    regles: inv.regles,
  };
});

// ---- Le jeune, connecté avec l'adresse invitée, accepte ----
export const accepterInvitationJeune = onCall({ region: REGION }, async (request) => {
  exigerPilote();
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");
  const { ref, inv } = await lireInvitation(request.data?.i, request.data?.j);
  const compte = await getAuth().getUser(uid);
  if ((compte.email ?? "").toLowerCase() !== inv.courriel) {
    throw new HttpsError("permission-denied", `Connecte-toi avec l'adresse invitée (${inv.courriel}).`);
  }
  if (request.data?.consentement !== true) throw new HttpsError("invalid-argument", "Accepte les règles de sécurité pour continuer.");
  const userRef = db.doc(`users/${uid}`);
  const parentRef = db.doc(`users/${inv.parentId}`);
  await db.runTransaction(async (tx) => {
    const [moi, parentSnap] = await Promise.all([tx.get(userRef), tx.get(parentRef)]);
    const parent = parentSnap.data() ?? {};
    if ((moi.data() ?? {}).jeunes && Object.keys(moi.data().jeunes).length) throw new HttpsError("failed-precondition", "Ce compte est celui d'un parent.");
    tx.set(
      userRef,
      {
        role: ["deneigeur_x"],
        displayName: (moi.data() ?? {}).displayName || inv.prenom,
        parentId: inv.parentId,
        jeune: { invitationId: ref.id, prenom: inv.prenom, anneeNaissance: inv.anneeNaissance, regles: inv.regles, pause: false, consentementAt: FieldValue.serverTimestamp() },
        // Même secteur que la maison : jamais une autre adresse.
        ville: parent.ville ?? null,
        villeGeoId: parent.villeGeoId ?? null,
        addressGeohash: parent.addressGeohash ?? null,
        postalCodePrefix: parent.postalCodePrefix ?? null,
      },
      { merge: true },
    );
    tx.update(ref, { statut: "actif", jeuneId: uid, accepteeAt: FieldValue.serverTimestamp(), jeton: FieldValue.delete() });
    tx.set(parentRef, { jeunes: { [ref.id]: { statut: "actif", uid } } }, { merge: true });
  });
  // Le lien reçu dans sa boîte prouve l'adresse : elle est confirmée.
  if (!compte.emailVerified) await getAuth().updateUser(uid, { emailVerified: true });
  return { ok: true };
});

// ---- Le parent ajuste les règles, met en pause ou retire son accord ----
export const reglerJeune = onCall({ region: REGION }, async (request) => {
  exigerPilote();
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");
  const { invitationId, regles, pause, retirer } = request.data ?? {};
  const parentRef = db.doc(`users/${uid}`);
  const parent = (await parentRef.get()).data() ?? {};
  const fiche = parent.jeunes?.[invitationId];
  if (!fiche) throw new HttpsError("not-found", "Jeune introuvable.");
  const maj = {};
  if (regles !== undefined) maj.regles = validerRegles(regles);
  if (pause !== undefined) maj.pause = pause === true;
  if (retirer === true) maj.statut = "retire";
  const lot = db.batch();
  lot.set(parentRef, { jeunes: { [invitationId]: maj } }, { merge: true });
  if (fiche.uid) {
    const jeuneMaj = { jeune: { ...(maj.regles ? { regles: maj.regles } : {}), ...(maj.pause !== undefined ? { pause: maj.pause } : {}) } };
    if (retirer === true) Object.assign(jeuneMaj, { role: [], jeune: { retire: true } });
    lot.set(db.doc(`users/${fiche.uid}`), jeuneMaj, { merge: true });
  } else if (retirer === true) {
    lot.update(db.doc(`invitationsJeunes/${invitationId}`), { statut: "retire", jeton: FieldValue.delete() });
  }
  await lot.commit();
  return { ok: true };
});

// ---- Droit de veto : le parent annule une demande acceptée par son jeune ----
// Tant que le travail n'est pas marqué fait : le client est remboursé et la
// demande redevient visible pour les autres déneigeurs.
export const annulerParParent = onCall({ region: REGION, secrets: [STRIPE_SECRET_KEY, RESEND_API_KEY] }, async (request) => {
  exigerPilote();
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");
  const demandeId = request.data?.demandeId;
  if (typeof demandeId !== "string" || !demandeId || demandeId.includes("/")) throw new HttpsError("invalid-argument", "demandeId requis.");
  const ref = db.doc(`demandes/${demandeId}`);
  const avant = await db.runTransaction(async (tx) => {
    const demande = (await tx.get(ref)).data();
    if (!demande || demande.deneigeurParentId !== uid) throw new HttpsError("permission-denied", "Cette demande n'a pas été acceptée par votre jeune.");
    if (demande.statut !== "matchee") throw new HttpsError("failed-precondition", "Le travail est déjà fait ou la demande n'est plus active.");
    const statut = demande.paiement?.statutPaiement;
    if (statut === "retenu") tx.update(ref, { "paiement.statutPaiement": "a_rembourser" });
    return demande;
  });
  if (avant.paiement?.statutPaiement === "retenu") await rembourser(demandeId);
  const apres = (await ref.get()).data();
  await ref.update({
    statut: "ouverte",
    deneigeurId: null,
    deneigeurPrenom: null,
    deneigeurNote: null,
    deneigeurJeune: FieldValue.delete(),
    deneigeurParentId: FieldValue.delete(),
    matchedAt: null,
    paiement: null,
    // Nouveau prélèvement (nouvelle clé) si quelqu'un d'autre accepte.
    remiseEnLigne: FieldValue.increment(1),
    historiqueAnnulations: FieldValue.arrayUnion({ par: "parent", at: Timestamp.now(), paiement: apres.paiement ?? null }),
  });
  const client = (await db.doc(`users/${avant.donneurOuvrageId}`).get()).data();
  if (client?.email) {
    const lignes = [
      `Le jeune déneigeur qui avait accepté « ${avant.titre} » ne pourra finalement pas y aller.`,
      paiementReel() ? "Le montant prélevé vous est remboursé." : "Rien ne vous a été prélevé.",
      "Votre demande est de nouveau visible pour les déneigeurs de votre quartier.",
    ];
    await envoyerCourriel({
      a: client.email,
      sujet: "Votre demande est de nouveau ouverte",
      html: gabaritCourriel({ titre: "Votre demande est de nouveau ouverte", paragraphes: lignes.map(echapperHtml), piedDePage: "Snowro" }),
      texte: lignes.join("\n"),
      type: "annulation_parent",
    }).catch((err) => logger.error(`Avis au client non envoyé : ${err.message}`));
  }
  return { ok: true };
});

// Avis au parent quand son jeune accepte une demande (courriel et texto).
export async function avertirParent(demandeId, demande, jeune, parent) {
  const lien = `${URL_SITE.value()}/jeune/annuler?d=${demandeId}`;
  const quand = demande.dateHeureSouhaitee.toDate().toLocaleString("fr-CA", { timeZone: FUSEAU, weekday: "long", hour: "numeric", minute: "2-digit" });
  const prenomJeune = jeune.jeune?.prenom ?? "Votre jeune";
  const quartier = demande.quartier ? `, ${demande.quartier}` : "";
  const resume = `${prenomJeune} a accepté « ${demande.titre} »${quartier}, avant ${quand}, pour le client ${demande.donneurPrenom ?? ""}.`;
  await envoyerTexto(parent, `Snowro : ${resume} Pour annuler : ${lien}`, { contexte: "avis parent" });
  if (!parent.email) return;
  try {
    await envoyerCourriel({
      a: parent.email,
      sujet: `${prenomJeune} a accepté une demande`,
      html: gabaritCourriel({
        titre: `${echapperHtml(prenomJeune)} a accepté une demande`,
        paragraphes: [
          echapperHtml(resume),
          "L'adresse exacte est dans le tableau de bord de votre jeune. Rien à faire si tout vous convient.",
          `<a href="${echapperHtml(lien)}" style="color:#9E4E23;font-weight:700;">Annuler cette demande</a> (possible tant que le travail n'est pas fait ; le client est remboursé).`,
        ],
        piedDePage: "Vous recevez cet avis parce que votre jeune participe au projet pilote des jeunes déneigeurs de Snowro.",
      }),
      texte: [resume, "", `Annuler : ${lien}`].join("\n"),
      type: "avis_parent",
    });
  } catch (err) {
    logger.error(`Avis au parent non envoyé : ${err.message}`);
  }
}
export const SECRETS_AVIS_PARENT = [RESEND_API_KEY, ...SECRETS_SMS];

// Signalement sur une demande de son jeune (par le client ou par le jeune) :
// le parent reçoit l'avis et le verbatim des messages échangés. Ne lève
// jamais : l'avis ne doit pas faire échouer le signalement.
export const MOTIFS_LIBELLES = {
  absent: "absence",
  incomplet: "travail incomplet",
  acces: "accès impossible",
  autre: "autre problème",
};
export function verbatimMessages(messages, noms) {
  if (!messages.length) return ["(Aucun message échangé.)"];
  return messages.map((m) => {
    const quand = m.createdAt?.toDate?.().toLocaleString("fr-CA", { timeZone: FUSEAU, dateStyle: "short", timeStyle: "short" }) ?? "";
    return `[${quand}] ${noms[m.expediteurId] ?? "Snowro"} : ${m.contenu}`;
  });
}

export async function avertirParentSignalement(demandeId) {
  try {
    const demande = (await db.doc(`demandes/${demandeId}`).get()).data();
    if (!demande?.deneigeurParentId || !demande.signalement) return false;
    const [parentSnap, jeuneSnap, msgs] = await Promise.all([
      db.doc(`users/${demande.deneigeurParentId}`).get(),
      db.doc(`users/${demande.deneigeurId}`).get(),
      db.collection(`messages/${demandeId}/messages`).orderBy("createdAt", "asc").limit(200).get(),
    ]);
    const parent = parentSnap.data();
    if (!parent?.email) return false;
    const prenomJeune = jeuneSnap.data()?.jeune?.prenom ?? demande.deneigeurPrenom ?? "Votre jeune";
    const s = demande.signalement;
    const qui = s.par === "client" ? `Le client (${demande.donneurPrenom ?? "client"})` : prenomJeune;
    const entete = `${qui} a signalé un problème sur « ${demande.titre} »${demande.quartier ? `, ${demande.quartier}` : ""} : ${MOTIFS_LIBELLES[s.motif] ?? s.motif}.`;
    const details = s.details ? `Détails : « ${s.details} »` : "Aucun détail ajouté.";
    const verbatim = verbatimMessages(
      msgs.docs.map((d) => d.data()),
      { [demande.donneurOuvrageId]: demande.donneurPrenom ?? "Client", [demande.deneigeurId]: prenomJeune },
    );
    const suite = "Le paiement est retenu le temps que Snowro examine la situation. Nous vous écrirons. Vous pouvez répondre à ce courriel pour donner votre version.";
    await envoyerCourriel({
      a: parent.email,
      sujet: `Problème signalé sur une demande de ${prenomJeune}`,
      html: gabaritCourriel({
        titre: `Problème signalé sur une demande de ${echapperHtml(prenomJeune)}`,
        paragraphes: [
          echapperHtml(entete),
          echapperHtml(details),
          echapperHtml(suite),
          `<strong>Messages échangés</strong><br>${verbatim.map(echapperHtml).join("<br>")}`,
        ],
        piedDePage: "Vous recevez cet avis parce que votre jeune participe au projet pilote des jeunes déneigeurs de Snowro.",
      }),
      texte: [entete, details, "", suite, "", "Messages échangés :", ...verbatim].join("\n"),
      cleIdempotence: `signalement-parent-${demandeId}`,
      type: "signalement_parent",
    });
    await envoyerTexto(parent, `Snowro : ${entete} Détails et messages envoyés par courriel.`, { contexte: "signalement parent" });
    return true;
  } catch (err) {
    logger.error(`Avis de signalement au parent non envoyé (${demandeId}) : ${err.message}`);
    return false;
  }
}
