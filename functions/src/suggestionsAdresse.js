import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { GEOCODING_API_KEY, suggestionsAdresses } from "./geocoding.js";

// Suggestions d'adresses pendant la saisie (formulaire « Publier une
// demande »). Passe par le serveur pour que la clé Google ne soit jamais dans
// le site, et réservé aux personnes connectées.
export const suggererAdresses = onCall(
  { region: "northamerica-northeast1", secrets: [GEOCODING_API_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
    const texte = typeof request.data?.texte === "string" ? request.data.texte.trim() : "";
    const session = typeof request.data?.session === "string" ? request.data.session.slice(0, 64) : undefined;
    if (texte.length < 3 || texte.length > 120) return { suggestions: [] };
    try {
      return { suggestions: await suggestionsAdresses(texte, session) };
    } catch (err) {
      logger.error(`Suggestions d'adresses : ${err.message}`);
      throw new HttpsError("unavailable", "suggestions-indisponibles");
    }
  },
);
