import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

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
  if (err?.message === "deja-prise") return "Un autre déneigeur de quartier vient de la prendre.";
  return err?.message && err.code !== "functions/internal" ? err.message : "Quelque chose a bloqué. Réessaie.";
}
