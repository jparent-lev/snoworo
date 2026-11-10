import { onCall, HttpsError } from "firebase-functions/v2/https";
import { randomBytes } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { GEOCODING_API_KEY, villeDepuisAdresse } from "./geocoding.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_POSTAL_REGEX = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
// « pro » : entreprise de déneigement intéressée par Snowro Pro. Son entrée
// est distincte de celle du même courriel comme client ou déneigeur
// (listeAttente/pro:{courriel}), pour que la liste se segmente sans qu'une
// inscription écrase l'autre.
// Le rôle est facultatif : l'inscription simple n'en a pas, et la personne
// peut le préciser ensuite (même appel, même courriel). « les_deux » : faire
// déneiger et déneiger.
const ROLES = new Set(["client", "deneigeur", "les_deux", "pro"]);
export const idListeAttente = (courriel, role) => (role === "pro" ? `pro:${courriel}` : courriel);

// Double confirmation (anti-pourriel) : une inscription ne compte qu'une fois
// le lien du courriel cliqué (confirmee: true). Le lien vaut 7 jours ; un
// nouveau lien part au plus toutes les 10 minutes pour la même adresse. Une
// inscription jamais confirmée est effacée après 7 jours (purgerConservation).
// Les entrées antérieures à la double confirmation (sans champ `confirmee`)
// sont considérées comme confirmées.
export const VALIDITE_LIEN_MS = 7 * 24 * 60 * 60 * 1000;
export const DELAI_RENVOI_MS = 10 * 60 * 1000;
const estConfirmee = (entree) => Boolean(entree) && entree.confirmee !== false;

// Point d'entrée public (aucune authentification requise) du site vitrine de
// pré-lancement — voir design_handoff_snowro_site/README.md § State Management.
// Géocode le code postal côté serveur pour dériver ville/villeGeoId, même
// principe que le reste de l'app : jamais fourni par le client.
export const rejoindreListeAttente = onCall(
  { region: "northamerica-northeast1", secrets: [GEOCODING_API_KEY] },
  async (request) => {
    const { courriel, codePostal, role, siteWeb } = request.data ?? {};
    const nom = typeof request.data?.nom === "string" ? request.data.nom.trim().replace(/\s+/g, " ") : "";

    // Honeypot anti-spam : champ invisible pour un humain (voir WaitlistForm),
    // seul un bot le remplit. Faux succès silencieux, rien n'est écrit.
    if (siteWeb) {
      return { ok: true };
    }

    if (typeof courriel !== "string" || !EMAIL_REGEX.test(courriel.trim())) {
      throw new HttpsError("invalid-argument", "Courriel invalide.");
    }
    if (nom.length < 2 || nom.length > 120) {
      throw new HttpsError("invalid-argument", "Nom complet requis.");
    }
    if (typeof codePostal !== "string" || !CODE_POSTAL_REGEX.test(codePostal.trim())) {
      throw new HttpsError("invalid-argument", "Code postal invalide.");
    }
    if (role != null && !ROLES.has(role)) {
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
    const ref = db.doc(`listeAttente/${idListeAttente(courrielNormalise, role)}`);
    const existante = (await ref.get()).data();
    const confirmee = estConfirmee(existante);
    // Nouveau lien de confirmation : première inscription, ou dernier envoi
    // vieux de plus de 10 minutes (pas de rafale de courriels).
    const maintenant = Date.now();
    const nouveauLien =
      !confirmee && maintenant - (existante?.jetonEnvoyeAt?.toMillis?.() ?? 0) > DELAI_RENVOI_MS;
    await ref.set(
      {
        nom,
        courriel: courrielNormalise,
        codePostal: codePostal.trim().toUpperCase(),
        // Sans rôle : on n'écrase pas celui déjà précisé (merge).
        ...(role ? { role } : {}),
        ...(role === "pro" ? { entreprise } : {}),
        ville: derive.ville,
        villeGeoId: derive.villeGeoId,
        createdAt: FieldValue.serverTimestamp(),
        ...(existante && confirmee ? {} : { confirmee: false }),
        // Le courriel part depuis envoyerConfirmationListeAttente quand le
        // jeton change (functions/src/confirmationListeAttente.js).
        ...(nouveauLien
          ? {
              jetonConfirmation: randomBytes(24).toString("hex"),
              jetonEnvoyeAt: Timestamp.fromMillis(maintenant),
              jetonExpireAt: Timestamp.fromMillis(maintenant + VALIDITE_LIEN_MS),
            }
          : {}),
      },
      { merge: true },
    );

    // `ville` sert au message de partage affiché après l'inscription
    // (src/pages/landing/PartageListe.jsx).
    return { ok: true, ville: derive.ville, confirmationRequise: !confirmee };
  },
);

// Lien du courriel de confirmation (/liste/confirmer?c=…&j=…). Public.
export const confirmerListeAttente = onCall({ region: "northamerica-northeast1" }, async (request) => {
  const { c, j } = request.data ?? {};
  if (typeof c !== "string" || typeof j !== "string" || !c || c.length > 320 || !/^[0-9a-f]{48}$/.test(j)) {
    throw new HttpsError("invalid-argument", "lien-invalide");
  }
  const ref = db.doc(`listeAttente/${c}`);
  return db.runTransaction(async (tx) => {
    const entree = (await tx.get(ref)).data();
    if (!entree) throw new HttpsError("not-found", "lien-invalide");
    const prenom = (entree.nom ?? "").split(" ")[0] || null;
    if (estConfirmee(entree)) return { ok: true, deja: true, prenom, ville: entree.ville ?? null };
    if (entree.jetonConfirmation !== j) throw new HttpsError("failed-precondition", "lien-invalide");
    if ((entree.jetonExpireAt?.toMillis?.() ?? 0) < Date.now()) throw new HttpsError("failed-precondition", "lien-expire");
    tx.update(ref, {
      confirmee: true,
      confirmeeAt: FieldValue.serverTimestamp(),
      jetonConfirmation: FieldValue.delete(),
      jetonEnvoyeAt: FieldValue.delete(),
      jetonExpireAt: FieldValue.delete(),
    });
    return { ok: true, deja: false, prenom, ville: entree.ville ?? null };
  });
});
