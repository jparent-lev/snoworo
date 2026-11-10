import { onCall, HttpsError } from "firebase-functions/v2/https";
import { createHash, randomInt } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { SECRETS_SMS, envoyerTexteBrut, normaliserNumero } from "./sms.js";

// Vérification du numéro de téléphone par un code à 6 chiffres envoyé par
// texto (Paramètres). Le code n'est jamais stocké en clair : son empreinte
// est dans verificationsTelephone/{uid} (fermé à tout accès client), valide
// 10 minutes, 5 essais au plus, un nouveau code au plus toutes les 60
// secondes et 5 codes au plus par 24 heures. Le numéro vérifié
// (telephoneVerifie, champ protégé) n'est écrit que par verifierCodeTelephone.
const REGION = "northamerica-northeast1";
export const VALIDITE_CODE_MS = 10 * 60 * 1000;
export const DELAI_NOUVEAU_CODE_MS = 60 * 1000;
const CODES_PAR_JOUR = 5;
const ESSAIS_MAX = 5;

const empreinte = (uid, code) => createHash("sha256").update(`${uid}:${code}`).digest("hex");

function exigerConnexion(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  return request.auth.uid;
}

export const envoyerCodeTelephone = onCall({ region: REGION, secrets: SECRETS_SMS }, async (request) => {
  const uid = exigerConnexion(request);
  const numero = normaliserNumero(request.data?.numero);
  if (!numero) throw new HttpsError("invalid-argument", "numero-invalide");

  const ref = db.doc(`verificationsTelephone/${uid}`);
  const maintenant = Date.now();
  const existante = (await ref.get()).data();
  if (maintenant - (existante?.envoyeAt?.toMillis?.() ?? 0) < DELAI_NOUVEAU_CODE_MS) {
    throw new HttpsError("resource-exhausted", "attendre");
  }
  const debutFenetre = existante?.fenetreAt?.toMillis?.() ?? 0;
  const nouvelleFenetre = maintenant - debutFenetre > 24 * 60 * 60 * 1000;
  const compteur = nouvelleFenetre ? 0 : existante?.compteur ?? 0;
  if (compteur >= CODES_PAR_JOUR) throw new HttpsError("resource-exhausted", "trop-de-codes");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  try {
    await envoyerTexteBrut(numero, `Snowro : votre code de vérification est ${code}. Il expire dans 10 minutes.`);
  } catch (err) {
    throw new HttpsError("unavailable", err.message === "textos-non-configures" ? "textos-non-configures" : "envoi-impossible");
  }
  await ref.set({
    numero,
    empreinte: empreinte(uid, code),
    expireAt: Timestamp.fromMillis(maintenant + VALIDITE_CODE_MS),
    envoyeAt: Timestamp.fromMillis(maintenant),
    essais: 0,
    compteur: compteur + 1,
    fenetreAt: nouvelleFenetre ? Timestamp.fromMillis(maintenant) : existante.fenetreAt,
  });
  return { ok: true };
});

export const verifierCodeTelephone = onCall({ region: REGION }, async (request) => {
  const uid = exigerConnexion(request);
  const code = String(request.data?.code ?? "").replace(/\D/g, "");
  if (code.length !== 6) throw new HttpsError("invalid-argument", "code-invalide");
  const ref = db.doc(`verificationsTelephone/${uid}`);
  return db.runTransaction(async (tx) => {
    const v = (await tx.get(ref)).data();
    if (!v?.empreinte) throw new HttpsError("failed-precondition", "aucun-code");
    if ((v.expireAt?.toMillis?.() ?? 0) < Date.now()) throw new HttpsError("failed-precondition", "code-expire");
    if ((v.essais ?? 0) >= ESSAIS_MAX) throw new HttpsError("failed-precondition", "trop-d-essais");
    if (v.empreinte !== empreinte(uid, code)) {
      tx.update(ref, { essais: FieldValue.increment(1) });
      return { ok: false };
    }
    tx.update(db.doc(`users/${uid}`), { telephoneVerifie: v.numero, telephoneVerifieAt: FieldValue.serverTimestamp() });
    tx.update(ref, { empreinte: FieldValue.delete(), expireAt: FieldValue.delete(), essais: 0 });
    return { ok: true, numero: v.numero };
  });
});

export const retirerTelephone = onCall({ region: REGION }, async (request) => {
  const uid = exigerConnexion(request);
  await db.doc(`users/${uid}`).update({ telephoneVerifie: null, telephoneVerifieAt: null });
  return { ok: true };
});
