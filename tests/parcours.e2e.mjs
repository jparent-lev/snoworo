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
  marc: { email: "marc@test.ca", nom: "Marc Tremblay", role: ["deneigeur_x"], ville: "Québec", villeGeoId: "ID_QUEBEC", addressGeohash: geohash.encode(46.8263, -71.2206), ratingAvg: 4.8, ratingCount: 20, nbJobsCompletees: 23 },
  julie: { email: "julie@test.ca", nom: "Julie Lavoie", role: ["donneur_ouvrage", "deneigeur_x"], ville: "Québec", villeGeoId: "ID_QUEBEC", addressGeohash: geohash.encode(46.83, -71.21), ratingAvg: 4.9, ratingCount: 35, nbJobsCompletees: 41 },
  paul: { email: "paul@test.ca", nom: "Paul Bergeron", role: ["donneur_ouvrage"] },
  zoe: { email: "zoe@test.ca", nom: "Zoé Fermé", role: ["donneur_ouvrage"] },
  nora: { email: "nora@test.ca", nom: "Nora Nouvelle", role: ["donneur_ouvrage"], nonConfirme: true },
};
const uid = {};
for (const [cle, c] of Object.entries(comptes)) {
  const u = await auth.createUser({ email: c.email, password: "motdepasse", displayName: c.nom, emailVerified: !c.nonConfirme });
  uid[cle] = u.uid;
}
await new Promise((r) => setTimeout(r, 3000)); // laisser onUserCreate créer les fiches
for (const [cle, c] of Object.entries(comptes)) {
  const { email, nom, nonConfirme, ...reste } = c;
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
  D3: base({ donneurOuvrageId: uid.paul, donneurPrenom: "Paul", titre: "Toiture de cabanon", typeService: "autre", description: "Toit du cabanon", quartier: "Saint-Roch", remunerationOfferte: 60, dateHeureSouhaitee: ts(72 * H), adresseGeohash: g7(46.8120, -71.2280), adresse: "12, rue du Roi, Québec" }),
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
// D1 est chez la mère de Paul : le déneigeur voit qui sera sur place.
await db.doc("demandes/D1/prive/adresse").set({ lien: "proche", personneSurPlace: "Ginette" }, { merge: true });
console.log("Données de test en place");

// ---- Navigateur ----
const serveur = spawn("npx", ["vite", "preview", "--port", "4190", "--strictPort"], { cwd: REPO, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 3000));
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
// Le build de test a un identifiant de mesure fictif : chaque contexte part
// avec « Refuser » déjà choisi (pas de bandeau), sauf celui du test de mesure.
const nouveauContexte = b.newContext.bind(b);
b.newContext = async (options = {}) => {
  const { mesure, ...reste } = options;
  const c = await nouveauContexte(reste);
  if (!mesure) await c.addInitScript(() => localStorage.setItem("snowro-mesure", JSON.stringify({ choix: "refuse", version: 1 })));
  return c;
};
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
    await p.getByRole("heading", { name: "Demandes près de chez vous" }).waitFor();
    assert.equal(await p.locator(".layout__bascule").count(), 0);
    // Marc a déjà une demande acceptée : pas d'encart vidéo d'accueil.
    assert.equal(await p.locator(".encart-video").count(), 0);
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
  await test("Ordinateur : liens d'aide au pied ; « Me déconnecter » caché dans Paramètres (déjà dans l'en-tête)", async () => {
    const aide = p.getByRole("navigation", { name: "Aide" });
    assert.equal(await aide.getByRole("link", { name: "Nous écrire" }).getAttribute("href"), "/nous-ecrire");
    await p.getByRole("link", { name: "Paramètres" }).click();
    await p.getByRole("heading", { name: "Votre adresse de service" }).waitFor();
    assert.equal(await p.getByRole("button", { name: "Me déconnecter" }).isVisible(), false);
    await p.goBack();
    await p.getByRole("heading", { name: "Demandes près de chez vous" }).waitFor();
  });
  await test("Marc : « Je prends la demande » ouvre l'engagement ; « Pas maintenant » n'accepte rien", async () => {
    await carteD1(p).getByRole("button", { name: "Je prends la demande" }).click();
    await p.getByRole("dialog").getByText("Une fois acceptée, pas d'annulation possible", { exact: false }).waitFor();
    await p.screenshot({ path: `${D}/e2e-engagement.png` });
    await p.getByRole("button", { name: "Pas maintenant" }).click();
    assert.equal((await db.doc("demandes/D1").get()).data().statut, "ouverte");
  });
  await test("Marc : « Je m'engage » : la demande passe dans Mes demandes acceptées avec l'adresse exacte", async () => {
    await carteD1(p).getByRole("button", { name: "Je prends la demande" }).click();
    await p.getByRole("button", { name: "Je m'engage" }).click();
    await p.getByText("1234, 3e Avenue, Québec").waitFor({ timeout: 15000 });
    await p.locator(".carte-job", { hasText: "1234, 3e Avenue" }).getByText("Sur place : Ginette").waitFor();
    const d = (await db.doc("demandes/D1").get()).data();
    assert.equal(d.statut, "matchee"); assert.equal(d.deneigeurId, uid.marc); assert.equal(d.paiement.montantDeneigeur, 39.4);
    const itineraire = p.locator(".carte-job", { hasText: "1234, 3e Avenue" }).getByRole("link", { name: "Itinéraire" });
    assert.match(await itineraire.getAttribute("href"), /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=1234%2C%203e%20Avenue%2C%20Qu%C3%A9bec$/);
    await p.screenshot({ path: `${D}/e2e-acceptee-1280.png`, fullPage: true });
  });
  await test("Marc : « C'est fait » exige une photo ; avec 2 photos, passe « En attente de confirmation »", async () => {
    await p.locator(".carte-job", { hasText: "1234, 3e Avenue" }).getByRole("button", { name: "C'est fait" }).click();
    const dlg = p.getByRole("dialog");
    assert.equal(await dlg.getByRole("button", { name: "Photo requise" }).isDisabled(), true);
    await dlg.locator('input[type="file"]').setInputFiles([`${REPO}public/og-snowro.png`, `${REPO}public/apple-touch-icon.png`]);
    await dlg.getByRole("img", { name: "Photo 2" }).waitFor();
    await p.screenshot({ path: `${D}/e2e-faite-photo-1280.png` });
    await p.getByRole("button", { name: "Oui, c'est fait" }).click();
    await p.waitForFunction(async () => true);
    for (let i = 0; i < 30 && (await db.doc("demandes/D1").get()).data().statut !== "faite"; i++) await new Promise((r) => setTimeout(r, 500));
    assert.equal((await db.doc("demandes/D1").get()).data().statut, "faite");
    assert.equal((await db.doc("demandes/D1").get()).data().nbPhotos, 2);
    for (const i of [0, 1]) {
      const photo = (await db.doc(`demandes/D1/prive/photo-${i}`).get()).data().donnees;
      assert.ok(photo.startsWith("data:image/jpeg;base64,") && photo.length < 650000, `photo ${photo.length}`);
    }
  });
  await p.screenshot({ path: `${D}/e2e-marc-apres-1280.png`, fullPage: true });
  await test("Marc : écrit à Paul depuis la demande ; le message s'affiche et la demande note le dernier message", async () => {
    await p.locator(".carte-job", { hasText: "1234, 3e Avenue" }).getByRole("button", { name: "Écrire à Paul" }).click();
    const dlg = p.getByRole("dialog", { name: "Conversation avec Paul" });
    await dlg.getByText("Aucun message pour l'instant").waitFor();
    await dlg.getByRole("textbox").fill("J'arrive vers 7 h 30. La neige à gauche de l'entrée, est-ce que ça vous convient ?");
    await dlg.getByRole("textbox").press("Enter");
    await dlg.locator(".bulle--moi", { hasText: "J'arrive vers 7 h 30" }).waitFor();
    assert.equal(await dlg.getByRole("textbox").inputValue(), "");
    for (let i = 0; i < 40 && !(await db.doc("demandes/D1").get()).data().dernierMessage; i++) await new Promise((r) => setTimeout(r, 500));
    assert.equal((await db.doc("demandes/D1").get()).data().dernierMessage?.par, uid.marc);
    await p.screenshot({ path: `${D}/e2e-conversation-1280.png` });
    await dlg.getByRole("button", { name: "Fermer" }).click();
    assert.equal(await p.getByRole("dialog").count(), 0);
  });
  await ctx.close();
}

