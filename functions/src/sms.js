import { defineSecret, defineString } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";

// Textos par Twilio (API REST, sans SDK). Envoyés seulement aux personnes qui
// ont accordé le consentement « notificationsSMS » ET vérifié leur numéro
// (telephoneVerifie, écrit par verifierCodeTelephone). Sans numéro Twilio
// configuré (TWILIO_NUMERO vide), rien ne part : les textos sont simplement
// inactifs.
// Authentification par clé API restreinte (Messaging seulement), jamais par
// l'Auth Token du compte : chaque projet GCP a sa propre clé (snowro-test,
// snowro-app), révocable sans toucher à l'autre.
export const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
export const TWILIO_API_KEY_SID = defineSecret("TWILIO_API_KEY_SID");
export const TWILIO_API_KEY_SECRET = defineSecret("TWILIO_API_KEY_SECRET");
export const TWILIO_NUMERO = defineString("TWILIO_NUMERO", { default: "" });
export const SECRETS_SMS = [TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET];

// Même règle que les courriels : « [Test] » hors production.
const PREFIXE = (process.env.GCLOUD_PROJECT ?? "snowro-app") === "snowro-app" ? "" : "[Test] ";

// Numéro nord-américain (Canada, États-Unis) au format E.164 (+1XXXXXXXXXX),
// ou null s'il n'est pas valide.
export function normaliserNumero(texte) {
  if (typeof texte !== "string") return null;
  let chiffres = texte.replace(/\D/g, "");
  if (chiffres.length === 11 && chiffres.startsWith("1")) chiffres = chiffres.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(chiffres)) return null;
  return `+1${chiffres}`;
}

// (418) 555-1234, pour l'affichage.
export function formaterNumero(e164) {
  const c = String(e164 ?? "").replace(/^\+1/, "");
  return c.length === 10 ? `(${c.slice(0, 3)}) ${c.slice(3, 6)}-${c.slice(6)}` : e164;
}

export const peutRecevoirTextos = (profil) =>
  profil?.consents?.notificationsSMS?.granted === true && Boolean(profil?.telephoneVerifie);

// Envoi brut : lève une erreur si Twilio refuse ou n'est pas configuré.
export async function envoyerTexteBrut(a, corps) {
  const de = TWILIO_NUMERO.value();
  if (!de) throw new Error("textos-non-configures");
  const sid = TWILIO_ACCOUNT_SID.value();
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_API_KEY_SID.value()}:${TWILIO_API_KEY_SECRET.value()}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: a, From: de, Body: `${PREFIXE}${corps}` }).toString(),
  });
  const reponse = await res.json().catch(() => ({}));
  if (!res.ok) {
    const erreur = new Error(`Twilio a refusé l'envoi (${res.status}) : ${reponse.message ?? "réponse inattendue"}`);
    // Code d'erreur Twilio (ex. 20003 authentification, 21408 pays non permis) :
    // sans secret, utile pour le diagnostic.
    erreur.codeTwilio = reponse.code ?? null;
    erreur.statut = res.status;
    throw erreur;
  }
  return reponse.sid ?? null;
}

// Envoi à une personne (consentement et numéro vérifiés). Ne lève jamais :
// un texto qui échoue ne doit pas faire échouer le reste. Renvoie true si
// le texto est parti.
export async function envoyerTexto(profil, corps, { contexte = "" } = {}) {
  if (!peutRecevoirTextos(profil) || !TWILIO_NUMERO.value()) return false;
  try {
    await envoyerTexteBrut(profil.telephoneVerifie, corps);
    return true;
  } catch (err) {
    logger.error(`Texto non envoyé${contexte ? ` (${contexte})` : ""} : ${err.message}`);
    return false;
  }
}
