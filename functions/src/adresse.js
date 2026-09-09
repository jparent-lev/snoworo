import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./admin.js";
import { GEOCODING_API_KEY, villeDepuisGeohash } from "./geocoding.js";

// Seul point d'écriture pour l'adresse de service et ville/villeGeoId d'un
// déneigeur — mêmes principes que consents/proSubscription : une donnée qui
// détermine le matching ne doit jamais être manipulable directement côté client
// (voir l'addendum "intégrité du matching géographique").
export const mettreAJourAdresseUtilisateur = onCall(
  { region: "northamerica-northeast1", secrets: [GEOCODING_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Connexion requise.");
    }
    const { geohash } = request.data ?? {};
    if (!geohash) {
      throw new HttpsError("invalid-argument", "geohash requis.");
    }

    let derive;
    try {
      derive = await villeDepuisGeohash(geohash);
    } catch (err) {
      throw new HttpsError("failed-precondition", `Impossible de déterminer la ville : ${err.message}`);
    }

    await db.doc(`users/${request.auth.uid}`).update({
      addressGeohash: geohash,
      postalCodePrefix: derive.postalCodePrefix,
      ville: derive.ville,
      villeGeoId: derive.villeGeoId,
    });

    return { ville: derive.ville, villeGeoId: derive.villeGeoId };
  },
);
