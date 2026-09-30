// Parcours de bout en bout dans Chromium, contre les émulateurs Auth +
// Firestore + Functions (lancé par firebase emulators:exec).
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const D = mkdtempSync(join(tmpdir(), "snowro-e2e-")); // captures d'écran
const req = createRequire(`${REPO}functions/package.json`);
const { initializeApp } = req("firebase-admin/app");
const { getFirestore, Timestamp } = req("firebase-admin/firestore");
const { getAuth } = req("firebase-admin/auth");
const geohash = req("ngeohash");

initializeApp({ projectId: "demo-snowro" });
const db = getFirestore();
const auth = getAuth();
const H = 3600e3;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const demain8h = (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return Timestamp.fromDate(d); })();
const aujourdhui17h = (() => { const d = new Date(); d.setHours(Math.max(d.getHours() + 3, 17), 0, 0, 0); return Timestamp.fromDate(d); })();
const g7 = (lat, lng) => geohash.encode(lat, lng).slice(0, 7);

// ---- Données ----
const comptes = {
  mireille: { email: "mireille@test.ca", nom: "Mireille Gagnon", role: ["donneur_ouvrage"] },
  marc: { email: "marc@test.ca", nom: "Marc Tremblay", role: ["deneigeur_x"], ville: "Québec", villeGeoId: "ID_QUEBEC", addressGeohash: geohash.encode(46.8263, -71.2206), ratingAvg: 4.8, nbJobsCompletees: 23 },
  julie: { email: "julie@test.ca", nom: "Julie Lavoie", role: ["donneur_ouvrage", "deneigeur_x"], ville: "Québec", villeGeoId: "ID_QUEBEC", addressGeohash: geohash.encode(46.83, -71.21), ratingAvg: 4.9, nbJobsCompletees: 41 },
  paul: { email: "paul@test.ca", nom: "Paul Bergeron", role: ["donneur_ouvrage"] },
};
const uid = {};
for (const [cle, c] of Object.entries(comptes)) {
  const u = await auth.createUser({ email: c.email, password: "motdepasse", displayName: c.nom });
  uid[cle] = u.uid;
}
await new Promise((r) => setTimeout(r, 3000)); // laisser onUserCreate créer les fiches
for (const [cle, c] of Object.entries(comptes)) {
  const { email, nom, ...reste } = c;
  await db.doc(`users/${uid[cle]}`).set({ displayName: nom, email, ...reste }, { merge: true });
}

const base = (x) => ({
  statut: "ouverte", ville: "Québec", villeGeoId: "ID_QUEBEC", quartier: "Limoilou", postalCodePrefix: "G1L",
  description: "", outilsFournis: false, createdAt: ts(-0.2 * H), deneigeurId: null, deneigeurPrenom: null, deneigeurNote: null,
  matchedAt: null, faiteAt: null, confirmationAutoAt: null, confirmeeAt: null, confirmationAuto: null, signalement: null, paiement: null, ...x,
});
const paiement = (m, s) => ({ montantTotal: m, fraisSnowro: Math.round((2 + m * 0.08) * 100) / 100, montantDeneigeur: Math.round((m - 2 - m * 0.08) * 100) / 100, statutPaiement: s });
const demandes = {
  D1: base({ donneurOuvrageId: uid.paul, donneurPrenom: "Paul", titre: "Entrée double + balcon", description: "Marches du balcon aussi", typeService: "entree_balcon", outilsFournis: true, remunerationOfferte: 45, dateHeureSouhaitee: demain8h, adresseGeohash: g7(46.8290, -71.2180), adresse: "1234, 3e Avenue, Québec" }),
  D2: base({ donneurOuvrageId: uid.paul, donneurPrenom: "Paul", titre: "Petit stationnement", typeService: "stationnement", quartier: "Vieux-Limoilou", remunerationOfferte: 30, dateHeureSouhaitee: aujourdhui17h, adresseGeohash: g7(46.8340, -71.2250), createdAt: ts(-2 * H), adresse: "88, rue des Commissaires Est, Québec" }),
  D3: base({ donneurOuvrageId: uid.paul, donneurPrenom: "Paul", titre: "Toiture de cabanon", typeService: "toiture", quartier: "Saint-Roch", remunerationOfferte: 60, dateHeureSouhaitee: ts(72 * H), adresseGeohash: g7(46.8120, -71.2280), adresse: "12, rue du Roi, Québec" }),
  D4: base({ donneurOuvrageId: uid.paul, donneurPrenom: "Paul", titre: "LÉVIS NE DOIT PAS APPARAÎTRE", typeService: "entree", ville: "Lévis", villeGeoId: "ID_LEVIS", quartier: "Lauzon", remunerationOfferte: 99, dateHeureSouhaitee: demain8h, adresseGeohash: g7(46.8250, -71.2150), adresse: "1, rue de Lévis" }),
  M1: base({ donneurOuvrageId: uid.mireille, donneurPrenom: "Mireille", titre: "Entrée simple, chalet de ma mère", typeService: "entree", remunerationOfferte: 25, dateHeureSouhaitee: ts(60 * H), adresseGeohash: g7(46.827, -71.221), createdAt: ts(-0.2 * H), adresse: "5, rue de ma mère, Québec" }),
  M2: base({ donneurOuvrageId: uid.mireille, donneurPrenom: "Mireille", titre: "Petit stationnement arrière", typeService: "stationnement", remunerationOfferte: 30, dateHeureSouhaitee: ts(14 * H), adresseGeohash: g7(46.827, -71.221), statut: "matchee", deneigeurId: uid.julie, deneigeurPrenom: "Julie", deneigeurNote: { moyenne: 4.9, nombre: 41 }, matchedAt: ts(-1 * H), paiement: paiement(30, "simule_retenu"), adresse: "5, 3e Rue, Québec" }),
  M3: base({ donneurOuvrageId: uid.mireille, donneurPrenom: "Mireille", titre: "Entrée double + balcon", typeService: "entree_balcon", remunerationOfferte: 45, dateHeureSouhaitee: ts(-1 * H), adresseGeohash: g7(46.827, -71.221), statut: "faite", deneigeurId: uid.marc, deneigeurPrenom: "Marc", deneigeurNote: { moyenne: 4.8, nombre: 23 }, matchedAt: ts(-5 * H), faiteAt: ts(-2 * H), confirmationAutoAt: ts(10 * H), paiement: paiement(45, "simule_retenu"), adresse: "5, 3e Rue, Québec" }),
  M4: base({ donneurOuvrageId: uid.mireille, donneurPrenom: "Mireille", titre: "Entrée double + balcon", typeService: "entree_balcon", remunerationOfferte: 45, dateHeureSouhaitee: ts(-100 * H), adresseGeohash: g7(46.827, -71.221), statut: "completee", deneigeurId: uid.julie, deneigeurPrenom: "Julie", confirmeeAt: ts(-90 * H), confirmationAuto: true, paiement: paiement(45, "simule_verse"), createdAt: ts(-120 * H), adresse: "5, 3e Rue, Québec" }),
};
for (const [id, d] of Object.entries(demandes)) {
  const { adresse, ...pub } = d;
  await db.doc(`demandes/${id}`).set(pub);
  await db.doc(`demandes/${id}/prive/adresse`).set({ adresse });
}
console.log("Données de test en place");

