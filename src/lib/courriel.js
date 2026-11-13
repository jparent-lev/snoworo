import { httpsCallable } from "firebase/functions";
import { applyActionCode } from "firebase/auth";
import { auth, functions } from "./firebase";

// Confirmation de l'adresse courriel (functions/src/courrielConfirmation.js).
const envoyer = httpsCallable(functions, "envoyerConfirmationCourriel");
export const envoyerConfirmationCourriel = async () => (await envoyer({})).data;

// Applique le code du lien, puis rafraîchit le compte connecté (s'il y en a
// un sur cet appareil) pour que le serveur voie la confirmation tout de suite.
export async function confirmerCourriel(code) {
  await applyActionCode(auth, code);
  await rafraichirCompte();
}

// Recharge le compte et son jeton ; vrai si le courriel est confirmé.
export async function rafraichirCompte() {
  const u = auth.currentUser;
  if (!u) return false;
  await u.reload();
  if (u.emailVerified) await u.getIdToken(true);
  return u.emailVerified;
}
