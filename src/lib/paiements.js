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
  const marque = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", link: "Link" }[carte.marque] ?? "Carte";
  return carte.derniers4 ? `${marque} •••• ${carte.derniers4}` : marque;
}

// Statut du compte de versement : pastille (Paramètres) et phrase d'explication.
export const STATUTS_CONNECT = {
  non_demarre: { pastille: "Pas configuré", ton: "neutre", texte: "Configure-le une fois pour pouvoir accepter des jobs." },
  en_attente: {
    pastille: "À terminer",
    ton: "attente",
    texte: "Ton inscription chez Stripe n'est pas terminée, ou Stripe vérifie encore tes informations.",
  },
  actif: { pastille: "Actif", ton: "ok", texte: "Tes versements arrivent dans ton compte bancaire." },
  restreint: { pastille: "Action requise", ton: "alerte", texte: "Stripe a besoin d'informations de plus avant tes prochains versements." },
};