// Paul (client de D1) : le message de Marc l'attend
{
  const { p, ctx } = await connexion("paul");
  await test("Paul : « Nouveau message » sur la demande de Marc, puis réponse ; la pastille disparaît", async () => {
    const carte = p.locator(".carte-job", { hasText: "Entrée double + balcon" });
    await carte.getByRole("button", { name: /Nouveau message/ }).click();
    const dlg = p.getByRole("dialog", { name: "Conversation avec Marc" });
    await dlg.locator(".bulle:not(.bulle--moi)", { hasText: "J'arrive vers 7 h 30" }).waitFor();
    await dlg.getByRole("textbox").fill("Parfait, merci Marc !");
    await dlg.getByRole("button", { name: "Envoyer" }).click();
    await dlg.locator(".bulle--moi", { hasText: "Parfait, merci Marc" }).waitFor();
    await p.keyboard.press("Escape");
    await carte.getByRole("button", { name: "Écrire à Marc" }).waitFor();
  });
  await test("Paul : « Voir les 2 photos » affiche les photos de Marc", async () => {
    await p.locator(".carte-job", { hasText: "Entrée double + balcon" }).getByRole("button", { name: "Voir les 2 photos" }).click();
    const imgs = p.getByRole("dialog", { name: "Photos de Marc" }).getByRole("img");
    await imgs.nth(1).waitFor();
    assert.equal(await imgs.count(), 2);
    assert.ok(await imgs.first().evaluate((i) => i.complete && i.naturalWidth > 1000), "image chargée");
    await p.screenshot({ path: `${D}/e2e-photo-1280.png` });
    await p.getByRole("button", { name: "Fermer" }).click();
  });
  await ctx.close();
}
{
  // Lien du courriel ouvert sans être connecté : connexion, puis la conversation.
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  pageCourante = p;
  await test("Paul (déconnecté) : le lien du courriel mène à la connexion, puis ouvre la conversation", async () => {
    await p.goto("http://localhost:4190/tableau-de-bord?conversation=D1&mode=client");
    await p.waitForURL("**/connexion");
    await p.fill('input[type="email"]', comptes.paul.email);
    await p.fill('input[type="password"]', "motdepasse");
    await p.click('button[type="submit"]');
    await p.getByRole("dialog", { name: "Conversation avec Marc" }).getByText("Parfait, merci Marc").waitFor();
  });
  await ctx.close();
}

