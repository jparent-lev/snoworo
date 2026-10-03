import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./admin.js";

// Durées de conservation promises dans la politique de confidentialité
// (src/pages/Confidentialite.jsx). Les photos et les messages d'une job ont
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

// Une fois par jour : liste d'attente et messages « Nous écrire » de plus de 24 mois.
export async function appliquerConservation() {
  const listeAttente = await effacerAvant("listeAttente", CONSERVATION_LISTE_ATTENTE_MS);
  const messagesContact = await effacerAvant("messagesContact", CONSERVATION_MESSAGES_CONTACT_MS);
  if (listeAttente || messagesContact) {
    logger.info(`Conservation : ${listeAttente} inscription(s) et ${messagesContact} message(s) « Nous écrire » effacés.`);
  }
  return { listeAttente, messagesContact };
}

export const purgerConservation = onSchedule(
  { schedule: "every day 03:37", timeZone: "America/Toronto", region: "northamerica-northeast1" },
  appliquerConservation,
);
