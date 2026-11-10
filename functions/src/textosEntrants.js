import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { createHmac, timingSafeEqual } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, normaliserNumero } from "./sms.js";

// Webhook des textos reçus sur le numéro Snowro (Twilio > numéro >
// Messaging > « A message comes in »). Une réponse STOP (ou ARRÊT, etc.)
// retire le consentement « notificationsSMS » de chaque compte qui a ce
// numéro vérifié. Twilio bloque déjà lui-même les envois suivants et répond
// à la personne ; ici, on aligne le consentement dans Snowro (Loi 25).
// Les requêtes sont authentifiées par la signature X-Twilio-Signature.
const REGION = "northamerica-northeast1";
export const MOTS_ARRET = new Set(["STOP", "STOPALL", "ARRET", "ARRÊT", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "DESABONNER", "DÉSABONNER"]);

// Signature Twilio : HMAC-SHA1 (clé : Auth Token) de l'URL appelée suivie des
// paramètres POST triés (nom puis valeur), en base64.
export function signatureTwilio(jeton, url, params) {
  const base = url + Object.keys(params).sort().map((k) => `${k}${params[k]}`).join("");
  return createHmac("sha1", jeton).update(Buffer.from(base, "utf-8")).digest("base64");
}

function signatureValide(jeton, urls, params, recue) {
  if (!recue) return false;
  const b = Buffer.from(recue);
  return urls.some((url) => {
    const attendue = Buffer.from(signatureTwilio(jeton, url, params));
    return attendue.length === b.length && timingSafeEqual(attendue, b);
  });
}

export function estArret(corps, optOutType) {
  if (String(optOutType ?? "").toUpperCase() === "STOP") return true;
  const mot = String(corps ?? "").trim().toUpperCase().replace(/[.!]+$/, "");
  return MOTS_ARRET.has(mot);
}

// Retire le consentement aux textos des comptes dont le numéro vérifié est `numero`.
export async function retirerConsentementParNumero(numero) {
  const lot = await db.collection("users").where("telephoneVerifie", "==", numero).get();
  const touches = lot.docs.filter((d) => d.data().consents?.notificationsSMS?.granted);
  await Promise.all(
    touches.map((d) =>
      d.ref.update({
        "consents.notificationsSMS.granted": false,
        "consents.notificationsSMS.revokedAt": FieldValue.serverTimestamp(),
        "consents.notificationsSMS.retraitPar": "stop",
      }),
    ),
  );
  return touches.length;
}

export const recevoirTexteTwilio = onRequest({ region: REGION, secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("");
    return;
  }
  const params = req.body ?? {};
  const projet = process.env.GCLOUD_PROJECT ?? "";
  const chemin = req.originalUrl || "/";
  const urls = [
    `https://${req.get("host")}${chemin}`,
    `https://${REGION}-${projet}.cloudfunctions.net/recevoirTexteTwilio`,
  ];
  if (!signatureValide(TWILIO_AUTH_TOKEN.value(), urls, params, req.get("X-Twilio-Signature"))) {
    logger.warn("Texto entrant refusé : signature Twilio invalide.");
    res.status(403).send("");
    return;
  }
  if (params.AccountSid && params.AccountSid !== TWILIO_ACCOUNT_SID.value()) {
    res.status(403).send("");
    return;
  }
  const numero = normaliserNumero(params.From);
  if (numero && estArret(params.Body, params.OptOutType)) {
    const n = await retirerConsentementParNumero(numero);
    logger.info(`STOP reçu : consentement aux textos retiré pour ${n} compte(s).`);
  }
  // Aucune réponse de notre part : Twilio envoie lui-même la confirmation de STOP.
  res.type("text/xml").send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>");
});
