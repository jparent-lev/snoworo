import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { GoogleAuth } from "google-auth-library";
import { estAdmin } from "./tableauAdmin.js";

// Google Analytics 4 dans le tableau admin : visiteurs, provenance et
// événements clés (docs/mesure.md), lus par l'API Analytics Data avec le
// compte de service des fonctions (accès « Lecteur » à la propriété).
// Ne compte que les visiteurs qui ont accepté la mesure (Loi 25).
const REGION = "northamerica-northeast1";
export const GA_PROPERTY_ID = defineString("GA_PROPERTY_ID", { default: "" });
const EVENEMENTS = ["sign_up", "choix_role", "demande_publiee", "demande_acceptee", "demande_confirmee", "cta_clic", "video_ouverte"];

let auth;
async function rapport(propriete, corps) {
  auth ??= new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/analytics.readonly"] });
  const client = await auth.getClient();
  const res = await client.request({
    url: `https://analyticsdata.googleapis.com/v1beta/properties/${propriete}:runReport`,
    method: "POST",
    data: corps,
  });
  return res.data;
}

const nombre = (r, i) => Number(r?.metricValues?.[i]?.value ?? 0);
const PERIODES = [
  { startDate: "6daysAgo", endDate: "today", name: "j7" },
  { startDate: "29daysAgo", endDate: "today", name: "j30" },
];

// Réponses de l'API → forme du tableau (pur, testable).
export function mettreEnForme({ totaux, canaux, evenements, parJour }) {
  const parPeriode = (rep, i) =>
    Object.fromEntries(
      (rep.rows ?? []).map((r) => [r.dimensionValues.at(-1).value, nombre(r, i)]),
    );
  const t = parPeriode(totaux, 0);
  const s = parPeriode(totaux, 1);
  const n = parPeriode(totaux, 2);
  return {
    visiteurs: { j7: t.j7 ?? 0, j30: t.j30 ?? 0 },
    sessions: { j7: s.j7 ?? 0, j30: s.j30 ?? 0 },
    nouveaux: { j7: n.j7 ?? 0, j30: n.j30 ?? 0 },
    canaux: (canaux.rows ?? []).map((r) => ({ canal: r.dimensionValues[0].value, sessions: nombre(r, 0), visiteurs: nombre(r, 1) })),
    evenements: Object.fromEntries(EVENEMENTS.map((e) => [e, 0]).concat((evenements.rows ?? []).map((r) => [r.dimensionValues[0].value, nombre(r, 0)]))),
    parJour: (parJour.rows ?? [])
      .map((r) => ({ jour: `${r.dimensionValues[0].value.slice(0, 4)}-${r.dimensionValues[0].value.slice(4, 6)}-${r.dimensionValues[0].value.slice(6)}`, visiteurs: nombre(r, 0) }))
      .sort((a, b) => a.jour.localeCompare(b.jour)),
  };
}

export const analyticsAdmin = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");
  if (!estAdmin(uid)) throw new HttpsError("permission-denied", "Accès réservé.");
  const propriete = GA_PROPERTY_ID.value();
  if (!propriete) return { configure: false };
  try {
    const [totaux, canaux, evenements, parJour] = await Promise.all([
      rapport(propriete, { dateRanges: PERIODES, metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "newUsers" }] }),
      rapport(propriete, {
        dateRanges: [PERIODES[1]],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 8,
      }),
      rapport(propriete, {
        dateRanges: [PERIODES[1]],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: EVENEMENTS } } },
      }),
      rapport(propriete, { dateRanges: [PERIODES[1]], dimensions: [{ name: "date" }], metrics: [{ name: "activeUsers" }] }),
    ]);
    return { configure: true, genereA: new Date().toISOString(), ...mettreEnForme({ totaux, canaux, evenements, parJour }) };
  } catch (err) {
    const code = err.response?.status;
    console.error(`Google Analytics : ${code ?? ""} ${err.response?.data?.error?.message ?? err.message}`);
    if (code === 403) throw new HttpsError("failed-precondition", "acces-ga");
    throw new HttpsError("unavailable", "Google Analytics ne répond pas pour l'instant.");
  }
});
