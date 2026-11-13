import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { RESEND_API_KEY, echapperHtml, envoyerCourriel, gabaritCourriel } from "./courriels.js";
import { URL_SITE } from "./paiements.js";

// Confirmation de l'adresse courriel du compte. Le lien est produit par
// Firebase Auth (generateEmailVerificationLink), mais envoyé par nos soins
// (Resend, en français, aux couleurs de Snowro) et il mène à notre page
// /courriel/confirmer, qui applique le code (applyActionCode). La page par
// défaut de Firebase, en anglais, n'est jamais montrée.
//
// Exigée avant de publier ou d'accepter une demande (exigerCourrielConfirme,
// cycleDemande.js) ; jamais pour se connecter ni pour visiter le site.
const REGION = "northamerica-northeast1";
// Un envoi par minute au plus, pour un même compte.
export const DELAI_RENVOI_MS = 60 * 1000;

export function courrielConfirmation({ prenom, lien }) {
  const titre = "Confirmez votre adresse courriel";
  const salut = prenom ? `Bonjour ${echapperHtml(prenom)},` : "Bonjour,";
  const texteAppel = "Il reste une étape avant de publier ou d'accepter une demande sur Snowro : confirmer que cette adresse est bien la vôtre.";
  const bouton = `<a href="${echapperHtml(lien)}" style="display:inline-block;background:#9E4E23;color:#FFFDF8;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px;">Confirmer mon adresse</a>`;
  const pied =
    "Le lien est valide 3 jours. Vous n'avez pas créé de compte Snowro? Ignorez ce courriel : sans confirmation, l'adresse ne servira à rien.";
  return {
    sujet: titre,
    html: gabaritCourriel({ titre, paragraphes: [salut, texteAppel, bouton], piedDePage: pied }),
    texte: [titre, "", prenom ? `Bonjour ${prenom},` : "Bonjour,", "", texteAppel, "", lien, "", "L'équipe Snowro", "", pied].join("\n"),
  };
}

// Le lien Firebase (https://<projet>.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=…)
// devient un lien vers notre page, avec le même code.
export function lienSnowro(lienFirebase, base) {
  const code = new URL(lienFirebase).searchParams.get("oobCode");
  if (!code) throw new Error("Lien de confirmation sans code.");
  return `${base}/courriel/confirmer?code=${encodeURIComponent(code)}`;
}

export const envoyerConfirmationCourriel = onCall({ region: REGION, secrets: [RESEND_API_KEY] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");
  const compte = await getAuth().getUser(uid);
  if (!compte.email) throw new HttpsError("failed-precondition", "Ce compte n'a pas d'adresse courriel.");
  if (compte.emailVerified) return { dejaConfirme: true };

  const ref = db.doc(`users/${uid}`);
  const fiche = (await ref.get()).data() ?? {};
  const dernier = fiche.confirmationCourriel?.envoyeAt?.toMillis?.() ?? 0;
  if (Date.now() - dernier < DELAI_RENVOI_MS) {
    throw new HttpsError("resource-exhausted", "Un lien vient d'être envoyé. Attendez une minute avant d'en demander un autre.");
  }

  const lien = lienSnowro(await getAuth().generateEmailVerificationLink(compte.email), URL_SITE.value());
  const prenom = (compte.displayName ?? fiche.displayName ?? "").trim().split(/\s+/)[0] ?? "";
  const { sujet, html, texte } = courrielConfirmation({ prenom, lien });
  await ref.set({ confirmationCourriel: { envoyeAt: FieldValue.serverTimestamp() } }, { merge: true });
  try {
    await envoyerCourriel({ a: compte.email, sujet, html, texte, type: "confirmation_courriel" });
  } catch (err) {
    console.error(`Confirmation de courriel non envoyée pour ${uid} : ${err.message}`);
    throw new HttpsError("unavailable", "Le courriel n'a pas pu partir. Réessayez dans un moment.");
  }
  return { envoye: true };
});
