import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./admin.js";

// Durées de conservation promises dans la politique de confidentialité
// (src/pages/Confidentialite.jsx). Les photos et les messages d'une demande ont
// leur propre effacement (purgerPhotos, functions/src/cycleDemande.js).
export const CONSERVATION_LISTE_ATTENTE_MS = 730 * 24 * 60 * 60 * 1000; // 24 mois
export const CONSERVATION_MESSAGES_CONTACT_MS = 730 * 24 * 60 * 60 * 1000; // 24 mois

async function effacerAvant(collection, limiteMs) {
  const limite = Timestamp.fromMillis(Date.now() - limiteMs);
  let total = 0;
  for (;;) {
    const lot = await db.collection(collection).where("createdAt", "<=", limite).limit(400).get();
    if (lot.empty) return total;
    const batch = db.batch();
    lot.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += lot.size;
  }
}

// Inscriptions jamais confirmées : effacées quand leur lien expire (7 jours).
async function effacerNonConfirmees() {
  let total = 0;
  for (;;) {
    const lot = await db.collection("listeAttente").where("jetonExpireAt", "<=", Timestamp.now()).limit(400).get();
    if (lot.empty) return total;
    const batch = db.batch();
    lot.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += lot.size;
  }
}

// Compteurs anti-abus des codes par texto (functions/src/telephone.js) :
// utiles 24 heures, effacés après 48.
async function effacerExpires(collection) {
  let total = 0;
  for (;;) {
    const lot = await db.collection(collection).where("expireAt", "<=", Timestamp.now()).limit(400).get();
    if (lot.empty) return total;
    const batch = db.batch();
    lot.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += lot.size;
  }
}

// Une fois par jour : liste d'attente et messages « Nous écrire » de plus de
// 24 mois, inscriptions jamais confirmées après 7 jours.
export async function appliquerConservation() {
  const nonConfirmees = await effacerNonConfirmees();
  const listeAttente = await effacerAvant("listeAttente", CONSERVATION_LISTE_ATTENTE_MS);
  const messagesContact = await effacerAvant("messagesContact", CONSERVATION_MESSAGES_CONTACT_MS);
  await effacerExpires("limitesTelephone");
  // Anti-abus des liens de compte (functions/src/liensCompte.js) : 24 heures.
  await effacerExpires("envoisCompte");
  if (nonConfirmees || listeAttente || messagesContact) {
    logger.info(
      `Conservation : ${nonConfirmees} inscription(s) non confirmée(s), ${listeAttente} inscription(s) de plus de 24 mois et ${messagesContact} message(s) « Nous écrire » effacés.`,
    );
  }
  return { nonConfirmees, listeAttente, messagesContact };
}

export const purgerConservation = onSchedule(
  { schedule: "every day 03:37", timeZone: "America/Toronto", region: "northamerica-northeast1" },
  appliquerConservation,
);