// Mireille (cliente seulement)
{
  const { p, ctx } = await connexion("mireille");
  await test("Mireille : tableau client, « À confirmer » en premier", async () => {
    await p.getByRole("heading", { name: /^Mes demandes(?! acceptées)/ }).waitFor();
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
  await test("Mireille : « Confirmer » après la notation sur trois critères : historique, versement simulé, notes de Marc", async () => {
    await p.locator(".carte-job", { hasText: "À confirmer" }).getByRole("button", { name: "Confirmer" }).click();
    const dlg = p.getByRole("dialog", { name: "Confirmer la demande ?" });
    // Le bouton reste bloqué tant que les trois critères ne sont pas notés.
    await dlg.getByRole("button", { name: /Notez les 3 critères \(0\/3\)/ }).waitFor();
    assert.equal(await dlg.getByRole("button", { name: /Notez les 3 critères/ }).isDisabled(), true);
    for (const critere of ["Ponctualité", "Communication", "Qualité du déneigement"]) {
      await dlg.getByRole("radiogroup", { name: critere }).getByRole("radio", { name: /5 étoiles/ }).click();
    }
    await dlg.getByRole("textbox").fill("Impeccable, merci Marc !");
    await p.screenshot({ path: `${D}/e2e-evaluation-1280.png` });
    await dlg.getByRole("button", { name: "Confirmer et verser le paiement" }).click();
    await p.waitForFunction(() => document.querySelectorAll(".historique__rang").length === 2, null, { timeout: 15000 });
    const d = (await db.doc("demandes/M3").get()).data();
    assert.equal(d.statut, "completee"); assert.equal(d.paiement.statutPaiement, "simule_verse"); assert.equal(d.evaluee, true);
    const marc = (await db.doc(`users/${uid.marc}`).get()).data();
    assert.equal(marc.ratingCount, 21); assert.equal(marc.ratingAvg, 4.81);
    assert.deepEqual(marc.ratingCriteres.qualite, { moyenne: 5, nombre: 1 });
  });
  await test("Mireille : la demande de Julie confirmée automatiquement il y a 4 jours peut encore être évaluée", async () => {
    await db.doc("demandes/M4").update({ confirmeeAt: ts(-96 * H) });
    await p.reload();
    await p.getByRole("button", { name: "Évaluer Julie" }).click();
    for (const critere of ["Ponctualité", "Communication", "Qualité du déneigement"]) {
      await p.getByRole("dialog").getByRole("radiogroup", { name: critere }).getByRole("radio", { name: /4 étoiles/ }).click();
    }
    await p.getByRole("dialog").getByRole("button", { name: "Envoyer" }).click();
    await p.getByRole("button", { name: "Évaluer Julie" }).waitFor({ state: "detached", timeout: 15000 });
    assert.equal((await db.doc("demandes/M4").get()).data().evaluee, true);
  });
  await ctx.close();
}

// Marc revient : l'évaluation de Mireille est sur sa demande terminée
{
  const { p, ctx } = await connexion("marc");
  await test("Marc : la demande terminée affiche les 5 étoiles et le mot de Mireille", async () => {
    await p.getByRole("tab", { name: /Terminées/ }).click();
    const ev = p.locator(".evaluation-recue", { hasText: "Impeccable, merci Marc" });
    await ev.waitFor();
    await ev.getByText("Ponctualité 5/5").waitFor();
  });
  await p.screenshot({ path: `${D}/e2e-marc-evaluation-1280.png`, fullPage: true });
  await ctx.close();
}

// Julie (les deux rôles), sur mobile
{
  const { p, ctx } = await connexion("julie", 390);
  await test("Julie (deux rôles) : bascule visible, passe du mode client au mode déneigeur", async () => {
    await p.locator(".layout__bascule").waitFor();
    await p.getByRole("heading", { name: /^Mes demandes(?! acceptées)/ }).waitFor();
    await p.screenshot({ path: `${D}/e2e-julie-client-390.png`, fullPage: true });
    await p.getByRole("radio", { name: "Déneigeur" }).click();
    await p.getByRole("heading", { name: "Mes demandes acceptées" }).waitFor();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
  });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${D}/e2e-julie-deneigeur-390.png`, fullPage: true });
  await test("Julie : conversation lisible sur mobile, sans défilement horizontal", async () => {
    await p.locator(".carte-job", { hasText: "Petit stationnement arrière" }).getByRole("button", { name: "Écrire à Mireille" }).click();
    const dlg = p.getByRole("dialog", { name: "Conversation avec Mireille" });
    await dlg.getByRole("textbox").fill("Bonjour Mireille ! Je passe demain matin.");
    await dlg.getByRole("button", { name: "Envoyer" }).click();
    await dlg.locator(".bulle--moi").waitFor();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
    await p.screenshot({ path: `${D}/e2e-conversation-390.png` });
    await dlg.getByRole("button", { name: "Fermer" }).click();
  });
  await test("Julie : le mode choisi est retenu au rechargement", async () => {
    await p.reload();
    await p.getByRole("heading", { name: "Mes demandes acceptées" }).waitFor();
  });
  await ctx.close();
}

// Adresse de service : même champ à suggestions que pour une demande. Les
// deux fonctions sont simulées (l'émulateur n'a pas de clé Google).
{
  const { p, ctx } = await connexion("marc", 390);
  const appels = [];
  await p.route("**/suggererAdresses", (r) => r.fulfill({ json: { result: { suggestions: [
    { placeId: "ChIJ_saules", principal: "155 Rue des Saules Est", secondaire: "Québec, QC, Canada" },
  ] } } }));
  await p.route("**/mettreAJourAdresseUtilisateur", (r) => {
    appels.push(r.request().postDataJSON().data);
    return r.fulfill({ json: { result: { ville: "Québec", villeGeoId: "ID_QUEBEC" } } });
  });
  await test("Marc : adresse de service choisie dans les suggestions, envoyée par placeId", async () => {
    await p.goto("http://localhost:4190/parametres");
    // Adresse déjà enregistrée : confirmée, formulaire replié.
    await p.locator(".statut-connect", { hasText: "Enregistrée" }).first().waitFor();
    assert.equal(await p.getByRole("combobox").count(), 0);
    await p.getByRole("button", { name: "Changer d'adresse" }).click();
    const champ = p.getByRole("combobox");
    await champ.fill("155 rue des Saul");
    await p.getByRole("option", { name: /155 Rue des Saules Est/ }).click();
    await p.getByText("✓ Adresse reconnue : 155 Rue des Saules Est, Québec, QC, Canada").waitFor();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
    await p.screenshot({ path: `${D}/e2e-adresse-service-390.png`, fullPage: true });
    // Mobile : « Me déconnecter » dans Paramètres (l'en-tête le cache) ; liens d'aide au pied.
    assert.equal(await p.getByRole("button", { name: "Me déconnecter" }).isVisible(), true);
    assert.equal(await p.getByRole("navigation", { name: "Aide" }).getByRole("link", { name: "Aide" }).getAttribute("href"), "/#faq");
    await p.getByRole("button", { name: "Utiliser cette adresse" }).click();
    await p.getByText("✓ Mise à jour à partir de : 155 Rue des Saules Est, Québec, QC, Canada").waitFor();
    assert.deepEqual(appels, [{ placeId: "ChIJ_saules" }]);
    assert.equal(await p.getByRole("combobox").count(), 0, "formulaire replié après l'enregistrement");
    await p.locator("#adresse").scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${D}/e2e-adresse-enregistree-390.png` });
  });
  await test("Marc : sans suggestion choisie, rien n'est envoyé", async () => {
    await p.getByRole("button", { name: "Changer d'adresse" }).click();
    await p.getByRole("combobox").fill("155 rue des Saul");
    await p.getByRole("option", { name: /155 Rue des Saules Est/ }).waitFor();
    await p.getByRole("combobox").press("Escape");
    await p.getByRole("button", { name: "Utiliser cette adresse" }).click();
    await p.getByText("Choisissez votre adresse dans la liste de suggestions.").waitFor();
    assert.equal(appels.length, 1);
  });
  await test("Marc : « Utiliser ma position » reste dans l'écran à 390 px, même avec un message d'erreur", async () => {
    const boite = await p.getByRole("button", { name: "Utiliser ma position" }).boundingBox();
    assert.ok(boite.x + boite.width <= 390, `bouton jusqu'à ${boite.x + boite.width} px`);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
  });
  await test("Marc : cellulaire vérifié par code, puis consentement aux textos, nouvelle version", async () => {
    const appelsTel = [];
    let refusTwilio = true;
    await p.route("**/envoyerCodeTelephone", (r) => {
      // Premier essai : refus de Twilio, tel que le serveur le renvoie (503,
      // le SDK ajoute « [503] » au message).
      if (refusTwilio) {
        refusTwilio = false;
        return r.fulfill({ status: 503, json: { error: { status: "UNAVAILABLE", message: "envoi-impossible", details: { codeTwilio: 20003, statut: 401 } } } });
      }
      appelsTel.push(r.request().postDataJSON().data);
      return r.fulfill({ json: { result: { ok: true } } });
    });
    await p.route("**/verifierCodeTelephone", (r) => {
      appelsTel.push(r.request().postDataJSON().data);
      return r.fulfill({ json: { result: { ok: true, numero: "+14185551234" } } });
    });
    // Sans cellulaire vérifié, l'interrupteur des textos est grisé.
    const sms = p.getByRole("switch", { name: "Notifications SMS" });
    assert.equal(await sms.isDisabled(), true);
    await p.getByText("Vérifiez d'abord votre cellulaire ci-dessus.").waitFor();
    await p.getByLabel("Numéro de cellulaire").fill("418 555-1234");
    await p.getByRole("button", { name: "Recevoir un code" }).click();
    await p.getByText("Le texto n'a pas pu partir (code Twilio 20003). Réessayez dans quelques minutes.").waitFor();
    await p.getByRole("button", { name: "Recevoir un code" }).click();
    await p.getByLabel("Code reçu").fill("123456");
    await p.getByRole("button", { name: "Vérifier" }).click();
    assert.deepEqual(appelsTel, [{ numero: "418 555-1234" }, { code: "123456" }]);
    await db.doc(`users/${uid.marc}`).update({ telephoneVerifie: "+14185551234" });
    await p.getByText("(418) 555-1234").waitFor();
    await p.locator(".statut-connect", { hasText: "Vérifié" }).waitFor();
    // Numéro vérifié : l'interrupteur s'active ; plus de texto d'essai.
    await p.waitForFunction(() => !document.querySelector('[aria-label="Notifications SMS"]')?.disabled);
    await sms.click();
    await p.waitForFunction(() => document.querySelector('[aria-label="Notifications SMS"]')?.getAttribute("aria-checked") === "true");
    assert.equal((await db.doc(`users/${uid.marc}`).get()).data().consents.notificationsSMS.version, 2);
    assert.equal(await p.getByRole("button", { name: /texto d'essai/ }).count(), 0);
    // Accord donné à une version antérieure du texte : redemandé.
    await db.doc(`users/${uid.marc}`).update({ "consents.notificationsSMS.version": 1 });
    await p.getByRole("button", { name: "Accepter le nouveau texte" }).click();
    await p.locator(".statut-connect--ok", { hasText: /^✓Activé le \d{1,2} \S+ \d{4}$/ }).waitFor();
    await p.screenshot({ path: `${D}/e2e-cellulaire-390.png`, fullPage: true });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
  });
  await test("Marc : désactive puis réactive les avis de nouvelles demandes par courriel", async () => {
    const interrupteur = p.getByRole("switch", { name: "Avis de nouvelles demandes par courriel" });
    assert.equal(await interrupteur.getAttribute("aria-checked"), "true");
    await interrupteur.click();
    await p.waitForFunction(() => document.querySelector('[aria-label="Avis de nouvelles demandes par courriel"]')?.getAttribute("aria-checked") === "false");
    for (let i = 0; i < 20 && (await db.doc(`users/${uid.marc}`).get()).data().alertesDemandesCourriel !== false; i++) {
      await p.waitForTimeout(250);
    }
    assert.equal((await db.doc(`users/${uid.marc}`).get()).data().alertesDemandesCourriel, false);
    await interrupteur.click();
    await p.waitForFunction(() => document.querySelector('[aria-label="Avis de nouvelles demandes par courriel"]')?.getAttribute("aria-checked") === "true");
  });
  await ctx.close();
}

// Snowro Pro est retiré du site jusqu'à la V2 : aucune mention sur l'accueil,
// et le rôle « Entreprise (Pro) » n'est plus proposé dans la liste d'attente.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  pageCourante = p;
  await test("accueil : aucune mention de Snowro Pro (menu, section, liste d'attente, FAQ, pied de page)", async () => {
    await p.goto("http://localhost:4190/");
    await p.getByRole("heading", { name: "Prêt pour la prochaine tempête ?" }).waitFor();
    assert.equal(await p.locator("#pro").count(), 0);
    assert.equal(await p.getByRole("link", { name: "Être averti pour Pro" }).count(), 0);
    assert.equal(await p.getByRole("radio", { name: "Entreprise (Pro)" }).count(), 0);
    assert.equal(await p.getByPlaceholder("Nom de l'entreprise").count(), 0);
    const texte = await p.locator("body").innerText();
    assert.ok(!/Snowro Pro/.test(texte), "« Snowro Pro » apparaît encore sur l'accueil");
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
  });
  await ctx.close();
}

// Accueil ouvert (création de compte) ; liens de confirmation de la liste d'attente déjà envoyés.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  pageCourante = p;
  await test("accueil ouvert : les appels à l'action mènent à la création de compte, plus de liste d'attente", async () => {
    await db.doc("statsPubliques/villes").set({ villes: [{ nom: "Québec", deneigeurs: 14 }], seuil: 10 });
    await p.goto("http://localhost:4190/");
    await p.getByRole("list", { name: "Déneigeurs de quartier par ville" }).getByText("Québec 14").waitFor();
    assert.equal(await p.getByRole("link", { name: "Publier une demande" }).getAttribute("href"), "/inscription");
    assert.equal(await p.getByRole("link", { name: "Créer un compte" }).first().getAttribute("href"), "/inscription");
    assert.equal(await p.getByRole("link", { name: "Devenir déneigeur de quartier" }).first().getAttribute("href"), "/inscription");
    assert.equal(await p.getByRole("link", { name: "Se connecter" }).first().getAttribute("href"), "/connexion");
    const texte = await p.locator("body").innerText();
    assert.ok(!/Rejoindre la liste|liste d'attente|Pas encore lancé/i.test(texte), "mention de la liste d'attente sur l'accueil");
    assert.equal(await p.getByPlaceholder("Nom complet").count(), 0);
    await p.screenshot({ path: `${D}/e2e-accueil-ouvert-390.png`, fullPage: true });
  });
  await test("accueil : trois vidéos, dont « Snowro en bref » en vedette dans le héros, ouvertes au clic dans un lecteur avec sous-titres, rien de chargé avant", async () => {
    await p.goto("http://localhost:4190/");
    const boutons = p.getByRole("button", { name: /Vidéo avec son/ });
    assert.equal(await boutons.count(), 3);
    assert.equal(await p.locator(".landing__hero .video-vedette").count(), 1, "vidéo vedette dans le héros");
    // Seule la boucle muette de 4 s joue d'emblée ; aucune vidéo complète avant le clic.
    assert.equal(await p.locator("video:not(.video-vedette__boucle)").count(), 0, "aucune vidéo complète avant le clic");
    const boucle = p.locator(".landing__hero .video-vedette__boucle");
    assert.ok((await boucle.getAttribute("src")).endsWith("/videos/snowro-en-bref-boucle.mp4"));
    assert.equal(await boucle.evaluate((v) => v.muted && v.loop), true, "boucle muette");
    await p.getByRole("button", { name: /Voir Snowro en 30 secondes/ }).click();
    const dlg = p.getByRole("dialog", { name: "Snowro en bref" });
    await dlg.waitFor();
    const video = dlg.locator("video");
    assert.ok((await video.getAttribute("src")).endsWith("/videos/snowro-en-bref.mp4"));
    assert.ok((await dlg.locator("track").getAttribute("src")).endsWith("/videos/snowro-en-bref.fr.vtt"));
    const etat = await video.evaluate((v) => new Promise((ok) => (v.readyState >= 1 ? ok(v.duration) : v.addEventListener("loadedmetadata", () => ok(v.duration)))));
    assert.ok(etat > 31 && etat < 33, `durée ${etat}`);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "défilement horizontal");
    await p.screenshot({ path: `${D}/e2e-video-390.png` });
    await p.keyboard.press("Escape");
    await dlg.waitFor({ state: "detached" });
    await p.screenshot({ path: `${D}/e2e-heros-video-390.png` });
    await p.setViewportSize({ width: 1280, height: 800 });
    await p.screenshot({ path: `${D}/e2e-heros-video-1280.png` });
    await p.setViewportSize({ width: 390, height: 844 });
    await p.getByRole("button", { name: /Voir Snowro en 30 secondes/ }).click();
    await dlg.waitFor();
    await p.keyboard.press("Escape");
    await dlg.waitFor({ state: "detached" });
    const vtt = await p.evaluate(() => fetch("/videos/snowro-la-confiance.fr.vtt").then((r) => r.text()));
    assert.ok(vtt.startsWith("WEBVTT") && vtt.includes("Paiement sécurisé"));
  });
  await test("liste d'attente : le lien du courriel confirme l'inscription ; un lien faux est refusé", async () => {
    const jeton = "c".repeat(48);
    await db.doc("listeAttente/zoe-liste@test.ca").set({
      nom: "Zoé Liste", courriel: "zoe-liste@test.ca", ville: "Québec", confirmee: false,
      jetonConfirmation: jeton, jetonExpireAt: ts(24 * H), createdAt: ts(0),
    });
    await p.goto(`http://localhost:4190/liste/confirmer?c=${encodeURIComponent("zoe-liste@test.ca")}&j=${jeton}`);
    await p.getByRole("heading", { name: "Merci Zoé, c'est confirmé" }).waitFor();
    assert.equal((await db.doc("listeAttente/zoe-liste@test.ca").get()).data().confirmee, true);
    await p.goto(`http://localhost:4190/liste/confirmer?c=${encodeURIComponent("zoe-liste@test.ca")}&j=${"d".repeat(48)}`);
    await p.getByRole("heading", { name: "Merci Zoé, c'est confirmé" }).waitFor();
    await p.getByText("Votre inscription était déjà confirmée.").waitFor();
    await p.goto("http://localhost:4190/liste/confirmer?c=inconnu%40test.ca&j=" + "e".repeat(48));
    await p.getByRole("heading", { name: "Ce lien ne fonctionne pas" }).waitFor();
  });
  await ctx.close();
}

