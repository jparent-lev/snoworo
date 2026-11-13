import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import geohash from "ngeohash";
import { db } from "./admin.js";
import { SITES_QC } from "./meteoSites.js";

// Prévisions de neige pour les tableaux de bord (meteo/{villeGeoId}), tirées
// des prévisions officielles par ville d'Environnement et Changement
// climatique Canada (MSC Datamart, Licence du gouvernement ouvert, Canada).
// Le serveur demande la prévision d'une STATION, jamais d'une adresse : aucune
// position d'utilisateur ne sort de Snowro.
//
// https://eccc-msc.github.io/open-data/msc-data/citypage-weather/readme_citypageweather-datamart_fr/
const REGION = "northamerica-northeast1";
const BASE = "https://dd.weather.gc.ca/today/citypage_weather/QC";
const NB_PERIODES = 6;

const decoder = (s) =>
  s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
const premier = (bloc, re) => {
  const m = bloc.match(re);
  return m ? decoder(m[1]) : null;
};

// Accumulation de neige annoncée dans le texte, en cm : { min, max } ou null.
export function accumulationTexte(texte) {
  const t = texte.toLowerCase();
  let m = t.match(/accumulation (?:de|d'environ|d’environ|de près de|totale de) (\d+) (?:à|a) (\d+) cm/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  m = t.match(/accumulation (?:de|d'environ|d’environ|de près de|totale de|d'au plus) (\d+) cm/);
  if (m) return { min: Number(m[1]), max: Number(m[1]) };
  return null;
}

// Fichier XML d'une ville → périodes de prévision (pur, testable).
export function lirePrevision(xml) {
  const emis = premier(xml, /<dateTime name="forecastIssue" zone="UTC"[^>]*>[\s\S]*?<timeStamp>(\d{14})<\/timeStamp>/);
  const blocs = [...xml.matchAll(/<forecast>([\s\S]*?)<\/forecast>/g)].map((m) => m[1]);
  const periodes = blocs.slice(0, NB_PERIODES).map((f) => {
    const nom = premier(f, /<period[^>]*>([^<]*)<\/period>/) ?? "";
    const texte = premier(f, /<textSummary>([^<]*)<\/textSummary>/) ?? "";
    const precip = f.match(/<precipitation>([\s\S]*?)<\/precipitation>/)?.[1] ?? "";
    const types = [...precip.matchAll(/<precipType[^>]*>([^<]*)<\/precipType>/g)].map((m) => m[1].trim().toLowerCase());
    const accXml = [...precip.matchAll(/<accumulation>\s*<name>([^<]*)<\/name>\s*<amount[^>]*>([\d.]+)<\/amount>/g)]
      .filter((m) => m[1].trim() === "snow")
      .map((m) => Number(m[2]))[0];
    const proba = texte.match(/(\d+) pour cent de probabilité[^.]*neige/i);
    const neigeTexte = /neige|flocons|poudrerie/i.test(texte);
    const cm = accumulationTexte(texte) ?? (accXml > 0 ? { min: accXml, max: accXml } : null);
    const neige = cm ? "accumulation" : types.includes("neige") || neigeTexte ? (proba ? "risque" : "neige") : "aucune";
    const temp = f.match(/<temperature[^>]*class="(high|low)"[^>]*>(-?[\d.]+)<\/temperature>/);
    return {
      nom: nom.charAt(0).toUpperCase() + nom.slice(1),
      texte,
      neige,
      cm,
      probabilite: proba ? Number(proba[1]) : null,
      temperature: temp ? { type: temp[1] === "high" ? "max" : "min", valeur: Number(temp[2]) } : null,
    };
  });
  const emiseA = emis ? `${emis.slice(0, 4)}-${emis.slice(4, 6)}-${emis.slice(6, 8)}T${emis.slice(8, 10)}:${emis.slice(10, 12)}:00Z` : null;
  return { emiseA, periodes };
}

function distanceKm(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export function stationLaPlusProche(position) {
  let meilleure = null;
  for (const [code, nom, lat, lon] of SITES_QC) {
    const d = distanceKm(position, { lat, lon });
    if (!meilleure || d < meilleure.distanceKm) meilleure = { code, nom, lat, lon, distanceKm: Math.round(d) };
  }
  return meilleure;
}

// Villes où Snowro a des utilisateurs, avec une position représentative
// (centre approximatif d'un geohash déjà connu) : déneigeurs, carnets
// d'adresses et demandes.
async function villesActives() {
  const villes = new Map();
  const ajouter = (villeGeoId, ville, hash) => {
    if (!villeGeoId || !hash || villes.has(villeGeoId)) return;
    const { latitude, longitude } = geohash.decode(hash);
    villes.set(villeGeoId, { villeGeoId, ville: ville ?? null, lat: latitude, lon: longitude });
  };
  const [users, adresses, demandes] = await Promise.all([
    db.collection("users").select("villeGeoId", "ville", "addressGeohash").get(),
    db.collectionGroup("adresses").select("villeGeoId", "ville", "geohash").get(),
    db.collection("demandes").select("villeGeoId", "ville", "adresseGeohash").get(),
  ]);
  users.docs.forEach((d) => ajouter(d.get("villeGeoId"), d.get("ville"), d.get("addressGeohash")));
  adresses.docs.forEach((d) => ajouter(d.get("villeGeoId"), d.get("ville"), d.get("geohash")));
  demandes.docs.forEach((d) => ajouter(d.get("villeGeoId"), d.get("ville"), d.get("adresseGeohash")));
  return [...villes.values()];
}

// Fichier le plus récent de chaque station, dans les dossiers des 3
// dernières heures (UTC).
async function fichiersRecents(codes, maintenant, recuperer) {
  const trouves = new Map();
  for (let i = 0; i < 3 && trouves.size < codes.size; i++) {
    const heure = String(new Date(maintenant - i * 3600e3).getUTCHours()).padStart(2, "0");
    const res = await recuperer(`${BASE}/${heure}/`);
    if (!res.ok) continue;
    const page = await res.text();
    const noms = [...page.matchAll(/href="([^"]*_MSC_CitypageWeather_(s\d{7})_fr\.xml)"/g)];
    for (const [, nom, code] of noms) {
      if (!codes.has(code)) continue;
      const actuel = trouves.get(code);
      if (!actuel || nom > actuel.nom) trouves.set(code, { nom, url: `${BASE}/${heure}/${nom}` });
    }
  }
  return trouves;
}

// Prévisions des villes données (position connue) → meteo/{villeGeoId}.
async function ecrirePrevisions(villes, maintenant, recuperer) {
  const parVille = villes.map((v) => ({ ...v, station: stationLaPlusProche(v) }));
  const codes = new Set(parVille.map((v) => v.station.code));
  const fichiers = await fichiersRecents(codes, maintenant, recuperer);
  const previsions = new Map();
  for (const [code, { url }] of fichiers) {
    try {
      const res = await recuperer(url);
      if (res.ok) previsions.set(code, lirePrevision(await res.text()));
    } catch (err) {
      logger.warn(`Météo : ${code} illisible (${err.message})`);
    }
  }
  const lot = db.batch();
  let ecrites = 0;
  for (const v of parVille) {
    const p = previsions.get(v.station.code);
    if (!p) continue;
    lot.set(db.doc(`meteo/${v.villeGeoId}`), {
      ville: v.ville,
      station: { code: v.station.code, nom: v.station.nom, distanceKm: v.station.distanceKm },
      lien: `https://meteo.gc.ca/fr/location/index.html?coords=${v.station.lat},${v.station.lon}`,
      emiseA: p.emiseA,
      periodes: p.periodes,
      recupereeAt: FieldValue.serverTimestamp(),
    });
    ecrites++;
  }
  if (ecrites) await lot.commit();
  return { ecrites, stations: fichiers.size };
}

export async function rafraichirMeteoMaintenant({ maintenant = Date.now(), recuperer = fetch } = {}) {
  const villes = await villesActives();
  const { ecrites, stations } = await ecrirePrevisions(villes, maintenant, recuperer);
  logger.info(`Météo : ${ecrites} ville(s) sur ${villes.length}, ${stations} station(s).`);
  return { villes: villes.length, ecrites };
}

// Une ville sans prévision récente (nouvelle adresse, nouvelle demande) : le
// tableau de bord la demande tout de suite plutôt que d'attendre l'heure
// suivante. Rien n'est refait si la prévision a moins de 75 minutes.
export const FRAICHEUR_MS = 75 * 60 * 1000;
async function positionDeLaVille(villeGeoId) {
  const essais = [
    [db.collection("users").where("villeGeoId", "==", villeGeoId).select("ville", "addressGeohash").limit(5), "addressGeohash"],
    [db.collectionGroup("adresses").where("villeGeoId", "==", villeGeoId).select("ville", "geohash").limit(5), "geohash"],
    [db.collection("demandes").where("villeGeoId", "==", villeGeoId).select("ville", "adresseGeohash").limit(5), "adresseGeohash"],
  ];
  for (const [requete, champ] of essais) {
    const doc = (await requete.get()).docs.find((d) => d.get(champ));
    if (doc) {
      const { latitude, longitude } = geohash.decode(doc.get(champ));
      return { villeGeoId, ville: doc.get("ville") ?? null, lat: latitude, lon: longitude };
    }
  }
  return null;
}

export async function prevoirVilleMaintenant(villeGeoId, { maintenant = Date.now(), recuperer = fetch } = {}) {
  const actuelle = (await db.doc(`meteo/${villeGeoId}`).get()).data();
  const age = maintenant - (actuelle?.recupereeAt?.toMillis?.() ?? 0);
  if (actuelle && age < FRAICHEUR_MS) return { aJour: true };
  const position = await positionDeLaVille(villeGeoId);
  if (!position) return { aJour: false, ecrites: 0 };
  const { ecrites } = await ecrirePrevisions([position], maintenant, recuperer);
  return { aJour: false, ecrites };
}

export const prevoirVille = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  const { villeGeoId } = request.data ?? {};
  if (typeof villeGeoId !== "string" || !villeGeoId || villeGeoId.length > 200 || villeGeoId.includes("/")) {
    throw new HttpsError("invalid-argument", "Ville invalide.");
  }
  return prevoirVilleMaintenant(villeGeoId);
});

export const rafraichirMeteo = onSchedule({ schedule: "every 60 minutes", region: REGION, timeZone: "America/Toronto" }, async () => {
  await rafraichirMeteoMaintenant();
});
