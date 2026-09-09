import { defineSecret } from "firebase-functions/params";
import geohash from "ngeohash";

// Clé serveur distincte de VITE_GOOGLE_MAPS_API_KEY (client) — jamais exposée
// au bundle frontend. À définir via :
//   firebase functions:secrets:set GOOGLE_GEOCODING_API_KEY
export const GEOCODING_API_KEY = defineSecret("GOOGLE_GEOCODING_API_KEY");

function extraireComposant(components, type) {
  return components.find((c) => c.types.includes(type))?.long_name ?? null;
}

// Extrait ville/villeGeoId/postalCodePrefix d'une réponse Geocoding API (forward
// ou reverse — même structure de résultats dans les deux cas). villeGeoId =
// place_id Google du composant "locality" — un identifiant stable et non-ambigu
// (contrairement à comparer des chaînes "Québec" vs "Ville de Québec").
// Ne retourne jamais de résultat partiel : un géocodage qui ne trouve pas de
// ville doit faire échouer l'appelant plutôt que produire un villeGeoId
// incertain — voir l'addendum "intégrité du matching géographique" : le filtre
// de ville n'est jamais optionnel.
function extraireVille(body, contexte) {
  if (body.status !== "OK" || !body.results?.length) {
    throw new Error(`Géocodage échoué (${body.status}) pour ${contexte}`);
  }

  // Le géocodage renvoie plusieurs résultats, à des granularités différentes
  // (adresse précise, quartier, ville, région...). Le résultat dont `types` EST
  // exactement la localité porte le place_id stable de cette ville — les
  // `address_components` d'un résultat plus précis (ex. adresse civique)
  // n'ont pas ce place_id, seulement le nom.
  const resultatVille = body.results.find((r) => r.types.includes("locality"));
  if (!resultatVille) {
    throw new Error(`Aucune localité (ville) trouvée pour ${contexte}`);
  }

  const villeComponent = resultatVille.address_components.find((c) => c.types.includes("locality"));
  const codePostal = extraireComposant(body.results[0].address_components, "postal_code");
  const { lat, lng } = body.results[0].geometry.location;

  return {
    ville: villeComponent.long_name,
    villeGeoId: resultatVille.place_id,
    postalCodePrefix: codePostal ? codePostal.replace(/\s/g, "").slice(0, 3).toUpperCase() : null,
    geohash: geohash.encode(lat, lng),
  };
}

async function appelerGeocodingApi(params) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", GEOCODING_API_KEY.value());
  url.searchParams.set("language", "fr-CA");
  const res = await fetch(url);
  return res.json();
}

// Géocodage inverse : position GPS (geohash) -> ville.
export async function villeDepuisGeohash(hash) {
  const { latitude, longitude } = geohash.decode(hash);
  const body = await appelerGeocodingApi({ latlng: `${latitude},${longitude}` });
  const { geohash: _ignore, ...reste } = extraireVille(body, `${latitude},${longitude}`);
  return reste;
}

// Géocodage direct : adresse saisie manuellement -> ville + geohash (pour les
// déneigeurs qui préfèrent taper leur adresse plutôt que partager leur position,
// ou dont la géolocalisation échoue/est refusée).
export async function villeDepuisAdresse(adresseTexte) {
  const body = await appelerGeocodingApi({ address: `${adresseTexte}, Québec, Canada` });
  return extraireVille(body, adresseTexte);
}
