import { defineSecret } from "firebase-functions/params";
import geohash from "ngeohash";

// Clé serveur distincte de VITE_GOOGLE_MAPS_API_KEY (client) — jamais exposée
// au bundle frontend. À définir via :
//   firebase functions:secrets:set GOOGLE_GEOCODING_API_KEY
export const GEOCODING_API_KEY = defineSecret("GOOGLE_GEOCODING_API_KEY");

function extraireComposant(components, type) {
  return components.find((c) => c.types.includes(type))?.long_name ?? null;
}

// Dérive ville/villeGeoId à partir d'un geohash, par géocodage inverse Google Maps.
// villeGeoId = place_id Google du composant "locality" — un identifiant stable
// et non-ambigu (contrairement à comparer des chaînes "Québec" vs "Ville de Québec").
// Ne retourne jamais de résultat partiel : un géocodage qui ne trouve pas de ville
// doit faire échouer l'appelant plutôt que produire un villeGeoId incertain — voir
// l'addendum "intégrité du matching géographique" : le filtre de ville n'est jamais optionnel.
export async function villeDepuisGeohash(hash) {
  const { latitude, longitude } = geohash.decode(hash);
  const apiKey = GEOCODING_API_KEY.value();

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${latitude},${longitude}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("language", "fr-CA");

  const res = await fetch(url);
  const body = await res.json();

  if (body.status !== "OK" || !body.results?.length) {
    throw new Error(`Géocodage échoué (${body.status}) pour ${latitude},${longitude}`);
  }

  // Le reverse-geocode renvoie plusieurs résultats, à des granularités différentes
  // (adresse précise, quartier, ville, région...). Le résultat dont `types` EST
  // exactement la localité porte le place_id stable de cette ville — les
  // `address_components` d'un résultat plus précis (ex. adresse civique)
  // n'ont pas ce place_id, seulement le nom.
  const resultatVille = body.results.find((r) => r.types.includes("locality"));

  if (!resultatVille) {
    throw new Error(`Aucune localité (ville) trouvée pour ${latitude},${longitude}`);
  }

  const villeComponent = resultatVille.address_components.find((c) => c.types.includes("locality"));
  const codePostal = extraireComposant(body.results[0].address_components, "postal_code");

  return {
    ville: villeComponent.long_name,
    villeGeoId: resultatVille.place_id,
    postalCodePrefix: codePostal ? codePostal.replace(/\s/g, "").slice(0, 3).toUpperCase() : null,
  };
}
