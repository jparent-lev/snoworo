import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const envoyerMessageContactCallable = httpsCallable(functions, "envoyerMessageContact");

// `siteWeb` : champ honeypot (voir NousEcrire) — toujours vide pour un humain.
export function envoyerMessageContact({ nom, courriel, sujet, message, siteWeb }) {
  return envoyerMessageContactCallable({ nom, courriel, sujet, message, siteWeb });
}
