import geohash from "ngeohash";

export function encoderGeohash(latitude, longitude) {
  return geohash.encode(latitude, longitude);
}

export function decoderGeohash(hash) {
  const { latitude, longitude } = geohash.decode(hash);
  return { latitude, longitude };
}

// Haversine — précision suffisante pour un affichage "à N m", pas pour du routage.
export function distanceMetres(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
