import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// Jeunes déneigeurs, projet pilote (functions/src/jeunes.js), test seulement.
export const JEUNES_PILOTE = import.meta.env.VITE_JEUNES_PILOTE === "1";
const appeler = (nom) => {
  const fn = httpsCallable(functions, nom);
  return async (data) => (await fn(data)).data;
};
export const inviterJeune = appeler("inviterJeune");
export const lireInvitationJeune = appeler("lireInvitationJeune");
export const accepterInvitationJeune = appeler("accepterInvitationJeune");
export const reglerJeune = appeler("reglerJeune");
export const annulerParParent = appeler("annulerParParent");

export const REGLES_DEFAUT = { heureDebut: 7, heureFin: 20, rayonKm: 1, maxParJour: 2 };
export const resumeRegles = (r = REGLES_DEFAUT) =>
  `de ${r.heureDebut} h à ${r.heureFin} h, à ${r.rayonKm} km ou moins de la maison, ${r.maxParJour} demande${r.maxParJour > 1 ? "s" : ""} par jour au plus`;
