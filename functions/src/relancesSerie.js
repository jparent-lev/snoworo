import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineBoolean } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { db } from "./admin.js";
import { RESEND_API_KEY, envoyerCourriel } from "./courriels.js";
import { URL_SITE, paiementReel } from "./paiements.js";
import { courrielBordee, courrielEtapes, courrielVersement } from "./relancesCompte.js";
import { nomRobot } from "./robots.js";

// ---------------------------------------------------------------------------
// La série : une fonction quotidienne choisit, pour chaque compte incomplet,
// le courriel qui lui revient (au plus un par jour, trois en tout).
// ---------------------------------------------------------------------------

const REGION = "northamerica-northeast1";
// Interrupteur de la série : true sur test (functions/.env.snowro-test), false
// en production tant que la série n'est pas validée (functions/.env.snowro-app).
export const RELANCES_ACTIVES = defineBoolean("RELANCES_ACTIVES", { default: false });
const FUSEAU = "America/Toronto";
const ROLE_CLIENT = "donneur_ouvrage";
const ROLE_DENEIGEUR = "deneigeur_x";
const H = 3600e3;
export const MAX_RELANCES = 3;
export const SEUIL_BORDEE_CM = 10;

// Étapes manquantes d'un compte (même logique que src/lib/etapes.js).
export function etapesManquantes(profil, { courrielConfirme, nbAdresses, paiement }) {
  const roles = profil.role ?? [];
  const manquantes = [];
  if (roles.includes(ROLE_DENEIGEUR)) {
    if (!profil.villeGeoId) manquantes.push("adresseService");
    if (paiement && !profil.parentId && profil.connectStatus !== "actif") manquantes.push("versement");
  }
  if (roles.includes(ROLE_CLIENT)) {
    if (!courrielConfirme) manquantes.push("courriel");
    if (!nbAdresses && !profil.villeGeoId) manquantes.push("adresseClient");
    if (paiement && !profil.carte) manquantes.push("carte");
  }
  return manquantes;
}

// Accumulation annoncée pour demain dans une ville (meteo/{villeGeoId}).
export function bordeeDeDemain(meteo, maintenant = Date.now()) {
  if (!meteo?.periodes?.length) return null;
  const demain = new Date(maintenant + 24 * H).toLocaleDateString("fr-CA", { weekday: "long", timeZone: FUSEAU });
  const periodes = meteo.periodes.filter((p) => (p.nom ?? "").toLowerCase().startsWith(demain));
  const cm = periodes.reduce((total, p) => total + (p.cm?.max ?? 0), 0);
  return cm >= SEUIL_BORDEE_CM ? { jour: demain, cm } : null;
}

// Décision pure : quel courriel envoyer aujourd'hui à ce compte (ou aucun).
export function prochaineRelance({ profil, manquantes, bordee, maintenant = Date.now() }) {
  const roles = profil.role ?? [];
  if (!roles.length || profil.rappelsCompteCourriel === false || profil.suspect || nomRobot(profil.displayName)) return null;
  const envois = profil.relancesCompte?.envois ?? [];
  if (envois.length >= MAX_RELANCES || !manquantes.filter((m) => m !== "carte").length) return null;
  const deja = (type) => envois.some((e) => e.type === type);
  const dernier = Math.max(0, ...envois.map((e) => e.at?.toMillis?.() ?? e.at ?? 0));
  if (maintenant - dernier < 20 * H) return null;
  const cree = profil.createdAt?.toMillis?.() ?? profil.createdAt ?? maintenant;
  const age = maintenant - cree;
  if (bordee && !deja("bordee")) return "bordee";
  if (age >= 20 * H && !deja("etapes")) return "etapes";
  if (age >= 4 * 24 * H && roles.includes(ROLE_DENEIGEUR) && manquantes.includes("versement") && !deja("versement")) return "versement";
  return null;
}

