// Recrée le compte de connexion (Firebase Auth) des fiches users/{uid} dont le
// compte a été supprimé par erreur : même UID, même courriel, sans mot de
// passe (la personne utilise « Mot de passe oublié ? » ou le lien de connexion
// par courriel). La fiche s'y rattache comme avant.
// RECREER=oui : recrée. Sinon : simulation. Journaux : des nombres seulement.
import { createRequire } from "node:module";

if (process.env.GCLOUD_PROJECT !== "snowro-app") throw new Error("Production seulement (snowro-app).");
const exiger = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp } = exiger("firebase-admin/app");
const { getAuth } = exiger("firebase-admin/auth");
const { GoogleAuth } = exiger("google-auth-library");
const fichierIdentifiants = process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const { db } = await import("../functions/src/admin.js");
if (fichierIdentifiants) process.env.GOOGLE_APPLICATION_CREDENTIALS = fichierIdentifiants;
// Firebase Auth : jeton obtenu par google-auth-library (identifiants de la
// fédération GitHub) ; sur l'émulateur, l'app par défaut suffit.
let app;
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  const client = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();
  app = initializeApp(
    { projectId: "snowro-app", credential: { getAccessToken: async () => ({ access_token: (await client.getAccessToken()).token, expires_in: 3000 }) } },
    "recreer",
  );
}
const auth = getAuth(app);

const existants = new Set();
let page;
do {
  const r = await auth.listUsers(1000, page);
  r.users.forEach((u) => existants.add(u.uid));
  page = r.pageToken;
} while (page);

const orphelines = (await db.collection("users").get()).docs.filter((d) => !existants.has(d.id));
const avecCourriel = orphelines.filter((d) => typeof d.data().email === "string" && d.data().email.includes("@"));
console.log(`Fiches sans compte de connexion : ${orphelines.length} (avec courriel : ${avecCourriel.length})`);
if (process.env.RECREER !== "oui") {
  console.log("Simulation : rien n'a été recréé.");
  process.exit(0);
}
const r = await auth.importUsers(
  avecCourriel.map((d) => ({
    uid: d.id,
    email: d.data().email.trim().toLowerCase(),
    displayName: d.data().displayName || undefined,
    emailVerified: false,
  })),
);
console.log(`Recréés : ${r.successCount}, échecs : ${r.failureCount}`);
r.errors.forEach((e) => console.log(`  échec n° ${e.index + 1} : ${e.error.code}`));
process.exit(r.failureCount ? 1 : 0);
