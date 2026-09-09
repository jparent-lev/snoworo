import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./admin.js";

function debutDeSemaine(date) {
  const jour = (date.getUTCDay() + 6) % 7; // lundi = 0
  const lundi = new Date(date);
  lundi.setUTCDate(date.getUTCDate() - jour);
  lundi.setUTCHours(0, 0, 0, 0);
  return lundi;
}

function nouvelAgregat() {
  return { nbDemandesOuvertes: 0, nbDemandesCompletees: 0, sommeRemuneration: 0, nbRemunerees: 0 };
}

function accumuler(agg, demande) {
  if (demande.statut === "ouverte" || demande.statut === "matchee") agg.nbDemandesOuvertes += 1;
  if (demande.statut === "completee") {
    agg.nbDemandesCompletees += 1;
    if (typeof demande.remunerationOfferte === "number") {
      agg.sommeRemuneration += demande.remunerationOfferte;
      agg.nbRemunerees += 1;
    }
  }
}

// Régénère les agrégats anonymisés (par préfixe de code postal et par ville),
// une fois par semaine. Aucune requête individuelle sur `demandes` ne doit
// exposer ces chiffres côté client — voir firestore.rules (lecture Pro
// seulement, écriture jamais côté client) et docs/architecture.md (Loi 25 :
// agrégation à la source pour éviter la désanonymisation).
export const regenererZonesStats = onSchedule(
  { schedule: "every monday 03:00", timeZone: "America/Toronto", region: "northamerica-northeast1" },
  async () => {
    const semaineDebut = debutDeSemaine(new Date());
    const finSemaine = new Date(semaineDebut);
    finSemaine.setUTCDate(finSemaine.getUTCDate() + 7);
    const semaineStr = semaineDebut.toISOString().slice(0, 10);

    const snap = await db
      .collection("demandes")
      .where("createdAt", ">=", semaineDebut)
      .where("createdAt", "<", finSemaine)
      .get();

    const parZone = new Map();
    const parVille = new Map(); // clé = villeGeoId, garde aussi le nom d'affichage

    for (const doc of snap.docs) {
      const d = doc.data();

      if (d.postalCodePrefix) {
        if (!parZone.has(d.postalCodePrefix)) parZone.set(d.postalCodePrefix, nouvelAgregat());
        accumuler(parZone.get(d.postalCodePrefix), d);
      }

      // villeGeoId peut être absent brièvement (géocodage pas encore terminé) —
      // ces demandes sont simplement exclues de l'agrégat par ville cette semaine-là.
      if (d.villeGeoId) {
        if (!parVille.has(d.villeGeoId)) {
          parVille.set(d.villeGeoId, { ville: d.ville ?? null, agg: nouvelAgregat() });
        }
        accumuler(parVille.get(d.villeGeoId).agg, d);
      }
    }

    const writesZones = [...parZone.entries()].map(([zone, agg]) =>
      db.doc(`zonesStats/${zone}_${semaineStr}`).set({
        postalCodePrefix: zone,
        semaineDebut,
        nbDemandesOuvertes: agg.nbDemandesOuvertes,
        nbDemandesCompletees: agg.nbDemandesCompletees,
        remunerationMoyenne: agg.nbRemunerees > 0 ? agg.sommeRemuneration / agg.nbRemunerees : 0,
      }),
    );

    const writesVilles = [...parVille.entries()].map(([villeGeoId, { ville, agg }]) =>
      db.doc(`zonesStatsParVille/${villeGeoId}_${semaineStr}`).set({
        villeGeoId,
        ville,
        semaineDebut,
        nbDemandesOuvertes: agg.nbDemandesOuvertes,
        nbDemandesCompletees: agg.nbDemandesCompletees,
        remunerationMoyenne: agg.nbRemunerees > 0 ? agg.sommeRemuneration / agg.nbRemunerees : 0,
      }),
    );

    await Promise.all([...writesZones, ...writesVilles]);
  },
);
