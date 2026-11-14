import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { decoderGeohash, distanceMetres } from "./geo";

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

// Mêmes règles que le serveur (functions/src/jeunes.js, horsRegles) : la
// liste du jeune ne montre que les demandes qu'il a le droit d'accepter.
const enMillis = (v) => (v?.toMillis ? v.toMillis() : v ? new Date(v).getTime() : 0);
const FUSEAU = "America/Toronto";
const heureLocale = (ms) => Number(new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, hour: "numeric", hourCycle: "h23" }).format(new Date(ms)));
export const jourLocal = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, dateStyle: "short" }).format(new Date(ms));

export function respecteRegles(demande, { regles, maison, parJour = {} }) {
  const r = { ...REGLES_DEFAUT, ...regles };
  const quand = enMillis(demande.dateHeureSouhaitee);
  const h = heureLocale(quand);
  if (h < r.heureDebut || h >= r.heureFin) return false;
  if (maison && demande.adresseGeohash && distanceMetres(decoderGeohash(maison), decoderGeohash(demande.adresseGeohash)) > r.rayonKm * 1000) return false;
  return (parJour[jourLocal(quand)] ?? 0) < r.maxParJour;
}
