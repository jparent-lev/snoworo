import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin.js";

// Compteur public de l'accueil : nombre de déneigeurs de quartier inscrits par
// ville (ceux qui ont une adresse de service). Seules les villes qui en
// comptent au moins SEUIL_VILLE_PUBLIQUE sont publiées : un petit nombre
// pourrait laisser deviner qui s'est inscrit, et un chiffre très bas
// découragerait plus qu'il n'invite. Un seul document, lisible par tous
// (firestore.rules), écrit seulement ici ; aucun renseignement individuel.
export const SEUIL_VILLE_PUBLIQUE = 10;
export const VILLES_MAX = 8;
const ROLE_DENEIGEUR = "deneigeur_x";

export async function calculerVillesPubliques() {
  const snap = await db.collection("users").where("role", "array-contains", ROLE_DENEIGEUR).select("villeGeoId", "ville").get();
  const parVille = new Map();
  for (const doc of snap.docs) {
    const { villeGeoId, ville } = doc.data();
    if (!villeGeoId || !ville) continue;
    const v = parVille.get(villeGeoId) ?? { nom: ville, deneigeurs: 0 };
    v.deneigeurs += 1;
    parVille.set(villeGeoId, v);
  }
  const villes = [...parVille.values()]
    .filter((v) => v.deneigeurs >= SEUIL_VILLE_PUBLIQUE)
    .sort((a, b) => b.deneigeurs - a.deneigeurs || a.nom.localeCompare(b.nom, "fr"))
    .slice(0, VILLES_MAX);
  await db.doc("statsPubliques/villes").set({ villes, seuil: SEUIL_VILLE_PUBLIQUE, majAt: FieldValue.serverTimestamp() });
  return villes;
}

export const publierVillesPubliques = onSchedule(
  { schedule: "every 60 minutes", timeZone: "America/Toronto", region: "northamerica-northeast1" },
  async () => {
    const villes = await calculerVillesPubliques();
    logger.info(`Compteur public : ${villes.length} ville(s) d'au moins ${SEUIL_VILLE_PUBLIQUE} déneigeurs.`);
  },
);
