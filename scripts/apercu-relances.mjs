// Envoie un exemple de chaque courriel de relance, marqué [TEST], à l'adresse
// du compte admin (ADMIN_UIDS). L'adresse n'est jamais écrite dans le dépôt ni
// dans les journaux : elle est lue dans Firebase Auth.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { envoyerCourriel } from "../functions/src/courriels.js";
import { courrielBordee, courrielEtapes, courrielVersement } from "../functions/src/relancesCompte.js";

if (process.env.GCLOUD_PROJECT !== "snowro-app") throw new Error("Production seulement (snowro-app).");
const exiger = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = exiger("firebase-admin/app");
const { getAuth } = exiger("firebase-admin/auth");
const { GoogleAuth } = exiger("google-auth-library");

const env = readFileSync(new URL("../functions/.env.snowro-app", import.meta.url), "utf8");
const uid = env.match(/^ADMIN_UIDS=([^,\s]+)/m)?.[1];
if (!uid) throw new Error("ADMIN_UIDS introuvable.");
const client = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();
const app = initializeApp({
  projectId: "snowro-app",
  credential: { getAccessToken: async () => ({ access_token: (await client.getAccessToken()).token, expires_in: 3000 }) },
});
const admin = await getAuth(app).getUser(uid);
if (!admin.email) throw new Error("Le compte admin n'a pas de courriel.");
const prenom = (admin.displayName ?? "").trim().split(/\s+/)[0] || "";

const urlSite = "https://snowro.com";
const lienDesabonnement = `${urlSite}/parametres#courriels`;
const exemples = [
  ["1 (déneigeur)", courrielEtapes({ prenom, manquantes: ["adresseService", "versement"], urlSite, lienDesabonnement })],
  ["1 (client)", courrielEtapes({ prenom, manquantes: ["courriel", "adresseClient", "carte"], urlSite, lienDesabonnement })],
  ["2 (déneigeur)", courrielVersement({ prenom, commence: false, urlSite, lienDesabonnement })],
  ["3 (déneigeur)", courrielBordee({ prenom, deneigeur: true, manquantes: ["versement"], ville: "Québec", jour: "jeudi", cm: 15, urlSite, lienDesabonnement })],
  ["3 (client)", courrielBordee({ prenom, deneigeur: false, manquantes: ["adresseClient", "carte"], ville: "Québec", jour: "jeudi", cm: 15, urlSite, lienDesabonnement })],
];
for (const [nom, c] of exemples) {
  await envoyerCourriel({ a: admin.email, sujet: `[TEST] Courriel ${nom} · ${c.sujet}`, html: c.html, texte: c.texte, type: "apercu_relance" });
  console.log(`Envoyé : courriel ${nom}`);
  await new Promise((r) => setTimeout(r, 700));
}
process.exit(0);
