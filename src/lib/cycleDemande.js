import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { messageServeur } from "./erreurs";

// Toutes les écritures sur les demandes passent par les Cloud Functions du
// cycle de vie (functions/src/cycleDemande.js) : les Firestore rules refusent
// toute écriture directe côté client.
const appeler = (nom) => {
  const fn = httpsCallable(functions, nom);
  return async (data) => (await fn(data)).data;
};

export const publierDemande = appeler("publierDemande");
export const accepterDemande = appeler("accepterDemande");
export const marquerFaite = appeler("marquerFaite");
export const confirmerJob = appeler("confirmerJob");
export const evaluerJob = appeler("evaluerJob");
export const signalerProbleme = appeler("signalerProbleme");
export const annulerDemande = appeler("annulerDemande");
export const augmenterOffre = appeler("augmenterOffre");

// Message lisible à partir d'une erreur de callable (le serveur écrit déjà
// ses messages en français) ; « deja-prise » est traité à part par l'appelant.
export function messageErreur(err) {
  const message = messageServeur(err);
  if (message === "deja-prise") return "Un autre déneigeur de quartier vient de la prendre.";
  if (message === "photos-requises") return "Ajoutez au moins une photo du travail terminé.";
  if (message === "carte-requise") return "Ajoutez d'abord une carte de paiement. Rien n'est prélevé avant qu'un déneigeur accepte.";
  if (message === "carte-refusee") {
    return "La carte du client a été refusée. Sa demande est en pause le temps qu'il la mette à jour.";
  }
  return message && err.code !== "functions/internal" ? message : "Une erreur est survenue. Veuillez réessayer.";
}

// Retard (functions/src/retards.js) : demande acceptée dont l'heure prévue est
// passée sans « C'est fait ». Le client peut l'annuler et être remboursé ;
// 12 h plus tard, c'est automatique.
export const DELAI_RETARD_MS = 12 * 60 * 60 * 1000;
const enMillis = (v) => (v?.toMillis ? v.toMillis() : v ? new Date(v).getTime() : 0);
export const estEnRetard = (d, maintenant = Date.now()) => d.statut === "matchee" && enMillis(d.dateHeureSouhaitee) <= maintenant;
export const limiteRetard = (d) => new Date(enMillis(d.dateHeureSouhaitee) + DELAI_RETARD_MS);
