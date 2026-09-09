import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { GEOCODING_API_KEY, villeDepuisAdresse } from "./geocoding.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_POSTAL_REGEX = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

// Point d'entrée public (aucune authentification requise) du site vitrine de
// pré-lancement — voir design_handoff_snowro_site/README.md § State Management.
// Géocode le code postal côté serveur pour dériver ville/villeGeoId, même
// principe que le reste de l'app : jamais fourni par le client.
export const rejoindreListeAttente = onCall(
  { region: "northamerica-northeast1", secrets: [GEOCODING_API_KEY] },
  async (request) => {
    const { courriel, codePostal, role, siteWeb } = request.data ?? {};

    // Honeypot anti-spam : champ invisible pour un humain (voir WaitlistForm),
    // seul un bot le remplit. Faux succès silencieux, rien n'est écrit.
    if (siteWeb) {
      return { ok: true };
    }

    if (typeof courriel !== "string" || !EMAIL_REGEX.test(courriel.trim())) {
      throw new HttpsError("invalid-argument", "Courriel invalide.");
    }
    if (typeof codePostal !== "string" || !CODE_POSTAL_REGEX.test(codePostal.trim())) {
      throw new HttpsError("invalid-argument", "Code postal invalide.");
    }
    if (role !== "client" && role !== "deneigeur") {
      throw new HttpsError("invalid-argument", "Rôle invalide.");
    }

    let derive;
    try {
      derive = await villeDepuisAdresse(codePostal.trim());
    } catch (err) {
      throw new HttpsError("failed-precondition", `Code postal introuvable : ${err.message}`);
    }

    const courrielNormalise = courriel.trim().toLowerCase();
    // L'email comme identifiant de document : une réinscription (ex. changement
    // de ville ou de rôle) met à jour l'entrée existante plutôt que d'en créer
    // une deuxième.
    await db.doc(`listeAttente/${courrielNormalise}`).set(
      {
        courriel: courrielNormalise,
        codePostal: codePostal.trim().toUpperCase(),
        role,
        ville: derive.ville,
        villeGeoId: derive.villeGeoId,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { ok: true };
  },
);
