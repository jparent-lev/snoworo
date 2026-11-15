import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./admin.js";

// Durées de conservation promises dans la politique de confidentialité
// (src/pages/Confidentialite.jsx). Les photos et les messages d'une demande ont
// leur propre effacement (purgerPhotos, functions/src/cycleDemande.js).
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

// Invitations de jeunes déneigeurs jamais utilisées (functions/src/jeunes.js),
// effacées à leur expiration (7 jours) ; aussi retirées de la fiche du parent.
// Une invitation acceptée est gardée : elle porte l'attestation du parent.
async function effacerInvitationsJeunesExpirees() {
  const lot = await db.collection("invitationsJeunes").where("expireAt", "<=", Timestamp.now()).limit(400).get();
  const batch = db.batch();
  let n = 0;
  for (const d of lot.docs) {
    const inv = d.data();
    if (inv.statut !== "invite") continue;
    batch.delete(d.ref);
    batch.set(db.doc(`users/${inv.parentId}`), { jeunes: { [d.id]: FieldValue.delete() } }, { merge: true });
    n++;
  }
  if (n) await batch.commit();
  return n;
}

// Une fois par jour : messages « Nous écrire » de plus de 24 mois, et
// documents techniques expirés.
export async function appliquerConservation() {
  const messagesContact = await effacerAvant("messagesContact", CONSERVATION_MESSAGES_CONTACT_MS);
  await effacerExpires("limitesTelephone");
  // Anti-abus des liens de compte (functions/src/liensCompte.js) : 24 heures.
  await effacerExpires("envoisCompte");
  await effacerInvitationsJeunesExpirees();
  if (messagesContact) logger.info(`Conservation : ${messagesContact} message(s) « Nous écrire » de plus de 24 mois effacé(s).`);
  return { messagesContact };
}

export const purgerConservation = onSchedule(
  { schedule: "every day 03:37", timeZone: "America/Toronto", region: "northamerica-northeast1" },
  appliquerConservation,
);
