import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const rejoindreListeAttenteCallable = httpsCallable(functions, "rejoindreListeAttente");

// `siteWeb` : champ honeypot (voir WaitlistForm), toujours vide pour un humain.
// `entreprise` : seulement pour role === "pro".
export function rejoindreListeAttente({ nom, courriel, codePostal, role, siteWeb, entreprise }) {
  return rejoindreListeAttenteCallable({ nom, courriel, codePostal, role, siteWeb, entreprise });
}

// Lien du courriel de confirmation : c (identifiant de l'inscription), j (jeton).
const confirmerListeAttenteCallable = httpsCallable(functions, "confirmerListeAttente");
export function confirmerListeAttente({ c, j }) {
  return confirmerListeAttenteCallable({ c, j });
}
