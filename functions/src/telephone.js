import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
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
// Limites contre l'abus (envoi de codes vers le numéro de quelqu'un d'autre,
// facture Twilio) : par numéro de destination, peu importe le compte, et un
// plafond global par jour.
export const CODES_PAR_NUMERO_PAR_JOUR = 3;
export const PLAFOND_CODES_PAR_JOUR = 200;
// Texto d'essai : seulement vers le numéro vérifié du compte.
export const DELAI_TEXTE_ESSAI_MS = 10 * 60 * 1000;
const JOUR_MS = 24 * 60 * 60 * 1000;

const empreinte = (uid, code) => createHash("sha256").update(`${uid}:${code}`).digest("hex");
// Le numéro n'est jamais stocké en clair dans les limites : seulement son empreinte.
const empreinteNumero = (numero) => createHash("sha256").update(`numero:${numero}`).digest("hex");
const jourUtc = (ms) => new Date(ms).toISOString().slice(0, 10);

// Réserve un envoi de code (par numéro et global) ; lève si une limite est atteinte.
async function reserverEnvoiCode(numero, maintenant) {
  const refNumero = db.doc(`limitesTelephone/${empreinteNumero(numero)}`);
  const refGlobal = db.doc(`limitesTelephone/jour-${jourUtc(maintenant)}`);
  await db.runTransaction(async (tx) => {
    const [n, g] = await Promise.all([tx.get(refNumero), tx.get(refGlobal)]);
    const dn = n.data();
    const nouvelleFenetre = !dn || maintenant - (dn.fenetreAt?.toMillis?.() ?? 0) > JOUR_MS;
    const compteNumero = nouvelleFenetre ? 0 : dn.compteur ?? 0;
    if (compteNumero >= CODES_PAR_NUMERO_PAR_JOUR) throw new HttpsError("resource-exhausted", "trop-de-codes-numero");
    const compteGlobal = g.data()?.compteur ?? 0;
    if (compteGlobal >= PLAFOND_CODES_PAR_JOUR) throw new HttpsError("resource-exhausted", "plafond-atteint");
    tx.set(refNumero, {
      compteur: compteNumero + 1,
      fenetreAt: nouvelleFenetre ? Timestamp.fromMillis(maintenant) : dn.fenetreAt,
      expireAt: Timestamp.fromMillis(maintenant + 2 * JOUR_MS),
    });
    tx.set(refGlobal, { compteur: compteGlobal + 1, expireAt: Timestamp.fromMillis(maintenant + 2 * JOUR_MS) });
  });
}

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
  await reserverEnvoiCode(numero, maintenant);

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  try {
    await envoyerTexteBrut(numero, `Snowro : votre code de vérification est ${code}. Il expire dans 10 minutes.`);
  } catch (err) {
    if (err.message === "textos-non-configures") throw new HttpsError("unavailable", "textos-non-configures");
    logger.error(`Code de vérification non envoyé : ${err.message}`, { uid, codeTwilio: err.codeTwilio ?? null });
    throw new HttpsError("unavailable", "envoi-impossible", { codeTwilio: err.codeTwilio ?? null, statut: err.statut ?? null });
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

// Retirer le numéro retire aussi le consentement aux textos : sans numéro,
// l'interrupteur n'a plus de sens (il redevient grisé).
export const retirerTelephone = onCall({ region: REGION }, async (request) => {
  const uid = exigerConnexion(request);
  const ref = db.doc(`users/${uid}`);
  const profil = (await ref.get()).data() ?? {};
  const maj = { telephoneVerifie: null, telephoneVerifieAt: null };
  if (profil.consents?.notificationsSMS?.granted) {
    maj["consents.notificationsSMS.granted"] = false;
    maj["consents.notificationsSMS.revokedAt"] = FieldValue.serverTimestamp();
    maj["consents.notificationsSMS.retraitPar"] = "retrait-numero";
  }
  await ref.update(maj);
  return { ok: true };
});

// Texto d'essai, à la demande, vers le numéro vérifié du compte seulement
// (jamais vers un numéro saisi) : au plus un toutes les 10 minutes.
export const envoyerTexteEssai = onCall({ region: REGION, secrets: SECRETS_SMS }, async (request) => {
  const uid = exigerConnexion(request);
  const profil = (await db.doc(`users/${uid}`).get()).data() ?? {};
  if (!profil.telephoneVerifie) throw new HttpsError("failed-precondition", "telephone-non-verifie");
  const ref = db.doc(`verificationsTelephone/${uid}`);
  const maintenant = Date.now();
  const dernier = (await ref.get()).data()?.essaiAt?.toMillis?.() ?? 0;
  if (maintenant - dernier < DELAI_TEXTE_ESSAI_MS) throw new HttpsError("resource-exhausted", "attendre-essai");
  try {
    await envoyerTexteBrut(profil.telephoneVerifie, "Snowro : texto d'essai. Vos avis par texto arriveront à ce numéro. Répondez STOP pour ne plus en recevoir.");
  } catch (err) {
    if (err.message === "textos-non-configures") throw new HttpsError("unavailable", "textos-non-configures");
    logger.error(`Texto d'essai non envoyé : ${err.message}`, { uid, codeTwilio: err.codeTwilio ?? null });
    throw new HttpsError("unavailable", "envoi-impossible", { codeTwilio: err.codeTwilio ?? null, statut: err.statut ?? null });
  }
  await ref.set({ essaiAt: Timestamp.fromMillis(maintenant) }, { merge: true });
  return { ok: true };
});
