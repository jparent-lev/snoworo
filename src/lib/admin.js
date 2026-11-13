import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// Tableau de bord admin : métriques agrégées calculées par le serveur
// (functions/src/tableauAdmin.js), réservé aux UID de ADMIN_UIDS.
const fn = httpsCallable(functions, "metriquesAdmin");
export const lireMetriquesAdmin = async () => (await fn({})).data;

// Google Analytics (functions/src/analyticsAdmin.js) : visiteurs, provenance,
// événements clés. Séparé : une panne de GA ne bloque pas le reste.
const fnGa = httpsCallable(functions, "analyticsAdmin");
export const lireAnalyticsAdmin = async () => (await fnGa({})).data;