// Loi 25 : avis à l'inscription, fermeture du compte par la personne elle-même.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  pageCourante = p;
  await test("inscription : 18 ans et liens vers les conditions et la politique de confidentialité", async () => {
    await p.goto("http://localhost:4190/inscription");
    await p.getByText("vous confirmez avoir 18 ans ou plus").waitFor();
    assert.equal(await p.getByRole("link", { name: "politique de confidentialité" }).getAttribute("href"), "/confidentialite");
    assert.equal(await p.getByRole("link", { name: "conditions d'utilisation" }).getAttribute("href"), "/conditions");
  });
  await test("inscription simple : aucun choix de rôle, le tableau de bord le demande à la première visite", async () => {
    assert.equal(await p.getByText("Je veux…").count(), 0);
    await p.getByLabel("Nom").fill("Léo Neuf");
    await p.getByLabel("Courriel").fill("leo@test.ca");
    await p.getByLabel("Mot de passe").fill("motdepasse");
    await p.getByRole("button", { name: "Créer mon compte" }).click();
    await p.getByRole("heading", { name: "Comment souhaitez-vous utiliser Snowro ?" }).waitFor();
    await p.getByRole("checkbox", { name: /Je veux déneiger/ }).click();
    await p.getByRole("button", { name: "Continuer" }).click();
    // Étapes de démarrage : liste numérotée, pastille sur « Paramètres ».
    const etapes = p.getByRole("region", { name: "Une étape avant de commencer" });
    await etapes.waitFor();
    const libelles = await etapes.locator("li b").allTextContents();
    assert.deepEqual(libelles, ["Ajouter votre adresse de service", "Vérifier votre cellulaire"]);
    assert.equal(await p.getByLabel("1 étape à faire").textContent(), "1");
    await p.screenshot({ path: `${D}/e2e-etapes-demarrage-390.png`, fullPage: true });
    // Bouton-lien lisible au survol (texte clair sur fond argile).
    const bouton = etapes.getByRole("link", { name: "Ajouter mon adresse" });
    await bouton.hover();
    assert.equal(await bouton.evaluate((el) => getComputedStyle(el).color), "rgb(255, 253, 248)");
    // Le lien mène directement à la section, en haut de l'écran.
    await bouton.click();
    await p.waitForURL("**/parametres#adresse");
    const titre = p.getByRole("heading", { name: "Votre adresse de service" });
    await titre.waitFor();
    await p.waitForFunction(() => {
      const h = document.getElementById("adresse")?.getBoundingClientRect();
      return h && h.top >= 0 && h.top < 200;
    });
    const { uid: idLeo } = await auth.getUserByEmail("leo@test.ca");
    assert.deepEqual((await db.doc(`users/${idLeo}`).get()).data().role, ["deneigeur_x"]);
  });
  await ctx.close();
}
{
  const { p, ctx } = await connexion("zoe", 390);
  await test("Zoé : aucune demande encore, le tableau propose la vidéo du parcours client", async () => {
    await p.locator(".encart-video").getByRole("button", { name: /Voir une demande, du début à la fin/ }).waitFor();
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "défilement horizontal");
    await p.screenshot({ path: `${D}/e2e-encart-video-390.png` });
  });
  await test("Zoé : ferme son compte depuis Paramètres (confirmation FERMER), compte de connexion supprimé", async () => {
    await p.goto("http://localhost:4190/parametres");
    await p.getByRole("button", { name: "Fermer mon compte" }).click();
    const dlg = p.getByRole("dialog", { name: "Fermer votre compte ?" });
    const confirmer = dlg.getByRole("button", { name: "Fermer définitivement" });
    assert.equal(await confirmer.isDisabled(), true);
    await dlg.getByRole("textbox").fill("fermer");
    await p.screenshot({ path: `${D}/e2e-fermeture-390.png` });
    await confirmer.click();
    await p.waitForURL("http://localhost:4190/");
    await assert.rejects(auth.getUser(uid.zoe), /no user record|user-not-found/i);
    assert.equal((await db.doc(`users/${uid.zoe}`).get()).exists, false);
  });
  await ctx.close();
}

