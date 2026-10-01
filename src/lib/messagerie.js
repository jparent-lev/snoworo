import { addDoc, collection, doc, limitToLast, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { millis } from "./temps";

// Messagerie entre le client et le déneigeur d'une job acceptée.
// messages/{demandeId}/messages : lecture et écriture réservées aux deux
// personnes du match (firestore.rules) ; écriture seulement pendant la job.
export const LONGUEUR_MAX = 1000;
export const STATUTS_ECRITURE = ["matchee", "faite", "signalee"];

export function ecouterMessages(demandeId, onChange, onErreur) {
  const q = query(collection(db, "messages", demandeId, "messages"), orderBy("createdAt", "asc"), limitToLast(200));
  // Le message qu'on vient d'envoyer arrive d'abord sans heure serveur
  // (estimation locale) : il s'affiche tout de suite, en bas de la liste.
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))),
    onErreur,
  );
}

export function envoyerMessage(demandeId, uid, contenu) {
  return addDoc(collection(db, "messages", demandeId, "messages"), {
    expediteurId: uid,
    contenu,
    createdAt: serverTimestamp(),
  });
}

// Dernière lecture de chaque conversation, pour l'indicateur « nouveau ».
export function ecouterLectures(uid, onChange) {
  return onSnapshot(collection(db, "users", uid, "lectures"), (snap) =>
    onChange(Object.fromEntries(snap.docs.map((d) => [d.id, d.data({ serverTimestamps: "estimate" }).luAt]))),
  );
}

export function marquerLu(uid, demandeId) {
  return setDoc(doc(db, "users", uid, "lectures", demandeId), { luAt: serverTimestamp() });
}

// `dernierMessage` est recopié dans la demande par la Cloud Function
// notifierNouveauMessage.
export function aNouveauMessage(demande, uid, lectures) {
  const dernier = demande.dernierMessage;
  if (!dernier || dernier.par === uid) return false;
  return millis(dernier.at) > millis(lectures?.[demande.id]);
}
