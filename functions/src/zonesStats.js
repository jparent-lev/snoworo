import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./admin.js";

function debutDeSemaine(date) {
  const jour = (date.getUTCDay() + 6) % 7; // lundi = 0
  const lundi = new Date(date);
  lundi.setUTCDate(date.getUTCDate() - jour);
  lundi.setUTCHours(0, 0, 0, 0);
  return lundi;
}

// Régénère l'agrégat anonymisé par zone, une fois par semaine. Aucune requête
// individuelle sur `demandes` ne doit exposer ces chiffres côté client — voir
// firestore.rules (zonesStats en lecture Pro seulement, écriture jamais côté client)
// et docs/architecture.md (Loi 25 : agrégation à la source pour éviter la désanonymisation).
export const regenererZonesStats = onSchedule(
  { schedule: "every monday 03:00", timeZone: "America/Toronto", region: "northamerica-northeast1" },
  async () => {
    const semaineDebut = debutDeSemaine(new Date());
    const finSemaine = new Date(semaineDebut);
    finSemaine.setUTCDate(finSemaine.getUTCDate() + 7);

    const snap = await db
      .collection("demandes")
      .where("createdAt", ">=", semaineDebut)
      .where("createdAt", "<", finSemaine)
      .get();

    const parZone = new Map();
    for (const doc of snap.docs) {
      const d = doc.data();
      const zone = d.postalCodePrefix;
      if (!zone) continue;

      if (!parZone.has(zone)) {
        parZone.set(zone, { nbDemandesOuvertes: 0, nbDemandesCompletees: 0, sommeRemuneration: 0, nbRemunerees: 0 });
      }
      const agg = parZone.get(zone);

      if (d.statut === "ouverte" || d.statut === "matchee") agg.nbDemandesOuvertes += 1;
      if (d.statut === "completee") {
        agg.nbDemandesCompletees += 1;
        if (typeof d.remunerationOfferte === "number") {
          agg.sommeRemuneration += d.remunerationOfferte;
          agg.nbRemunerees += 1;
        }
      }
    }

    const cle = (zone) => `${zone}_${semaineDebut.toISOString().slice(0, 10)}`;
    const writes = [...parZone.entries()].map(([zone, agg]) =>
      db.doc(`zonesStats/${cle(zone)}`).set({
        postalCodePrefix: zone,
        semaineDebut,
        nbDemandesOuvertes: agg.nbDemandesOuvertes,
        nbDemandesCompletees: agg.nbDemandesCompletees,
        remunerationMoyenne: agg.nbRemunerees > 0 ? agg.sommeRemuneration / agg.nbRemunerees : 0,
      }),
    );

    await Promise.all(writes);
  },
);
