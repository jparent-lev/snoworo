import { defineSecret } from "firebase-functions/params";
import geohash from "ngeohash";

// Clé serveur distincte de VITE_GOOGLE_MAPS_API_KEY (client) — jamais exposée
// au bundle frontend. À définir via :
//   firebase functions:secrets:set GOOGLE_GEOCODING_API_KEY
export const GEOCODING_API_KEY = defineSecret("GOOGLE_GEOCODING_API_KEY");

function extraireComposant(components, type) {
  return components.find((c) => c.types.includes(type))?.long_name ?? null;
}

async function appelerGeocodingApi(params) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", GEOCODING_API_KEY.value());
  url.searchParams.set("language", "fr-CA");
  const res = await fetch(url);
  return res.json();
}

// Dérive ville/villeGeoId/postalCodePrefix à partir de coordonnées, par
// géocodage INVERSE Google (seul mode qui renvoie la hiérarchie complète de
// résultats — adresse précise, quartier, ville, région — avec un résultat
// dont `types` EST exactement la localité, porteur de son place_id stable).
// villeGeoId = ce place_id — un identifiant non-ambigu, jamais une comparaison
// de chaînes ("Québec" vs "Ville de Québec" sont des pièges classiques).
// Ne retourne jamais de résultat partiel : un géocodage qui ne trouve pas de
// ville doit faire échouer l'appelant plutôt que produire un villeGeoId
// incertain — voir l'addendum "intégrité du matching géographique" : le filtre
// de ville n'est jamais optionnel.
async function villeDepuisCoordonnees(latitude, longitude) {
  const body = await appelerGeocodingApi({ latlng: `${latitude},${longitude}` });
  if (body.status !== "OK" || !body.results?.length) {
    throw new Error(`Géocodage inverse échoué (${body.status}) pour ${latitude},${longitude}`);
  }

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

// Géocodage inverse : position GPS (geohash) -> ville.
export async function villeDepuisGeohash(hash) {
  const { latitude, longitude } = geohash.decode(hash);
  return villeDepuisCoordonnees(latitude, longitude);
}

// Géocodage direct : adresse saisie manuellement -> ville + geohash (pour les
// déneigeurs qui préfèrent taper leur adresse plutôt que partager leur position,
// ou dont la géolocalisation échoue/est refusée).
//
// Le géocodage direct (forward) d'une adresse précise ne renvoie généralement
// qu'UN seul résultat, au niveau de l'adresse civique — jamais de résultat
// séparé "localité" avec son propre place_id (contrairement au géocodage
// inverse). On récupère donc seulement les coordonnées ici, puis on délègue
// à villeDepuisCoordonnees (géocodage inverse) pour obtenir un villeGeoId fiable.
export async function villeDepuisAdresse(adresseTexte) {
  const body = await appelerGeocodingApi({ address: adresseTexte, region: "ca" });
  if (body.status !== "OK" || !body.results?.length) {
    throw new Error(`Adresse introuvable (${body.status}) : ${adresseTexte}`);
  }

  const { lat, lng } = body.results[0].geometry.location;
  const derive = await villeDepuisCoordonnees(lat, lng);
  return { ...derive, geohash: geohash.encode(lat, lng) };
}
