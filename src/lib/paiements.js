import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// Paiements Stripe (functions/src/paiements.js). Le paiement est réel dès que
// la clé publiable Stripe est définie (VITE_STRIPE_CLE_PUBLIQUE dans
// .env.production) ; elle doit aller de pair avec PAIEMENT_REEL=true côté
// fonctions. Sans clé : paiement simulé et bandeau « Période de test ».
export const CLE_PUBLIQUE_STRIPE = import.meta.env.VITE_STRIPE_CLE_PUBLIQUE || "";
export const PAIEMENT_REEL = Boolean(CLE_PUBLIQUE_STRIPE);

const appeler = (nom) => {
  const fn = httpsCallable(functions, nom);
  return async (data) => (await fn(data)).data;
};

export const preparerCarte = appeler("preparerCarte");
export const enregistrerCarte = appeler("enregistrerCarte");
export const lienCompteDeneigeur = appeler("lienCompteDeneigeur");
export const synchroniserCompteDeneigeur = appeler("synchroniserCompteDeneigeur");
export const relancerDemande = appeler("relancerDemande");

// Stripe.js n'est chargé que sur les écrans qui en ont besoin.
let chargement = null;
export function chargerStripe() {
  if (!chargement) chargement = import("@stripe/stripe-js").then(({ loadStripe }) => loadStripe(CLE_PUBLIQUE_STRIPE, { locale: "fr-CA" }));
  return chargement;
}

export function libelleCarte(carte) {
  if (!carte) return "";
  const marque = { visa: "Visa", mastercard: "Mastercard", amex: "American Express" }[carte.marque] ?? "Carte";
  return `${marque} •••• ${carte.derniers4}`;
}

export const LIBELLES_CONNECT = {
  non_demarre: "Pas encore configuré",
  en_attente: "Inscription à terminer ou en vérification",
  actif: "Actif : tes versements arrivent dans ton compte bancaire",
  restreint: "Stripe a besoin d'informations de plus",
};
