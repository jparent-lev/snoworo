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

  const valeursParDefaut = {
    displayName: user.displayName ?? "",
    phone: user.phoneNumber ?? "",
    email: user.email ?? "",
    addressGeohash: null,
    postalCodePrefix: null,
    ville: null,
    villeGeoId: null,
    ratingAvg: 0,
    ratingCount: 0,
    nbJobsCompletees: 0,
    createdAt: FieldValue.serverTimestamp(),
    proSubscription: null,
    // Paiement Stripe Connect (voir snowro-changements-claude-code.md § 1) —
    // un déneigeur ne peut accepter aucune demande tant que connectStatus
    // n'est pas "actif". Renseigné uniquement par la Cloud Function qui
    // reçoit la confirmation Stripe (webhook), jamais par le client.
    stripeConnectAccountId: null,
    connectStatus: "non_demarre",
    consents,
  };

  // L'app enregistre le nom et les rôles choisis à l'inscription juste après
  // la création du compte, souvent AVANT que cette fonction tourne. On ne
  // remplit donc que les champs encore absents : sinon le nom saisi serait
  // remis à vide (user.displayName n'existe pas encore à la création).
  const ref = db.doc(`users/${user.uid}`);
  await db.runTransaction(async (tx) => {
    const existant = (await tx.get(ref)).data() ?? {};
    const manquants = Object.fromEntries(Object.entries(valeursParDefaut).filter(([cle]) => !(cle in existant)));
    if (Object.keys(manquants).length) tx.set(ref, manquants, { merge: true });
  });
});