export async function relancerComptesMaintenant({ maintenant = Date.now() } = {}) {
  const urlSite = URL_SITE.value();
  const paiement = paiementReel();
  const fiches = await db.collection("users").get();
  const meteos = new Map();
  let envoyes = 0;
  for (const d of fiches.docs) {
    const profil = d.data();
    if (!(profil.role ?? []).length || profil.rappelsCompteCourriel === false) continue;
    const compte = await getAuth().getUser(d.id).catch(() => null);
    if (!compte?.email) continue;
    const nbAdresses = (await db.collection(`users/${d.id}/adresses`).limit(1).get()).size;
    const manquantes = etapesManquantes(profil, { courrielConfirme: compte.emailVerified, nbAdresses, paiement });
    let bordee = null;
    if (profil.villeGeoId) {
      if (!meteos.has(profil.villeGeoId)) meteos.set(profil.villeGeoId, (await db.doc(`meteo/${profil.villeGeoId}`).get()).data() ?? null);
      bordee = bordeeDeDemain(meteos.get(profil.villeGeoId), maintenant);
    }
    const type = prochaineRelance({ profil, manquantes, bordee, maintenant });
    if (!type) continue;

    const jeton = profil.relancesCompte?.jeton ?? randomBytes(16).toString("hex");
    const lienDesabonnement = `${urlSite}/courriels/desabonner?u=${encodeURIComponent(d.id)}&j=${jeton}`;
    const prenom = String(profil.displayName ?? compte.displayName ?? "").trim().split(/\s+/)[0] ?? "";
    const deneigeur = (profil.role ?? []).includes(ROLE_DENEIGEUR);
    const c =
      type === "etapes"
        ? courrielEtapes({ prenom, manquantes, urlSite, lienDesabonnement })
        : type === "versement"
          ? courrielVersement({ prenom, commence: (profil.connectStatus ?? "non_demarre") !== "non_demarre", urlSite, lienDesabonnement })
          : courrielBordee({ prenom, deneigeur, manquantes, ville: profil.ville ?? "votre ville", jour: bordee.jour, cm: bordee.cm, urlSite, lienDesabonnement });
    try {
      await envoyerCourriel({ a: compte.email, sujet: c.sujet, html: c.html, texte: c.texte, cleIdempotence: `relance-${type}-${d.id}`, type: `relance_${type}` });
      await d.ref.set(
        { relancesCompte: { jeton, envois: FieldValue.arrayUnion({ type, at: new Date(maintenant) }) } },
        { merge: true },
      );
      envoyes++;
    } catch (err) {
      logger.error(`Relance ${type} non envoyée pour ${d.id} : ${err.message}`);
    }
  }
  if (envoyes) logger.info(`Relances de compte : ${envoyes} courriel(s) envoyé(s).`);
  return { envoyes };
}

// Tous les jours à 10 h 17 : la veille d'une bordée, il reste le temps d'agir.
export const relancerComptes = onSchedule(
  { schedule: "every day 10:17", timeZone: FUSEAU, region: REGION, secrets: [RESEND_API_KEY] },
  () => (RELANCES_ACTIVES.value() ? relancerComptesMaintenant() : null),
);

// Lien « Ne plus recevoir ces rappels » : sans connexion, avec le jeton du
// courriel. Réponse identique si le lien est faux (rien n'est révélé).
export const desabonnerRelances = onCall({ region: REGION }, async (request) => {
  const { u, j } = request.data ?? {};
  if (typeof u !== "string" || typeof j !== "string" || !/^[0-9a-f]{32}$/.test(j) || u.includes("/") || !u) {
    throw new HttpsError("invalid-argument", "Lien incomplet.");
  }
  const ref = db.doc(`users/${u}`);
  const profil = (await ref.get()).data();
  if (profil?.relancesCompte?.jeton === j) await ref.set({ rappelsCompteCourriel: false }, { merge: true });
  return { ok: true };
});
