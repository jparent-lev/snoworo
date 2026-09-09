import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

export function publierDemande({
  donneurOuvrageId,
  donneurPrenom,
  adresseGeohash,
  postalCodePrefix,
  quartier,
  titre,
  description,
  dateHeureSouhaitee,
  typeService,
  remunerationOfferte,
}) {
  return addDoc(collection(db, "demandes"), {
    donneurOuvrageId,
    donneurPrenom,
    statut: "ouverte",
    adresseGeohash,
    postalCodePrefix,
    quartier,
    titre,
    description,
    dateHeureSouhaitee,
    typeService,
    remunerationOfferte,
    createdAt: serverTimestamp(),
    deneigeurId: null,
    matchedAt: null,
    fraisMiseEnRelation: null,
  });
}

export function ecouterDemandesOuvertes(onChange) {
  const q = query(
    collection(db, "demandes"),
    where("statut", "==", "ouverte"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// Le premier déneigeur qui accepte devient le match. Les Firestore rules
// n'autorisent la transition que depuis "ouverte" — si un autre a déjà
// accepté, cette écriture est rejetée (permission-denied) et l'appelant doit
// afficher "déjà prise" plutôt qu'une erreur générique.
export function accepterDemande(demandeId, deneigeurId, donneurOuvrageId) {
  return updateDoc(doc(db, "demandes", demandeId), {
    statut: "matchee",
    deneigeurId,
    donneurOuvrageId,
    matchedAt: serverTimestamp(),
  });
}
