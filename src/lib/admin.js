import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// Tableau de bord admin : métriques agrégées calculées par le serveur
// (functions/src/tableauAdmin.js), réservé aux UID de ADMIN_UIDS.
const fn = httpsCallable(functions, "metriquesAdmin");
export const lireMetriquesAdmin = async () => (await fn({})).data;
