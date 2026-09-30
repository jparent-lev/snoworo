import { defineSecret } from "firebase-functions/params";

// Envoi de courriels transactionnels par Resend (https://resend.com), appelé
// directement depuis nos Cloud Functions plutôt que par l'extension Trigger
// Email : le service Firebase Extensions ferme le 31 mars 2027. Tout passe
// par envoyerCourriel ci-dessous : changer de fournisseur (ex. Postmark) ne
// touche que ce fichier.
//
// Clé d'API à définir via :
//   firebase functions:secrets:set RESEND_API_KEY
// (clé Resend « Sending access » limitée au domaine snowro.com).
export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

// Boîte qui reçoit les réponses aux courriels de Snowro (Google Workspace).
// Le site, lui, ne l'affiche nulle part : on renvoie toujours vers le
// formulaire Nous écrire.
export const ADRESSE_SNOWRO = "allo@snowro.com";
const EXPEDITEUR = `Snowro <${ADRESSE_SNOWRO}>`;

// `cleIdempotence` : Resend ignore un deuxième envoi portant la même clé dans
// les 24 h, ce qui protège contre un double courriel si la fonction est
// relancée. `type` : étiquette visible dans le tableau de bord Resend (lettres,
// chiffres, _ et - seulement).
export async function envoyerCourriel({ a, sujet, html, texte, cleIdempotence, type }) {
  const entetes = {
    Authorization: `Bearer ${RESEND_API_KEY.value()}`,
    "Content-Type": "application/json",
  };
  if (cleIdempotence) entetes["Idempotency-Key"] = cleIdempotence;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({
      from: EXPEDITEUR,
      to: [a],
      reply_to: ADRESSE_SNOWRO,
      subject: sujet,
      html,
      text: texte,
      tags: type ? [{ name: "type", value: type }] : undefined,
    }),
  });

  const corps = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend a refusé l'envoi (${res.status}) : ${corps.message ?? "réponse inattendue"}`);
  }
  return corps.id;
}

export function echapperHtml(valeur) {
  return String(valeur)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Gabarit commun aux courriels Snowro : couleurs de la marque en styles en
// ligne (les clients de courriel ignorent les feuilles de style), Fraunces
// avec repli Georgia puisque la plupart des clients ne chargent pas les
// polices web. `paragraphes` : fragments HTML déjà échappés.
export function gabaritCourriel({ titre, paragraphes, piedDePage }) {
  const corps = paragraphes
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#3B2A1F;">${p}</p>`)
    .join("");
  return `<!doctype html>
<html lang="fr-CA">
  <body style="margin:0;padding:0;background:#F7F1E6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F1E6;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFDF8;border:1px solid #E4D7C0;border-radius:18px;">
            <tr>
              <td style="padding:32px 32px 8px;font-family:Karla,Helvetica,Arial,sans-serif;">
                <p style="margin:0 0 20px;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:22px;color:#C1652F;">snowro</p>
                <h1 style="margin:0 0 18px;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:26px;line-height:1.15;color:#3B2A1F;">${titre}</h1>
                ${corps}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px;font-family:Karla,Helvetica,Arial,sans-serif;">
                <p style="margin:0;font-size:13px;line-height:1.5;color:#6B5445;">${piedDePage}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
