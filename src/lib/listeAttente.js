import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const rejoindreListeAttenteCallable = httpsCallable(functions, "rejoindreListeAttente");

// `siteWeb` : champ honeypot (voir WaitlistForm), toujours vide pour un humain.
// `entreprise` : seulement pour role === "pro".
export function rejoindreListeAttente({ courriel, codePostal, role, siteWeb, entreprise }) {
  return rejoindreListeAttenteCallable({ courriel, codePostal, role, siteWeb, entreprise });
}
