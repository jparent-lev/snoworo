import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { GEOCODING_API_KEY, villeDepuisGeohash } from "./geocoding.js";

// Calcule ville/villeGeoId juste après la création d'une demande — jamais fourni
// par le client (voir firestore.rules : ces champs sont exclus de l'écriture
// directe). Tant que cette fonction n'a pas tourné, la demande n'a pas de
// villeGeoId et n'apparaît donc dans la requête d'aucun déneigeur : préférable
// à un filtre de ville absent ou incertain — voir l'addendum "intégrité du
// matching géographique".
export const calculerVilleDemande = onDocumentCreated(
  { document: "demandes/{demandeId}", region: "northamerica-northeast1", secrets: [GEOCODING_API_KEY] },
  async (event) => {
    const demande = event.data.data();
    if (!demande.adresseGeohash) {
      logger.error(`Demande ${event.params.demandeId} sans adresseGeohash — impossible de dériver la ville.`);
      return;
    }

    try {
      const { ville, villeGeoId } = await villeDepuisGeohash(demande.adresseGeohash);
      await event.data.ref.update({ ville, villeGeoId });
    } catch (err) {
      // Ne jamais faire échouer silencieusement vers une ville incertaine :
      // la demande reste sans villeGeoId et donc invisible au matching plutôt
      // que mal classée dans la mauvaise ville.
      logger.error(`Échec du géocodage pour demande ${event.params.demandeId}: ${err.message}`);
    }
  },
);
