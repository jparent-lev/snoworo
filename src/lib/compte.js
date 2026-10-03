import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// Fermeture du compte (functions/src/compte.js) : tout est effacé ou rendu
// anonyme côté serveur, puis le compte de connexion est supprimé.
const fermerCompteCallable = httpsCallable(functions, "fermerCompte");
export function fermerCompte() {
  return fermerCompteCallable({ confirmation: "FERMER" });
}

export function messageFermeture(err) {
  if (err?.message === "job-en-cours") {
    return "Tu as une job en cours (acceptée, faite ou signalée). Termine-la d'abord, puis reviens fermer ton compte.";
  }
  if (err?.message === "versement-en-attente") {
    return "Un versement est encore en route vers ton compte de banque. Réessaie une fois qu'il est reçu.";
  }
  return "La fermeture n'a pas fonctionné. Réessaie, ou écris-nous par « Nous écrire ».";
}
