import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { GEOCODING_API_KEY, villeDepuisAdresse } from "./geocoding.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_POSTAL_REGEX = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
// « pro » : entreprise de déneigement intéressée par Snowro Pro. Son entrée
// est distincte de celle du même courriel comme client ou déneigeur
// (listeAttente/pro:{courriel}), pour que la liste se segmente sans qu'une
// inscription écrase l'autre.
const ROLES = new Set(["client", "deneigeur", "pro"]);
export const idListeAttente = (courriel, role) => (role === "pro" ? `pro:${courriel}` : courriel);

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
    if (!ROLES.has(role)) {
      throw new HttpsError("invalid-argument", "Rôle invalide.");
    }
    const entreprise = typeof request.data?.entreprise === "string" ? request.data.entreprise.trim() : "";
    if (role === "pro" && (entreprise.length < 2 || entreprise.length > 120)) {
      throw new HttpsError("invalid-argument", "Nom de l'entreprise requis.");
    }

    let derive;
    try {
      derive = await villeDepuisAdresse(codePostal.trim());
    } catch (err) {
      throw new HttpsError("failed-precondition", `Code postal introuvable : ${err.message}`);
    }

    const courrielNormalise = courriel.trim().toLowerCase();
    // L'email comme identifiant de document (préfixé « pro: » pour Pro) : une
    // réinscription (ex. changement de ville, ou client devenu déneigeur) met
    // à jour l'entrée existante plutôt que d'en créer une deuxième.
    await db.doc(`listeAttente/${idListeAttente(courrielNormalise, role)}`).set(
      {
        courriel: courrielNormalise,
        codePostal: codePostal.trim().toUpperCase(),
        role,
        ...(role === "pro" ? { entreprise } : {}),
        ville: derive.ville,
        villeGeoId: derive.villeGeoId,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // `ville` sert au message de partage affiché après l'inscription
    // (src/pages/landing/PartageListe.jsx).
    return { ok: true, ville: derive.ville };
  },
);