// Page /credit-impot (publique) : calculs, clavier, liens, mobile, mode sombre.
{
  const ctx = await b.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("   [erreur page]", e.message));
  pageCourante = p;
  const valeurs = async () => (await p.locator(".ci-calc__valeur").allTextContents()).map((t) => t.replace(/\s/g, " "));
  await test("crédit d'impôt : calcul exact à 600 $ (défaut), 200 $ et 1 500 $ au clavier", async () => {
    await p.goto("http://localhost:4190/credit-impot");
    assert.equal((await p.title()).replace(/\s/g, " "), "Québec rembourse 40 % de votre déneigement | Snowro");
    assert.deepEqual(await valeurs(), ["240 $", "360 $"]);
    const curseur = p.getByRole("slider", { name: "Coût annuel de votre déneigement en dollars" });
    assert.equal(await curseur.getAttribute("aria-valuetext"), "600 dollars");
    await curseur.focus();
    await p.keyboard.press("Home");
    assert.deepEqual(await valeurs(), ["80 $", "120 $"]);
    await p.keyboard.press("End");
    assert.deepEqual(await valeurs(), ["600 $", "900 $"]);
    assert.equal(await curseur.getAttribute("aria-valuetext"), "1500 dollars");
    await p.keyboard.press("ArrowLeft");
    assert.deepEqual(await valeurs(), ["590 $", "885 $"]);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 360);
    await p.screenshot({ path: `${D}/e2e-credit-360.png`, fullPage: true });
  });
  await test("crédit d'impôt : FAQ au clavier, 7 questions, liens Revenu Québec dans un nouvel onglet, CTA vers l'inscription", async () => {
    const questions = p.locator(".faq__question");
    assert.equal(await questions.count(), 7);
    await questions.first().focus();
    await p.keyboard.press("Enter");
    assert.equal(await questions.first().getAttribute("aria-expanded"), "true");
    await p.getByText("Deux exceptions").waitFor();
    for (const lien of await p.locator('a[href^="https://www.revenuquebec.ca"]').all()) {
      assert.equal(await lien.getAttribute("target"), "_blank");
    }
    const ctas = p.getByRole("link", { name: "Trouver mon déneigeur" });
    assert.equal(await ctas.count(), 2);
    for (const c of await ctas.all()) assert.equal(await c.getAttribute("href"), "/inscription");
    assert.match(await p.locator(".ci-avis").textContent(), /credit-impot v1\.1/);
  });
  await ctx.close();
  const bureau = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const pb = await bureau.newPage();
  pageCourante = pb;
  await test("crédit d'impôt : ordinateur, neige immobile si animations réduites", async () => {
    await pb.goto("http://localhost:4190/credit-impot");
    const animation = await pb.evaluate(() => getComputedStyle(document.querySelector(".decor-chute__flocon")).animationName);
    assert.equal(animation, "none");
    await pb.screenshot({ path: `${D}/e2e-credit-1280.png`, fullPage: true });
  });
  await bureau.close();
}

