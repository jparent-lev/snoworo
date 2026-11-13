import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { db } from "./admin.js";
import { RESEND_API_KEY, envoyerCourriel, echapperHtml, gabaritCourriel } from "./courriels.js";
import { URL_SITE } from "./paiements.js";

// Liens de compte envoyés par courriel, sans être connecté :
// - « reinitialisation » : mot de passe oublié, vers /mot-de-passe ;
// - « connexion » : lien de connexion (sans mot de passe), vers /connexion/lien.
// Liens produits par Firebase Auth, envoyés par Resend en français, menant à
// nos pages (jamais la page anglaise de Firebase).
//
// La réponse est toujours la même, qu'un compte existe ou non : personne ne
// peut s'en servir pour savoir si une adresse est inscrite. Rien n'est envoyé
// à une adresse sans compte : un lien de connexion ne crée jamais de compte
// (l'inscription, avec la case 18 ans, reste obligatoire).
const REGION = "northamerica-northeast1";
export const DELAI_RENVOI_MS = 60 * 1000;
const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function courrielLien(type, { prenom, lien }) {
  const salut = prenom ? `Bonjour ${echapperHtml(prenom)},` : "Bonjour,";
  const r = type === "connexion";
  const titre = r ? "Votre lien de connexion" : "Choisissez un nouveau mot de passe";
  const appel = r
    ? "Voici le lien demandé pour vous connecter à Snowro sans mot de passe."
    : "Vous avez demandé à changer le mot de passe de votre compte Snowro.";
  const libelle = r ? "Me connecter" : "Choisir un nouveau mot de passe";
  const bouton = `<a href="${echapperHtml(lien)}" style="display:inline-block;background:#9E4E23;color:#FFFDF8;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px;">${libelle}</a>`;
  const pied = r
    ? "Le lien est valide quelques heures et ne sert qu'une fois. Vous n'avez rien demandé? Ignorez ce courriel : personne ne peut se connecter sans ce lien."
    : "Le lien est valide une heure. Vous n'avez rien demandé? Ignorez ce courriel : votre mot de passe actuel reste le même.";
  return {
    sujet: titre,
    html: gabaritCourriel({ titre, paragraphes: [salut, appel, bouton], piedDePage: pied }),
    texte: [titre, "", prenom ? `Bonjour ${prenom},` : "Bonjour,", "", appel, "", lien, "", "L'équipe Snowro", "", pied].join("\n"),
  };
}

// Lien Firebase → même paramètres sur notre page.
export function lienVersSnowro(lienFirebase, base, chemin, garder) {
  const source = new URL(lienFirebase).searchParams;
  if (!source.get("oobCode")) throw new Error("Lien sans code.");
  const cible = new URLSearchParams();
  for (const k of garder) if (source.get(k)) cible.set(k === "oobCode" && chemin === "/mot-de-passe" ? "code" : k, source.get(k));
  return `${base}${chemin}?${cible.toString()}`;
}

export const demanderLienCompte = onCall({ region: REGION, secrets: [RESEND_API_KEY] }, async (request) => {
  const { courriel, type } = request.data ?? {};
  if (!["reinitialisation", "connexion"].includes(type)) throw new HttpsError("invalid-argument", "Type de lien invalide.");
  const adresse = typeof courriel === "string" ? courriel.trim().toLowerCase() : "";
  if (adresse.length > 254 || !COURRIEL.test(adresse)) throw new HttpsError("invalid-argument", "Adresse courriel invalide.");
  const reponse = { ok: true };

  // Au plus un lien par minute, par adresse et par type (aussi pour une
  // adresse sans compte, pour que les deux cas prennent le même chemin).
  const cle = createHash("sha256").update(`${type}:${adresse}`).digest("hex");
  const ref = db.doc(`envoisCompte/${cle}`);
  const dernier = (await ref.get()).data()?.envoyeAt?.toMillis?.() ?? 0;
  if (Date.now() - dernier < DELAI_RENVOI_MS) return reponse;
  await ref.set({ envoyeAt: FieldValue.serverTimestamp(), expireAt: new Date(Date.now() + 24 * 3600e3) });

  let compte;
  try {
    compte = await getAuth().getUserByEmail(adresse);
  } catch (err) {
    if (err.code === "auth/user-not-found") return reponse;
    throw err;
  }
  if (compte.disabled) return reponse;

  const base = URL_SITE.value();
  let lien;
  try {
    lien =
      type === "connexion"
        ? lienVersSnowro(
            await getAuth().generateSignInWithEmailLink(adresse, { url: `${base}/connexion/lien`, handleCodeInApp: true }),
            base,
            "/connexion/lien",
            ["mode", "oobCode", "apiKey", "lang"],
          )
        : lienVersSnowro(await getAuth().generatePasswordResetLink(adresse), base, "/mot-de-passe", ["oobCode"]);
  } catch (err) {
    console.error(`Lien « ${type} » non généré : ${err.code ?? ""} ${err.message}`);
    throw new HttpsError("unavailable", "Le lien n'a pas pu être créé. Réessayez dans un moment.");
  }
  const prenom = (compte.displayName ?? "").trim().split(/\s+/)[0] ?? "";
  const { sujet, html, texte } = courrielLien(type, { prenom, lien });
  try {
    await envoyerCourriel({ a: adresse, sujet, html, texte, type: type === "connexion" ? "lien_connexion" : "reinitialisation" });
  } catch (err) {
    console.error(`Lien « ${type} » non envoyé : ${err.message}`);
    throw new HttpsError("unavailable", "Le courriel n'a pas pu partir. Réessayez dans un moment.");
  }
  return reponse;
});
