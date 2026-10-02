import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./admin.js";
import { AdresseImprecise, GEOCODING_API_KEY, villeDepuisAdresse, villeDepuisGeohash, villeDepuisPlaceId } from "./geocoding.js";

// Seul point d'écriture pour l'adresse de service et ville/villeGeoId d'un
// déneigeur — mêmes principes que consents/proSubscription : une donnée qui
// détermine le matching ne doit jamais être manipulable directement côté client
// (voir l'addendum "intégrité du matching géographique").
//
// Trois façons d'appeler, comme pour l'adresse d'une demande :
// - `{ placeId }` : adresse choisie dans les suggestions (le cas normal) ;
// - `{ adresse }` : écrite au complet quand elle n'est pas dans la liste ;
//   elle doit alors être précise (numéro civique), sinon c'est refusé ;
// - `{ geohash }` : position GPS, déjà encodée côté client.
// Dans tous les cas, ville/villeGeoId viennent du géocodage serveur, jamais
// de la saisie brute.
export const mettreAJourAdresseUtilisateur = onCall(
  { region: "northamerica-northeast1", secrets: [GEOCODING_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Connexion requise.");
    }
    const { geohash, adresse, placeId } = request.data ?? {};
    if (!geohash && !adresse?.trim() && !placeId) {
      throw new HttpsError("invalid-argument", "placeId, adresse ou geohash requis.");
    }

    let derive;
    try {
      if (placeId) derive = await villeDepuisPlaceId(String(placeId));
      else if (adresse?.trim()) derive = await villeDepuisAdresse(adresse.trim(), { exigerPrecision: true });
      else derive = await villeDepuisGeohash(geohash);
    } catch (err) {
      if (err instanceof AdresseImprecise) throw new HttpsError("invalid-argument", err.message);
      throw new HttpsError("failed-precondition", `Impossible de déterminer la ville : ${err.message}`);
    }

    await db.doc(`users/${request.auth.uid}`).update({
      addressGeohash: placeId || adresse?.trim() ? derive.geohash : geohash,
      postalCodePrefix: derive.postalCodePrefix,
      ville: derive.ville,
      villeGeoId: derive.villeGeoId,
    });

    return { ville: derive.ville, villeGeoId: derive.villeGeoId };
  },
);