// Retard : demande acceptée dont l'heure prévue est passée sans « C'est fait ».
{
  await db.doc("demandes/M9").set(base({ donneurOuvrageId: uid.mireille, donneurPrenom: "Mireille", titre: "Entrée oubliée", typeService: "entree", remunerationOfferte: 35, dateHeureSouhaitee: ts(-2 * H), adresseGeohash: g7(46.827, -71.221), statut: "matchee", deneigeurId: uid.julie, deneigeurPrenom: "Julie", deneigeurNote: { moyenne: 4.9, nombre: 41 }, matchedAt: ts(-5 * H), paiement: paiement(35, "simule_retenu"), adresse: "5, 3e Rue, Québec" }));
  const { p, ctx } = await connexion("mireille", 390);
  await test("Mireille : demande en retard, « Annuler et être remboursé » ; elle passe à l'historique, remboursée", async () => {
    await p.goto("http://localhost:4190/tableau-de-bord?mode=client");
    const carte = p.locator(".carte-job", { hasText: "Entrée oubliée" });
    await carte.getByText("En retard").waitFor();
    await carte.getByText(/elle sera annulée et vous serez remboursé automatiquement/).waitFor();
    await p.screenshot({ path: `${D}/e2e-retard-client-390.png`, fullPage: true });
    await carte.getByRole("button", { name: "Annuler et être remboursé" }).click();
    await p.getByRole("dialog").getByRole("button", { name: "Annuler et être remboursé" }).click();
    await p.getByText("annulée (retard du déneigeur), remboursée").waitFor();
    const d = (await db.doc("demandes/M9").get()).data();
    assert.equal(d.statut, "annulee"); assert.equal(d.annulation.par, "client"); assert.equal(d.paiement.statutPaiement, "simule_rembourse");
  });
  await ctx.close();
}

// Carnet d'adresses : ajout formel (lien + attestation), puis choix à la
// publication. Géocodage et publication simulés (pas de clé Google ici).
{
  const { p, ctx } = await connexion("mireille", 390);
  const ajouts = [];
  const publications = [];
  await p.route("**/suggererAdresses", (r) => r.fulfill({ json: { result: { suggestions: [
    { placeId: "ChIJ_parents", principal: "42 Rue des Érables", secondaire: "Québec, QC, Canada" },
  ] } } }));
  await p.route("**/ajouterAdresse", async (r) => {
    const data = r.request().postDataJSON().data;
    ajouts.push(data);
    await db.collection(`users/${uid.mireille}/adresses`).add({
      nom: data.nom, lien: data.lien, personneSurPlace: data.personneSurPlace, adresse: "42 Rue des Érables, Québec, QC G1L 1A1",
      attestation: { version: 1, at: Timestamp.now() }, createdAt: Timestamp.now(),
    });
    return r.fulfill({ json: { result: { adresseId: "x", adresse: "42 Rue des Érables", ville: "Québec" } } });
  });
  await p.route("**/publierDemande", (r) => {
    publications.push(r.request().postDataJSON().data);
    return r.fulfill({ json: { result: { demandeId: "nouvelle", ville: "Québec", adresse: "42 Rue des Érables" } } });
  });
  await test("Mireille : ajoute « Parents » à ses adresses ; lien et attestation exigés", async () => {
    await p.goto("http://localhost:4190/parametres#adresses");
    await p.getByRole("heading", { name: "Mes adresses" }).waitFor();
    await p.getByText("Aucune adresse enregistrée").waitFor();
    await p.getByRole("button", { name: "Ajouter une adresse" }).click();
    await p.getByLabel("Nom").fill("Parents");
    await p.getByRole("combobox").fill("42 rue des Éra");
    await p.getByRole("option", { name: /42 Rue des Érables/ }).click();
    await p.getByRole("button", { name: "Ajouter cette adresse" }).click();
    await p.getByText("Indiquez si c'est chez vous ou chez un proche.").waitFor();
    await p.getByLabel("Chez un proche").check();
    await p.getByLabel("Prénom de la personne sur place (facultatif)").fill("Ginette");
    await p.getByRole("button", { name: "Ajouter cette adresse" }).click();
    await p.getByText("Confirmez que vous avez l'autorisation de faire déneiger cette adresse.").waitFor();
    assert.equal(ajouts.length, 0);
    await p.getByLabel(/Cette adresse est chez moi, ou chez une personne/).check();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
    await p.screenshot({ path: `${D}/e2e-carnet-ajout-390.png`, fullPage: true });
    await p.getByRole("button", { name: "Ajouter cette adresse" }).click();
    await p.locator(".statut-connect", { hasText: "Chez un proche · Ginette sur place" }).waitFor();
    assert.deepEqual(ajouts, [{ nom: "Parents", placeId: "ChIJ_parents", unite: "", lien: "proche", personneSurPlace: "Ginette", attestation: true }]);
    await p.screenshot({ path: `${D}/e2e-carnet-390.png`, fullPage: true });
  });
  await test("Mireille : publie à « Parents » depuis le carnet ; « Une autre adresse… » demande le lien et l'attestation", async () => {
    await p.goto("http://localhost:4190/publier");
    const choix = p.getByLabel("Adresse à déneiger");
    await choix.waitFor();
    assert.match(await choix.locator("option:checked").textContent(), /^Parents · 42 Rue des Érables/);
    await p.getByText(/Chez un proche · Ginette sur place\. Montrée seulement/).waitFor();
    assert.equal(await p.locator("input[role=combobox]").count(), 0, "pas de saisie avec une adresse du carnet");
    await choix.selectOption("autre");
    await p.getByText("À qui est cette adresse?").waitFor();
    await p.getByRole("checkbox", { name: "Enregistrer dans mes adresses" }).waitFor();
    await p.screenshot({ path: `${D}/e2e-publier-autre-390.png`, fullPage: true });
    await choix.selectOption({ label: "Parents · 42 Rue des Érables, Québec, QC G1L 1A1" });
    await p.getByRole("button", { name: "Publier la demande" }).click();
    await p.waitForURL("**/tableau-de-bord");
    assert.equal(publications.length, 1);
    assert.ok(publications[0].adresseId, "adresseId envoyé");
    assert.equal(publications[0].attestation, undefined);
    assert.equal(publications[0].placeId, undefined);
  });
  await ctx.close();
}

