import { defineSecret } from "firebase-functions/params";
import geohash from "ngeohash";

// Clé serveur distincte de VITE_GOOGLE_MAPS_API_KEY (client) — jamais exposée
// au bundle frontend. À définir via :
//   firebase functions:secrets:set GOOGLE_GEOCODING_API_KEY
export const GEOCODING_API_KEY = defineSecret("GOOGLE_GEOCODING_API_KEY");

function extraireComposant(components, type) {
  return reparerTexteGoogle(components.find((c) => c.types.includes(type))?.long_name ?? null);
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
  // Quartier pour l'affichage seulement (« À 400 m · Limoilou ») : jamais
  // utilisé pour le matching, qui repose uniquement sur villeGeoId.
  const composants = body.results.flatMap((r) => r.address_components);
  const quartier =
    extraireComposant(composants, "neighborhood") ??
    extraireComposant(composants, "sublocality_level_1") ??
    extraireComposant(composants, "sublocality");

  return {
    ville: villeComponent.long_name,
    villeGeoId: resultatVille.place_id,
    postalCodePrefix: codePostal ? codePostal.replace(/\s/g, "").slice(0, 3).toUpperCase() : null,
    quartier,
  };
}

// Géocodage inverse : position GPS (geohash) -> ville.
export async function villeDepuisGeohash(hash) {
  const { latitude, longitude } = geohash.decode(hash);
  return villeDepuisCoordonnees(latitude, longitude);
}

// Précision exigée pour l'adresse d'une demande : un numéro civique réel
// (résultat de type adresse ou bâtiment, positionné sur le toit ou interpolé
// sur la rue), au Canada. Une rue seule, un code postal ou une ville sont
// refusés : c'est là que le déneigeur se présente.
const TYPES_PRECIS = ["street_address", "premise", "subpremise"];
const POSITIONS_PRECISES = ["ROOFTOP", "RANGE_INTERPOLATED"];

export class AdresseImprecise extends Error {}

function verifierPrecision(resultat) {
  const pays = extraireComposantCourt(resultat.address_components, "country");
  if (pays && pays !== "CA") throw new AdresseImprecise("Adresse hors du Canada.");
  const precis =
    resultat.types?.some((t) => TYPES_PRECIS.includes(t)) &&
    POSITIONS_PRECISES.includes(resultat.geometry?.location_type);
  if (!precis || !extraireComposant(resultat.address_components, "street_number")) {
    throw new AdresseImprecise("Adresse incomplète : il faut le numéro civique et la rue.");
  }
}

function extraireComposantCourt(components, type) {
  return components?.find((c) => c.types.includes(type))?.short_name ?? null;
}

async function depuisResultat(resultat, { exigerPrecision }) {
  if (exigerPrecision) verifierPrecision(resultat);
  const { lat, lng } = resultat.geometry.location;
  const derive = await villeDepuisCoordonnees(lat, lng);
  return {
    ...derive,
    geohash: geohash.encode(lat, lng),
    // Adresse telle que Google la reconnaît (« 1234 3e Avenue, Québec, QC
    // G1L 2M4, Canada ») : c'est elle qu'on montre au déneigeur.
    adresseNormalisee: reparerTexteGoogle(resultat.formatted_address),
    placeId: resultat.place_id,
  };
}

// Géocodage direct : adresse saisie -> ville + geohash. Pour un déneigeur
// (adresse de service), un quartier suffit ; pour une demande,
// `exigerPrecision` refuse tout ce qui n'est pas un numéro civique.
//
// Le géocodage direct (forward) d'une adresse précise ne renvoie généralement
// qu'UN seul résultat, au niveau de l'adresse civique — jamais de résultat
// séparé "localité" avec son propre place_id (contrairement au géocodage
// inverse). On récupère donc seulement les coordonnées ici, puis on délègue
// à villeDepuisCoordonnees (géocodage inverse) pour obtenir un villeGeoId fiable.
export async function villeDepuisAdresse(adresseTexte, { exigerPrecision = false } = {}) {
  const body = await appelerGeocodingApi({ address: adresseTexte, region: "ca", components: "country:CA" });
  if (body.status !== "OK" || !body.results?.length) {
    throw new AdresseImprecise(`Adresse introuvable : ${adresseTexte}`);
  }
  return depuisResultat(body.results[0], { exigerPrecision });
}

// Adresse choisie dans les suggestions (place_id de Google) : aucune
// ambiguïté de saisie possible.
export async function villeDepuisPlaceId(placeId, { exigerPrecision = true } = {}) {
  const body = await appelerGeocodingApi({ place_id: placeId });
  if (body.status !== "OK" || !body.results?.length) {
    throw new AdresseImprecise("Adresse introuvable. Choisis-la de nouveau dans la liste.");
  }
  return depuisResultat(body.results[0], { exigerPrecision });
}

// Suggestions d'adresses pendant la saisie (Places API, « Autocomplete (New) ») :
// Canada seulement, adresses civiques seulement, en français, favorise le
// Québec. `session` regroupe les frappes d'une même saisie (facturation).
const BIAIS_QUEBEC = { rectangle: { low: { latitude: 44.9, longitude: -79.8 }, high: { latitude: 53, longitude: -57 } } };

// Quelques noms de lieux arrivent de Google déjà mal encodés (UTF-8 relu en
// Latin-1), par exemple « Les Ã�Boulements » pour « Les Éboulements », alors
// que « Québec » dans la même réponse est correct : l'erreur est dans leurs
// données, pas dans notre lecture. Si les octets d'origine sont intacts, on
// les relit en UTF-8. Si le second octet est perdu (caractère de
// remplacement), on suppose « É », seule majuscule accentuée courante en
// début de nom au Québec, et on remet en minuscule la lettre suivante, que
// Google a mise en majuscule en croyant à un début de mot.
export function reparerTexteGoogle(texte) {
  if (!texte || !texte.includes("Ã")) return texte;
  let repare = texte.replace(/Ã\uFFFD(\p{Lu})?/gu, (_, lettre) => "É" + (lettre ? lettre.toLowerCase() : ""));
  repare = repare.replace(/(?:[ÂÃ][\u0080-\u00BF])+/g, (bout) => {
    const relu = Buffer.from(bout, "latin1").toString("utf8");
    return relu.includes("\uFFFD") ? bout : relu;
  });
  return repare;
}

export async function suggestionsAdresses(texte, session) {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": GEOCODING_API_KEY.value() },
    body: JSON.stringify({
      input: texte,
      sessionToken: session,
      includedRegionCodes: ["ca"],
      includedPrimaryTypes: TYPES_PRECIS,
      languageCode: "fr-CA",
      locationBias: BIAIS_QUEBEC,
    }),
  });
  const corps = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Places API ${res.status} : ${corps.error?.message ?? "réponse inattendue"}`);
  return (corps.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .slice(0, 5)
    .map((p) => ({
      placeId: p.placeId,
      principal: reparerTexteGoogle(p.structuredFormat?.mainText?.text ?? p.text?.text ?? ""),
      secondaire: reparerTexteGoogle(p.structuredFormat?.secondaryText?.text ?? ""),
    }));
}
