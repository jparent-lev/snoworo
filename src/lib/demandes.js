import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";

const versListe = (onChange) => (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

// Le filtre par villeGeoId est une exclusion dure, jamais un critère de tri :
// un déneigeur ne voit jamais une demande hors de sa ville de service, même
// proche à vol d'oiseau. Tris et filtres (TableauDeneigeur) ne s'appliquent
// qu'à l'intérieur de ce sous-ensemble. Le serveur revérifie à l'acceptation.
export function ecouterDemandesOuvertes(villeGeoId, onChange) {
  const q = query(
    collection(db, "demandes"),
    where("villeGeoId", "==", villeGeoId),
    where("statut", "==", "ouverte"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, versListe(onChange));
}

// Mode client : toutes mes demandes, les plus récentes d'abord.
export function ecouterMesDemandes(uid, onChange) {
  const q = query(collection(db, "demandes"), where("donneurOuvrageId", "==", uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, versListe(onChange));
}

// Mode déneigeur : les jobs que j'ai acceptées, par heure souhaitée.
export function ecouterMesJobs(uid, onChange) {
  const q = query(collection(db, "demandes"), where("deneigeurId", "==", uid), orderBy("dateHeureSouhaitee", "asc"));
  return onSnapshot(q, versListe(onChange));
}

// Adresse exacte : lisible seulement par le client et le déneigeur choisi
// (firestore.rules, demandes/{id}/prive/adresse).
export async function lireAdressePrivee(demandeId) {
  const snap = await getDoc(doc(db, "demandes", demandeId, "prive", "adresse"));
  return snap.exists() ? snap.data().adresse : null;
}
