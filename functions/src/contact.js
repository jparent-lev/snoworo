import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Doit rester aligné sur SUJETS dans src/pages/NousEcrire.jsx.
const SUJETS = new Set(["question", "deneigeur", "pro", "renseignements", "autre"]);
const LONGUEUR_MAX_NOM = 120;
const LONGUEUR_MAX_MESSAGE = 5000;

// Formulaire « Nous écrire » du site vitrine — public (aucune authentification
// requise), même principe que rejoindreListeAttente : validation et écriture
// uniquement côté serveur, collection fermée à tout accès client
// (firestore.rules). Les messages se lisent dans la console Firebase
// (collection messagesContact) ; aucun courriel n'est envoyé.
export const envoyerMessageContact = onCall({ region: "northamerica-northeast1" }, async (request) => {
  const { nom, courriel, sujet, message, siteWeb } = request.data ?? {};

  // Honeypot anti-spam (voir NousEcrire.jsx) : faux succès silencieux.
  if (siteWeb) {
    return { ok: true };
  }

  if (typeof courriel !== "string" || !EMAIL_REGEX.test(courriel.trim())) {
    throw new HttpsError("invalid-argument", "Courriel invalide.");
  }
  if (!SUJETS.has(sujet)) {
    throw new HttpsError("invalid-argument", "Sujet invalide.");
  }
  if (typeof message !== "string" || message.trim().length === 0 || message.length > LONGUEUR_MAX_MESSAGE) {
    throw new HttpsError("invalid-argument", "Message vide ou trop long.");
  }
  if (nom != null && (typeof nom !== "string" || nom.length > LONGUEUR_MAX_NOM)) {
    throw new HttpsError("invalid-argument", "Nom invalide.");
  }

  await db.collection("messagesContact").add({
    nom: nom?.trim() || null,
    courriel: courriel.trim().toLowerCase(),
    sujet,
    message: message.trim(),
    // Lié au compte seulement si la personne était connectée en écrivant.
    userId: request.auth?.uid ?? null,
    traite: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});
