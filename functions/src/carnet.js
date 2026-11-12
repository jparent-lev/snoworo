import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { AdresseImprecise, GEOCODING_API_KEY, villeDepuisAdresse, villeDepuisPlaceId } from "./geocoding.js";

// Carnet d'adresses du client (users/{uid}/adresses/{id}) : « Chez moi »,
// « Parents », « Amis »… sans limite pratique. Chaque adresse est ajoutée
// formellement : géocodée ici (numéro civique exigé) et accompagnée d'une
// attestation datée que c'est chez la personne ou chez quelqu'un qui a
// accepté d'être déneigé. Lecture par le propriétaire seulement, écriture par
// ces fonctions seulement (firestore.rules). Effacé avec le compte.
const REGION = "northamerica-northeast1";
// Garde-fou contre les abus, pas une limite d'usage.
export const ADRESSES_MAX = 100;
export const LIENS = new Set(["moi", "proche"]);
// Texte attesté, versionné : une nouvelle formulation se reconnaît.
export const ATTESTATION = {
  version: 1,
  texte: "Cette adresse est chez moi, ou chez une personne qui a accepté d'y être déneigée par l'entremise de Snowro.",
};

function exigerConnexion(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  return request.auth.uid;
}

function texte(valeur, { max, requis = false, nom }) {
  if (valeur == null || valeur === "") {
    if (requis) throw new HttpsError("invalid-argument", `${nom} requis.`);
    return "";
  }
  if (typeof valeur !== "string" || valeur.length > max) {
    throw new HttpsError("invalid-argument", `${nom} invalide (${max} caractères max).`);
  }
  return valeur.trim();
}

// Valide le lien, le prénom sur place et l'attestation (communs au carnet et
// à une adresse ponctuelle saisie dans une demande).
export function validerLieu(d) {
  if (!LIENS.has(d?.lien)) throw new HttpsError("invalid-argument", "Indiquez si c'est chez vous ou chez un proche.");
  if (d.attestation !== true) {
    throw new HttpsError("invalid-argument", "Confirmez que vous avez l'autorisation de faire déneiger cette adresse.");
  }
  const personneSurPlace = d.lien === "proche" ? texte(d.personneSurPlace, { max: 40, nom: "Prénom de la personne sur place" }) : "";
  return { lien: d.lien, personneSurPlace };
}

// Géocode une adresse (suggestion choisie ou texte complet), numéro civique exigé.
export async function geocoderAdresse(d) {
  const placeId = typeof d.placeId === "string" && d.placeId ? d.placeId.slice(0, 300) : null;
  const adresseSaisie = placeId ? "" : texte(d.adresse, { max: 200, requis: true, nom: "Adresse" });
  const unite = texte(d.unite, { max: 20, nom: "Appartement" });
  let lieu;
  try {
    lieu = placeId ? await villeDepuisPlaceId(placeId) : await villeDepuisAdresse(adresseSaisie, { exigerPrecision: true });
  } catch (err) {
    if (err instanceof AdresseImprecise) throw new HttpsError("invalid-argument", err.message);
    throw new HttpsError("failed-precondition", `Adresse introuvable : ${err.message}`);
  }
  const adresseNormalisee = lieu.adresseNormalisee.replace(/, Canada$/, "");
  return {
    adresse: unite ? `${adresseNormalisee} (app. ${unite})` : adresseNormalisee,
    adresseNormalisee,
    unite,
    placeId: lieu.placeId ?? null,
    saisie: placeId ? "suggestion" : "texte",
    geohash: lieu.geohash,
    ville: lieu.ville,
    villeGeoId: lieu.villeGeoId,
    postalCodePrefix: lieu.postalCodePrefix ?? null,
    quartier: lieu.quartier ?? null,
  };
}

// Enregistre une adresse déjà géocodée et attestée dans le carnet.
export async function enregistrerDansCarnet(uid, { nom, lieu, lien, personneSurPlace }) {
  const carnet = db.collection(`users/${uid}/adresses`);
  const n = (await carnet.count().get()).data().count;
  if (n >= ADRESSES_MAX) throw new HttpsError("resource-exhausted", "Carnet d'adresses plein.");
  const ref = carnet.doc();
  await ref.set({
    nom,
    lien,
    personneSurPlace,
    ...lieu,
    attestation: { ...ATTESTATION, at: FieldValue.serverTimestamp() },
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export const ajouterAdresse = onCall({ region: REGION, secrets: [GEOCODING_API_KEY] }, async (request) => {
  const uid = exigerConnexion(request);
  const d = request.data ?? {};
  const nom = texte(d.nom, { max: 40, requis: true, nom: "Nom de l'adresse" });
  const { lien, personneSurPlace } = validerLieu(d);
  const lieu = await geocoderAdresse(d);
  const adresseId = await enregistrerDansCarnet(uid, { nom, lieu, lien, personneSurPlace });
  return { adresseId, adresse: lieu.adresse, ville: lieu.ville };
});

export const supprimerAdresse = onCall({ region: REGION }, async (request) => {
  const uid = exigerConnexion(request);
  const adresseId = request.data?.adresseId;
  if (typeof adresseId !== "string" || !adresseId || adresseId.includes("/")) {
    throw new HttpsError("invalid-argument", "adresseId requis.");
  }
  await db.doc(`users/${uid}/adresses/${adresseId}`).delete();
  return { ok: true };
});

// Pour publierDemande : l'adresse du carnet, ou not-found.
export async function lireAdresseCarnet(uid, adresseId) {
  if (typeof adresseId !== "string" || !adresseId || adresseId.includes("/")) {
    throw new HttpsError("invalid-argument", "Adresse invalide.");
  }
  const snap = await db.doc(`users/${uid}/adresses/${adresseId}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "Cette adresse n'est plus dans votre carnet.");
  return snap.data();
}
