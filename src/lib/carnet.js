import { httpsCallable } from "firebase/functions";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, functions } from "./firebase";

// Carnet d'adresses du client (users/{uid}/adresses) : ajout formel par le
// serveur (functions/src/carnet.js), lecture seule ici.
const appeler = (nom) => {
  const fn = httpsCallable(functions, nom);
  return async (data) => (await fn(data)).data;
};
export const ajouterAdresse = appeler("ajouterAdresse");
export const supprimerAdresse = appeler("supprimerAdresse");

// Même texte que le serveur (ATTESTATION) : c'est ce que la personne coche.
export const TEXTE_ATTESTATION =
  "Cette adresse est chez moi, ou chez une personne qui a accepté d'y être déneigée par l'entremise de Snowro.";

export function ecouterCarnet(uid, onChange) {
  const q = query(collection(db, "users", uid, "adresses"), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => onChange([]),
  );
}

export const libelleLien = (a) =>
  a.lien === "proche" ? `Chez un proche${a.personneSurPlace ? ` · ${a.personneSurPlace} sur place` : ""}` : "Chez moi";

// Lien, prénom sur place et attestation (components/LieuAdresse.jsx).
export const LIEU_VIDE = { lien: null, personneSurPlace: "", attestation: false };

// Message d'erreur avant l'envoi, ou null.
export function erreurLieu(v) {
  if (!v.lien) return "Indiquez si c'est chez vous ou chez un proche.";
  if (!v.attestation) return "Confirmez que vous avez l'autorisation de faire déneiger cette adresse.";
  return null;
}
