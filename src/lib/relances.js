import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// Lien « Ne plus recevoir ces rappels » des courriels de relance
// (functions/src/relancesSerie.js), sans connexion.
const desabonner = httpsCallable(functions, "desabonnerRelances");
export const desabonnerRelances = async (u, j) => (await desabonner({ u, j })).data;
