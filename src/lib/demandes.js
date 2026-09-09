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
    // Calculé par la Cloud Function de match (Stripe Connect, frais fixe + %) —
    // voir snowro-changements-claude-code.md § 1-2. Jamais posé par le client
    // (bloqué par champsProtegesDemande() dans firestore.rules).
    paiement: null,
  });
}

// Le filtre par villeGeoId est une exclusion dure, jamais un critère de tri —
// voir l'addendum "intégrité du matching géographique" : un déneigeur ne doit
// jamais voir une demande hors de sa ville de service, même proche à vol
// d'oiseau. Le tri par distance ne s'applique qu'à l'intérieur de ce sous-ensemble
// (voir DemandesX.jsx, qui trie ensuite par distanceM).
export function ecouterDemandesOuvertes(villeGeoId, onChange) {
  const q = query(
    collection(db, "demandes"),
    where("villeGeoId", "==", villeGeoId),
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
// TODO (bloquant avant lancement) : une fois l'onboarding Stripe Connect
// construit, empêcher ici (et dans firestore.rules) un déneigeur dont
// connectStatus != "actif" d'accepter une demande.
export function accepterDemande(demandeId, deneigeurId, donneurOuvrageId) {
  return updateDoc(doc(db, "demandes", demandeId), {
    statut: "matchee",
    deneigeurId,
    donneurOuvrageId,
    matchedAt: serverTimestamp(),
  });
}