// Confirmation du courriel : bandeau tant que ce n'est pas fait, publication
// refusée par le serveur, puis lien de confirmation (vrai émulateur Auth).
{
  const { p, ctx } = await connexion("nora", 390);
  await test("Nora : courriel non confirmé, bandeau visible avec son adresse", async () => {
    await p.goto("http://localhost:4190/publier");
    const bandeau = p.locator(".bandeau-courriel");
    await bandeau.getByText("Confirmez votre adresse courriel.").waitFor();
    await bandeau.getByText("nora@test.ca").waitFor();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
    await p.screenshot({ path: `${D}/e2e-bandeau-courriel-390.png` });
  });
  await test("Nora : le lien du courriel confirme l'adresse ; le bandeau disparaît", async () => {
    const lien = await auth.generateEmailVerificationLink("nora@test.ca");
    const code = new URL(lien).searchParams.get("oobCode");
    await p.goto(`http://localhost:4190/courriel/confirmer?code=${encodeURIComponent(code)}`);
    await p.getByRole("heading", { name: "Adresse confirmée" }).waitFor({ timeout: 15000 });
    assert.equal((await auth.getUserByEmail("nora@test.ca")).emailVerified, true);
    await p.goto("http://localhost:4190/tableau-de-bord");
    await p.waitForTimeout(1500);
    assert.equal(await p.locator(".bandeau-courriel").count(), 0);
    await p.goto(`http://localhost:4190/courriel/confirmer?code=${encodeURIComponent(code)}`);
    await p.getByRole("heading", { name: "Ce lien ne fonctionne pas" }).waitFor();
  });
  await ctx.close();
}

// Mot de passe oublié et lien de connexion : pages de snowro.com avec de
// vrais liens de l'émulateur Auth ; l'envoi par courriel est simulé.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  pageCourante = p;
  const demandes = [];
  await p.route("**/demanderLienCompte", (r) => {
    demandes.push(r.request().postDataJSON().data);
    return r.fulfill({ json: { result: { ok: true } } });
  });
  await test("connexion : « Mot de passe oublié? » et « lien de connexion » envoient la demande, même message qu'un compte existe ou non", async () => {
    await p.goto("http://localhost:4190/connexion");
    await p.getByRole("button", { name: "Recevoir un lien de connexion par courriel" }).click();
    await p.getByText("Entrez d'abord votre courriel ci-dessus.").waitFor();
    await p.getByLabel("Courriel").fill("nora@test.ca");
    await p.getByRole("button", { name: "Recevoir un lien de connexion par courriel" }).click();
    await p.getByText(/un lien de connexion vient de partir/).waitFor();
    await p.screenshot({ path: `${D}/e2e-connexion-lien-390.png`, fullPage: true });
    await p.getByRole("link", { name: "Mot de passe oublié?" }).click();
    assert.equal(await p.getByLabel("Courriel").inputValue(), "nora@test.ca", "adresse reprise");
    await p.getByRole("button", { name: "Recevoir le lien" }).click();
    await p.getByText(/un lien pour choisir un nouveau mot de passe vient de partir/).waitFor();
    assert.deepEqual(demandes, [{ courriel: "nora@test.ca", type: "connexion" }, { courriel: "nora@test.ca", type: "reinitialisation" }]);
  });
  await test("mot de passe oublié : le lien permet d'en choisir un nouveau et connecte ; le lien ne resert pas", async () => {
    const code = new URL(await auth.generatePasswordResetLink("nora@test.ca")).searchParams.get("oobCode");
    await p.goto(`http://localhost:4190/mot-de-passe?code=${encodeURIComponent(code)}`);
    await p.getByText("Compte : nora@test.ca").waitFor({ timeout: 15000 });
    await p.getByLabel("Nouveau mot de passe").fill("nouveaumdp");
    await p.getByRole("button", { name: "Enregistrer et me connecter" }).click();
    await p.waitForURL("**/tableau-de-bord");
    await p.goto(`http://localhost:4190/mot-de-passe?code=${encodeURIComponent(code)}`);
    await p.getByRole("heading", { name: "Ce lien ne fonctionne pas" }).waitFor();
  });
  await ctx.close();
}
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  pageCourante = p;
  await test("lien de connexion : sur un autre appareil, l'adresse est redemandée, puis la personne est connectée", async () => {
    const lien = new URL(await auth.generateSignInWithEmailLink("julie@test.ca", { url: "http://localhost:4190/connexion/lien", handleCodeInApp: true }));
    const q = new URLSearchParams();
    for (const k of ["mode", "oobCode", "apiKey", "lang"]) if (lien.searchParams.get(k)) q.set(k, lien.searchParams.get(k));
    await p.goto(`http://localhost:4190/connexion/lien?${q}`);
    await p.getByText("Pour terminer, confirmez l'adresse courriel").waitFor({ timeout: 15000 });
    await p.getByLabel("Courriel").fill("julie@test.ca");
    await p.getByRole("button", { name: "Me connecter" }).click();
    await p.waitForURL("**/tableau-de-bord", { timeout: 15000 });
  });
  await ctx.close();
}

