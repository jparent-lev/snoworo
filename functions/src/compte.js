import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { STRIPE_SECRET_KEY, paiementReel, stripe } from "./paiements.js";

// Fermeture du compte par la personne elle-même (Loi 25 : droit à
// l'effacement ; politique de confidentialité, « Combien de temps on les
// garde »). Tout est fait immédiatement :
// - refusé tant qu'une job est en cours ou qu'un versement reste à faire
//   (l'autre personne compte dessus) ;
// - demandes encore ouvertes annulées ;
// - dans chaque demande où la personne apparaît : prénom et description
//   effacés, ainsi que l'adresse, les photos, l'évaluation et la
//   conversation (le titre, générique, reste). On garde le registre de
//   paiement (montants, identifiants Stripe), que la loi oblige à conserver
//   6 ans ;
// - fiche users/{uid}, inscription à la liste d'attente et offres reçues
//   effacées ; client Stripe (carte enregistrée) supprimé ;
// - compte de connexion supprimé en dernier.
// Le compte de versement Stripe d'un déneigeur n'est pas supprimé : Stripe le
// conserve selon ses propres obligations légales.
const STATUTS_EN_COURS = new Set(["matchee", "faite", "signalee"]);
const STATUTS_A_ANNULER = new Set(["ouverte", "paiement_refuse"]);
const VERSEMENTS_EN_ATTENTE = new Set(["prelevement_en_cours", "retenu", "a_verser"]);
// Affiché à l'autre personne à la place du prénom (et plus d'évaluation
// possible d'un déneigeur dont le compte n'existe plus).
export const COMPTE_FERME = "Compte fermé";
const DOCS_PRIVES = ["adresse", "photo", "photo-0", "photo-1", "photo-2", "evaluation", "avis"];

export async function fermerCompteUtilisateur(uid) {
  const [commeClient, commeDeneigeur] = await Promise.all([
    db.collection("demandes").where("donneurOuvrageId", "==", uid).get(),
    db.collection("demandes").where("deneigeurId", "==", uid).get(),
  ]);
  const demandes = [...commeClient.docs, ...commeDeneigeur.docs];
  for (const d of demandes) {
    const { statut, paiement, deneigeurId } = d.data();
    if (STATUTS_EN_COURS.has(statut)) throw new HttpsError("failed-precondition", "job-en-cours");
    if (deneigeurId === uid && VERSEMENTS_EN_ATTENTE.has(paiement?.statutPaiement)) {
      throw new HttpsError("failed-precondition", "versement-en-attente");
    }
  }

  for (const d of demandes) {
    const demande = d.data();
    const client = demande.donneurOuvrageId === uid;
    await db.recursiveDelete(db.collection(`messages/${d.id}/messages`));
    const batch = db.batch();
    for (const nom of DOCS_PRIVES) batch.delete(db.doc(`${d.ref.path}/prive/${nom}`));
    batch.update(d.ref, {
      ...(client
        ? { donneurPrenom: COMPTE_FERME, description: "" }
        : { deneigeurPrenom: COMPTE_FERME, deneigeurNote: null, evaluee: true }),
      ...(client && STATUTS_A_ANNULER.has(demande.statut) ? { statut: "annulee", annuleeAt: FieldValue.serverTimestamp() } : {}),
      photo: false,
      nbPhotos: 0,
      photoExpireAt: null,
      dernierMessage: null,
      compteFerme: FieldValue.arrayUnion(client ? "client" : "deneigeur"),
    });
    await batch.commit();
  }

  const refProfil = db.doc(`users/${uid}`);
  const profil = (await refProfil.get()).data() ?? {};
  if (profil.stripeCustomerId && paiementReel()) {
    try {
      await stripe().customers.del(profil.stripeCustomerId);
    } catch (err) {
      // Déjà supprimé chez Stripe : rien à faire. Autre erreur : on arrête
      // avant d'effacer quoi que ce soit d'autre, pour pouvoir réessayer.
      if (err?.code !== "resource_missing") throw err;
    }
  }

  const offres = await db.collection("offresCiblees").where("utilisateurCibleId", "==", uid).get();
  const batch = db.batch();
  offres.docs.forEach((o) => batch.delete(o.ref));
  if (profil.email) batch.delete(db.doc(`listeAttente/${profil.email.trim().toLowerCase()}`));
  await batch.commit();
  await db.recursiveDelete(refProfil);

  try {
    await getAuth().deleteUser(uid);
  } catch (err) {
    if (err?.code !== "auth/user-not-found") throw err;
  }
  logger.info(`Compte ${uid} fermé : ${demandes.length} demande(s) rendue(s) anonyme(s).`);
  return { demandes: demandes.length };
}

export const fermerCompte = onCall(
  { region: "northamerica-northeast1", secrets: [STRIPE_SECRET_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
    if (request.data?.confirmation !== "FERMER") throw new HttpsError("invalid-argument", "Confirmation requise.");
    await fermerCompteUtilisateur(request.auth.uid);
    return { ok: true };
  },
);
