import { region } from "firebase-functions/v1";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { CONSENT_TYPES } from "./consentVersions.js";

// Crée le document users/{uid} à la création du compte Auth, avec le squelette
// `consents` déjà en place (tout refusé par défaut) — voir docs/architecture.md :
// le consentement doit exister dès la première fonctionnalité, jamais ajouté après coup.
export const onUserCreate = region("northamerica-northeast1").auth.user().onCreate(async (user) => {
  const consents = {};
  for (const type of CONSENT_TYPES) {
    consents[type] = { granted: false, grantedAt: null, version: null };
  }

  await db.doc(`users/${user.uid}`).set({
    role: [],
    displayName: user.displayName ?? "",
    phone: user.phoneNumber ?? "",
    email: user.email ?? "",
    addressGeohash: null,
    postalCodePrefix: null,
    ratingAvg: 0,
    ratingCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    proSubscription: null,
    consents,
  });
});