// Tableau admin : refusé à un compte ordinaire (vrai serveur, ADMIN_UIDS vide),
// puis rendu avec des métriques simulées.
{
  const { p, ctx } = await connexion("paul", 390);
  await test("admin : un compte ordinaire voit « Accès réservé », sans lien Admin", async () => {
    await p.goto("http://localhost:4190/admin");
    await p.getByRole("heading", { name: "Accès réservé" }).waitFor({ timeout: 15000 });
    assert.equal(await p.getByRole("link", { name: "Admin" }).count(), 0);
  });
  const jours = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 864e5);
    return { jour: d.toISOString().slice(0, 10), comptes: i % 4, demandes: i % 3 };
  });
  await p.route("**/metriquesAdmin", (r) => r.fulfill({ json: { result: {
    genereA: new Date().toISOString(),
    comptes: { total: 128, j1: 9, j7: 41, j30: 120, clients: 90, deneigeurs: 46, deuxRoles: 8, sansRole: 0, deneigeursAdresse: 40, deneigeursVersementActif: 31, cartes: 72, cellulaires: 50, smsConsentis: 33 },
    demandes: { total: 64, j1: 5, j7: 30, j30: 60, ouvertesMaintenant: 4, acceptees: 52, annuleesRetard: 1, signalees: 2, tauxAcceptation: 0.867, delaiMedianAcceptationMin: 38, delaiMedianConfirmationH: 3.5, parStatut: { ouverte: 4, matchee: 6, faite: 3, completee: 41, signalee: 2, annulee: 8 } },
    argent: { volumeConfirme: 1845, fraisSnowro: 229.6, montantDeneigeurs: 1615.4, nbConfirmees: 41, enRetenue: 280, rembourse: 35, panierMoyen: 45 },
    listeAttente: { total: 210, confirmees: 180, j7: 12 },
    parJour: jours,
    villes: [{ ville: "Québec", deneigeurs: 38, clients: 70, demandes: 55, ouvertes: 3, completees: 36 }, { ville: "Lévis", deneigeurs: 8, clients: 12, demandes: 9, ouvertes: 1, completees: 5 }],
  } } }));
  await p.route("**/analyticsAdmin", (r) => r.fulfill({ json: { result: {
    configure: true, visiteurs: { j7: 340, j30: 900 }, nouveaux: { j7: 300, j30: 800 }, sessions: { j7: 410, j30: 1100 },
    canaux: [{ canal: "Organic Search", sessions: 500, visiteurs: 420 }, { canal: "Referral", sessions: 300, visiteurs: 250 }],
    evenements: { sign_up: 90, choix_role: 85, demande_publiee: 40, demande_acceptee: 32, demande_confirmee: 25, cta_clic: 210, video_ouverte: 60 },
    parJour: jours.map((j, i) => ({ jour: j.jour, visiteurs: 10 + i })),
  } } }));
  await test("admin : tuiles, graphiques sur 30 jours et tableaux, sans défilement horizontal à 390 px", async () => {
    await p.goto("http://localhost:4190/admin");
    await p.getByRole("heading", { name: "Tableau de bord" }).waitFor();
    await p.locator(".admin__tuile", { hasText: "Comptes" }).getByText("128").waitFor();
    await p.getByText("+9 en 24 h · +41 en 7 jours").first().waitFor();
    await p.getByText("87 %").waitFor();
    await p.getByText("Recherche (Google, Bing)").waitFor();
    await p.getByText("90 · 10 %").waitFor();
    assert.equal(await p.locator(".admin__graphique").count(), 3);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
    await p.screenshot({ path: `${D}/e2e-admin-390.png`, fullPage: true });
  });
  await ctx.close();
}

// Mesure d'audience (Loi 25) : rien avant « Accepter », adresse nettoyée, retrait.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, mesure: true });
  const p = await ctx.newPage();
  pageCourante = p;
  const requetes = [];
  await ctx.route(/google(tagmanager|-analytics)\.com/, (r) => {
    requetes.push(r.request().url());
    r.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  const bandeau = p.getByRole("region", { name: "Mesure d'audience" });
  await test("mesure : bandeau au premier passage, rien de chargé ; « Refuser » est retenu", async () => {
    await p.goto("http://localhost:4190/?utm_source=instagram&utm_campaign=lancement&c=zoe%40test.ca");
    await bandeau.waitFor();
    await p.screenshot({ path: `${D}/e2e-bandeau-mesure-390.png` });
    assert.equal(requetes.length, 0, "aucune requête Google avant le choix");
    assert.equal(await p.evaluate(() => !!window.dataLayer), false);
    await bandeau.getByRole("button", { name: "Refuser" }).click();
    await bandeau.waitFor({ state: "detached" });
    await p.reload();
    await p.locator(".landing__hero").waitFor();
    assert.equal(await bandeau.count(), 0);
    assert.equal(requetes.length, 0, "aucune requête Google après un refus");
  });
  await test("mesure : « Accepter » par le lien Témoins charge GA, sans courriel dans l'adresse ; retrait possible", async () => {
    await p.getByRole("button", { name: "Témoins" }).click();
    await bandeau.getByRole("button", { name: "Accepter" }).click();
    await p.waitForFunction(() => document.querySelector('script[src*="googletagmanager.com/gtag/js?id=G-TEST000000"]'));
    const vue = await p.evaluate(() => [...window.dataLayer].map((a) => [...a]).find((a) => a[0] === "event" && a[1] === "page_view")?.[2]);
    assert.ok(vue.page_location.includes("utm_source=instagram"), vue.page_location);
    assert.ok(!/zoe|%40|@/.test(vue.page_location), vue.page_location);
    const config = await p.evaluate(() => [...window.dataLayer].map((a) => [...a]).find((a) => a[0] === "consent")?.[2]);
    assert.equal(config.ad_storage, "denied");
    await p.getByRole("link", { name: "Créer un compte" }).first().click();
    await p.waitForURL("**/inscription");
    // La page vue de /inscription part dans un effet React, juste après la navigation.
    await p.waitForFunction(() => window.dataLayer.filter((a) => a[0] === "event" && a[1] === "page_view").length >= 2);
    const evenements = await p.evaluate(() => [...window.dataLayer].map((a) => [...a]).filter((a) => a[0] === "event").map((a) => a[1]));
    assert.ok(evenements.includes("cta_clic") && evenements.filter((e) => e === "page_view").length >= 2, evenements.join(","));
    await p.goBack();
    await p.getByRole("button", { name: "Témoins" }).click();
    await bandeau.getByRole("button", { name: "Refuser" }).click();
    assert.equal(await p.evaluate(() => window["ga-disable-G-TEST000000"]), true);
  });
  await ctx.close();
}

await b.close();
serveur.kill();
console.log(`\n${ok} tests réussis`);
process.exit(0);
