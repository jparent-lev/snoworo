import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./admin.js";
import { GEOCODING_API_KEY, villeDepuisAdresse, villeDepuisGeohash } from "./geocoding.js";

// Seul point d'écriture pour l'adresse de service et ville/villeGeoId d'un
// déneigeur — mêmes principes que consents/proSubscription : une donnée qui
// détermine le matching ne doit jamais être manipulable directement côté client
// (voir l'addendum "intégrité du matching géographique").
//
// Deux façons d'appeler : `{ geohash }` (position GPS, déjà encodée côté client)
// ou `{ adresse }` (texte libre saisi manuellement — utile quand la
// géolocalisation échoue, est refusée, ou que le déneigeur préfère taper son
// adresse). Dans les deux cas, ville/villeGeoId viennent du même géocodage
// serveur — jamais de la saisie brute.
export const mettreAJourAdresseUtilisateur = onCall(
  { region: "northamerica-northeast1", secrets: [GEOCODING_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Connexion requise.");
    }
    const { geohash, adresse } = request.data ?? {};
    if (!geohash && !adresse?.trim()) {
      throw new HttpsError("invalid-argument", "geohash ou adresse requis.");
    }

    let derive;
    try {
      derive = geohash ? await villeDepuisGeohash(geohash) : await villeDepuisAdresse(adresse.trim());
    } catch (err) {
      throw new HttpsError("failed-precondition", `Impossible de déterminer la ville : ${err.message}`);
    }

    await db.doc(`users/${request.auth.uid}`).update({
      addressGeohash: geohash ?? derive.geohash,
      postalCodePrefix: derive.postalCodePrefix,
      ville: derive.ville,
      villeGeoId: derive.villeGeoId,
    });

    return { ville: derive.ville, villeGeoId: derive.villeGeoId };
  },
);
