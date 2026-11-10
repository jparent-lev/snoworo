import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { messageServeur } from "./erreurs";

// Fermeture du compte (functions/src/compte.js) : tout est effacé ou rendu
// anonyme côté serveur, puis le compte de connexion est supprimé.
const fermerCompteCallable = httpsCallable(functions, "fermerCompte");
export function fermerCompte() {
  return fermerCompteCallable({ confirmation: "FERMER" });
}

export function messageFermeture(err) {
  if (messageServeur(err) === "job-en-cours") {
    return "Vous avez une demande en cours (acceptée, faite ou signalée). Terminez-la d'abord, puis revenez fermer votre compte.";
  }
  if (messageServeur(err) === "versement-en-attente") {
    return "Un versement est encore en route vers votre compte bancaire. Réessayez une fois qu'il est reçu.";
  }
  return "La fermeture n'a pas fonctionné. Réessayez, ou écrivez-nous par « Nous écrire ».";
}
