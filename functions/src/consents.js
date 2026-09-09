import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { CONSENT_VERSIONS, CONSENT_TYPES } from "./consentVersions.js";

function assertValidType(type) {
  if (!CONSENT_TYPES.includes(type)) {
    throw new HttpsError(
      "invalid-argument",
      `Type de consentement inconnu : ${type}`,
    );
  }
}

// Seul point d'écriture pour `users/{uid}.consents` — les Firestore rules
// bloquent toute écriture directe côté client sur ce champ (Loi 25 : traçabilité).
export const grantConsent = onCall({ region: "northamerica-northeast1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Connexion requise.");
  }
  const { type } = request.data ?? {};
  assertValidType(type);

  await db.doc(`users/${request.auth.uid}`).update({
    [`consents.${type}`]: {
      granted: true,
      grantedAt: FieldValue.serverTimestamp(),
      version: CONSENT_VERSIONS[type],
    },
  });

  return { type, granted: true, version: CONSENT_VERSIONS[type] };
});

export const revokeConsent = onCall({ region: "northamerica-northeast1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Connexion requise.");
  }
  const { type } = request.data ?? {};
  assertValidType(type);

  // Le retrait doit être aussi simple que l'octroi : on garde version/grantedAt
  // de l'octroi précédent pour la trace, seul `granted` bascule.
  await db.doc(`users/${request.auth.uid}`).update({
    [`consents.${type}.granted`]: false,
    [`consents.${type}.revokedAt`]: FieldValue.serverTimestamp(),
  });

  return { type, granted: false };
});
