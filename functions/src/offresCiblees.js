import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin.js";

// Snowro Pro : un déneigeur pro contacte un utilisateur précis. La création
// passe obligatoirement ici pour valider consents.offresCiblees.granted
// AVANT l'écriture — jamais côté client (voir firestore.rules : write bloqué).
export const creerOffreCiblee = onCall({ region: "northamerica-northeast1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Connexion requise.");
  }

  const { utilisateurCibleId, message, remunerationProposee } = request.data ?? {};
  if (!utilisateurCibleId || !message) {
    throw new HttpsError("invalid-argument", "utilisateurCibleId et message sont requis.");
  }

  const proSnap = await db.doc(`users/${request.auth.uid}`).get();
  const proData = proSnap.data();
  if (proData?.proSubscription?.status !== "active") {
    throw new HttpsError("permission-denied", "Abonnement Snowro Pro requis.");
  }

  const cibleSnap = await db.doc(`users/${utilisateurCibleId}`).get();
  const consentOffres = cibleSnap.data()?.consents?.offresCiblees;
  if (!consentOffres?.granted) {
    throw new HttpsError(
      "permission-denied",
      "Cet utilisateur n'a pas consenti aux offres ciblées.",
    );
  }

  const ref = await db.collection("offresCiblees").add({
    deneigeurProId: request.auth.uid,
    utilisateurCibleId,
    message,
    remunerationProposee: remunerationProposee ?? null,
    statut: "envoyee",
    createdAt: FieldValue.serverTimestamp(),
  });

  return { id: ref.id };
});
