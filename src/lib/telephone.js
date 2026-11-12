import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { messageServeur } from "./erreurs";

// Vérification du numéro pour les textos (functions/src/telephone.js).
const envoyerCodeCallable = httpsCallable(functions, "envoyerCodeTelephone");
const verifierCodeCallable = httpsCallable(functions, "verifierCodeTelephone");
const retirerCallable = httpsCallable(functions, "retirerTelephone");

export const envoyerCodeTelephone = (numero) => envoyerCodeCallable({ numero });
export const verifierCodeTelephone = async (code) => (await verifierCodeCallable({ code })).data;
export const retirerTelephone = () => retirerCallable({});

export function formaterNumero(e164) {
  const c = String(e164 ?? "").replace(/^\+1/, "");
  return c.length === 10 ? `(${c.slice(0, 3)}) ${c.slice(3, 6)}-${c.slice(6)}` : e164;
}

export function messageTelephone(err) {
  switch (messageServeur(err)) {
    case "numero-invalide":
      return "Numéro invalide : entrez un numéro canadien à 10 chiffres, par exemple 418 555-1234.";
    case "attendre":
      return "Un code vient d'être envoyé. Attendez une minute avant d'en demander un autre.";
    case "trop-de-codes":
      return "Trop de codes demandés aujourd'hui. Réessayez demain.";
    case "trop-de-codes-numero":
      return "Trop de codes envoyés à ce numéro aujourd'hui. Réessayez demain.";
    case "plafond-atteint":
      return "Les codes par texto sont temporairement indisponibles. Réessayez demain.";
    case "telephone-non-verifie":
      return "Vérifiez d'abord votre cellulaire.";
    case "textos-non-configures":
      return "Les textos ne sont pas encore offerts. Réessayez bientôt.";
    case "code-expire":
      return "Ce code a expiré. Demandez-en un nouveau.";
    case "trop-d-essais":
      return "Trop d'essais. Demandez un nouveau code.";
    case "aucun-code":
      return "Demandez d'abord un code.";
    case "envoi-impossible": {
      // Le code Twilio (sans secret) aide au diagnostic : 20003, 21408, 21614…
      const code = err?.details?.codeTwilio ?? err?.details?.statut;
      return `Le texto n'a pas pu partir${code ? ` (code Twilio ${code})` : ""}. Réessayez dans quelques minutes.`;
    }
    default:
      return "Quelque chose a bloqué. Réessayez.";
  }
}