// ---- Navigateur ----
const serveur = spawn("npx", ["vite", "preview", "--port", "4190", "--strictPort"], { cwd: REPO, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 3000));
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let ok = 0;
let pageCourante = null;
const test = async (nom, fn) => {
  try { await fn(); } catch (e) { console.log("  ✗", nom, "\n    ", e.message.split("\n")[0]); if (pageCourante) await pageCourante.screenshot({ path: `${D}/e2e-echec.png`, fullPage: true }); throw e; }
  ok++; console.log("  ✓", nom);
};
const carteD1 = (p) => p.locator(".rangee").nth(1).locator(".carte-job", { hasText: "Marches du balcon aussi" });

async function connexion(cle, largeur = 1280) {
  const ctx = await b.newContext({ viewport: { width: largeur, height: 900 }, deviceScaleFactor: largeur < 500 ? 2 : 1.5 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("   [erreur page]", e.message));
  await p.goto("http://localhost:4190/connexion");
  await p.fill('input[type="email"]', comptes[cle].email);
  await p.fill('input[type="password"]', "motdepasse");
  await p.click('button[type="submit"]');
  await p.waitForURL("**/tableau-de-bord");
  pageCourante = p;
  return { p, ctx };
}

// Marc (déneigeur seulement)
{
  const { p, ctx } = await connexion("marc");
  await test("Marc : tableau déneigeur, sans bascule (un seul rôle)", async () => {
    await p.getByRole("heading", { name: "Demandes près de toi" }).waitFor();
    assert.equal(await p.locator(".layout__bascule").count(), 0);
  });
  await test("Marc : 4 demandes de Québec, jamais celle de Lévis, triées par distance", async () => {
    await p.waitForFunction(() => document.querySelectorAll(".rangee")[1]?.querySelectorAll(".carte-job").length === 4);
    const titres = await p.locator(".rangee").nth(1).locator(".carte-job__titre").allTextContents();
    assert.ok(!titres.some((t) => t.includes("LÉVIS")), titres.join(", "));
    assert.equal(titres[0], "Entrée simple, chalet de ma mère");
  });
  await test("Marc : tri « Plus payantes » et filtre « Outils fournis »", async () => {
    await p.selectOption(".rangee__tri select", "payantes");
    assert.equal(await p.locator(".rangee").nth(1).locator(".carte-job__titre").first().textContent(), "Toiture de cabanon");
    await p.getByRole("tab", { name: "Outils fournis" }).click();
    assert.equal(await p.locator(".rangee").nth(1).locator(".carte-job").count(), 1);
    await p.getByRole("tab", { name: "Toutes" }).nth(1).click();
    await p.selectOption(".rangee__tri select", "proches");
  });
  await p.screenshot({ path: `${D}/e2e-marc-1280.png`, fullPage: true });
  await test("Marc : « Je prends la job » ouvre l'engagement ; « Pas maintenant » n'accepte rien", async () => {
    await carteD1(p).getByRole("button", { name: "Je prends la job" }).click();
    await p.getByRole("dialog").getByText("Une fois acceptée, pas d'annulation possible", { exact: false }).waitFor();
    await p.screenshot({ path: `${D}/e2e-engagement.png` });
    await p.getByRole("button", { name: "Pas maintenant" }).click();
    assert.equal((await db.doc("demandes/D1").get()).data().statut, "ouverte");
  });
  await test("Marc : « Je m'engage » : la job passe dans Mes jobs avec l'adresse exacte", async () => {
    await carteD1(p).getByRole("button", { name: "Je prends la job" }).click();
    await p.getByRole("button", { name: "Je m'engage" }).click();
    await p.getByText("1234, 3e Avenue, Québec").waitFor({ timeout: 15000 });
    const d = (await db.doc("demandes/D1").get()).data();
    assert.equal(d.statut, "matchee"); assert.equal(d.deneigeurId, uid.marc); assert.equal(d.paiement.montantDeneigeur, 39.4);
  });
  await test("Marc : « C'est fait » demande confirmation, puis passe « En attente de confirmation »", async () => {
    await p.locator(".carte-job", { hasText: "1234, 3e Avenue" }).getByRole("button", { name: "C'est fait" }).click();
    await p.getByRole("button", { name: "Oui, c'est fait" }).click();
    await p.waitForFunction(async () => true);
    for (let i = 0; i < 30 && (await db.doc("demandes/D1").get()).data().statut !== "faite"; i++) await new Promise((r) => setTimeout(r, 500));
    assert.equal((await db.doc("demandes/D1").get()).data().statut, "faite");
  });
  await p.screenshot({ path: `${D}/e2e-marc-apres-1280.png`, fullPage: true });
  await ctx.close();
}

// Mireille (cliente seulement)
{
  const { p, ctx } = await connexion("mireille");
  await test("Mireille : tableau client, « À confirmer » en premier", async () => {
    await p.getByRole("heading", { name: "Mes demandes" }).waitFor();
    await p.waitForFunction(() => document.querySelectorAll(".rangee .carte-job").length === 3);
    assert.equal(await p.locator(".rangee .badge").first().textContent(), "À confirmer");
    assert.equal(await p.locator(".historique__rang").count(), 1);
  });
  await p.screenshot({ path: `${D}/e2e-mireille-1280.png`, fullPage: true });
  await test("Mireille : aucune option d'annulation sur une demande acceptée", async () => {
    const acceptee = p.locator(".carte-job:has(.badge--ardoise)");
    assert.equal(await acceptee.count(), 1);
    assert.equal(await acceptee.getByRole("button", { name: "Annuler" }).count(), 0);
    assert.equal(await acceptee.getByRole("button", { name: "Signaler un problème" }).count(), 1);
  });
  await test("Mireille : augmenter l'offre de 25 $ à 35 $", async () => {
    await p.getByRole("button", { name: "Augmenter l'offre" }).click();
    await p.fill('.modale input[type="number"]', "35");
    await p.getByRole("button", { name: "Augmenter", exact: true }).click();
    for (let i = 0; i < 30 && (await db.doc("demandes/M1").get()).data().remunerationOfferte !== 35; i++) await new Promise((r) => setTimeout(r, 500));
    assert.equal((await db.doc("demandes/M1").get()).data().remunerationOfferte, 35);
  });
  await test("Mireille : « Confirmer » : la job passe à l'historique, versement simulé", async () => {
    await p.getByRole("button", { name: "Confirmer" }).click();
    await p.waitForFunction(() => document.querySelectorAll(".historique__rang").length === 2, null, { timeout: 15000 });
    const d = (await db.doc("demandes/M3").get()).data();
    assert.equal(d.statut, "completee"); assert.equal(d.paiement.statutPaiement, "simule_verse");
  });
  await ctx.close();
}

// Julie (les deux rôles), sur mobile
{
  const { p, ctx } = await connexion("julie", 390);
  await test("Julie (deux rôles) : bascule visible, passe du mode client au mode déneigeur", async () => {
    await p.locator(".layout__bascule").waitFor();
    await p.getByRole("heading", { name: "Mes demandes" }).waitFor();
    await p.screenshot({ path: `${D}/e2e-julie-client-390.png`, fullPage: true });
    await p.getByRole("radio", { name: "Déneigeur" }).click();
    await p.getByRole("heading", { name: "Mes jobs" }).waitFor();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
  });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${D}/e2e-julie-deneigeur-390.png`, fullPage: true });
  await test("Julie : le mode choisi est retenu au rechargement", async () => {
    await p.reload();
    await p.getByRole("heading", { name: "Mes jobs" }).waitFor();
  });
  await ctx.close();
}

await b.close();
serveur.kill();
console.log(`\n${ok} tests réussis`);
process.exit(0);
