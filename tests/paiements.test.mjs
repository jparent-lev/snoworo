// Paiements réels (PAIEMENT_REEL=true) contre l'émulateur Firestore, avec un
// faux client Stripe qui note chaque appel : aucun appel à Stripe.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

process.env.GCLOUD_PROJECT = "demo-snowro";
process.env.GOOGLE_GEOCODING_API_KEY = "cle-factice";
process.env.RESEND_API_KEY = "cle-factice";
process.env.STRIPE_SECRET_KEY = "sk_test_factice";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_factice";
process.env.PAIEMENT_REEL = "true";
const REPO = fileURLToPath(new URL("..", import.meta.url));

// Géocodage toujours à Québec ; courriels Resend notés.
const courriels = [];
globalThis.fetch = async (url, options) => {
  if (String(url).includes("resend.com")) {
    courriels.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ id: "resend-1" }) };
  }
  const u = new URL(url);
  if (u.searchParams.get("address")) return { json: async () => ({ status: "OK", results: [{ geometry: { location: { lat: 46.8263, lng: -71.2206 } } }] }) };
  return { json: async () => ({ status: "OK", results: [
    { types: ["street_address"], address_components: [{ long_name: "G1L 2M4", types: ["postal_code"] }, { long_name: "Limoilou", types: ["neighborhood"] }] },
    { types: ["locality", "political"], place_id: "ID_QUEBEC", address_components: [{ long_name: "Québec", types: ["locality"] }] },
  ] }) };
};

// ---- Faux Stripe ----
const appels = [];
let refuserCarte = false;
// Compte au format Accounts v2 ; `transferts` = statut de la capacité.
const compteV2 = (transferts) => ({
  id: "acct_den",
  object: "v2.core.account",
  configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: transferts } } } } },
});
let compte = compteV2("pending");
const noter = (nom, params, options) => appels.push({ nom, params, options });
const fauxStripe = {
  customers: {
    create: async (p, o) => (noter("customers.create", p, o), { id: "cus_pay1" }),
    update: async (id, p) => (noter("customers.update", { id, ...p }), { id }),
  },
  setupIntents: {
    create: async (p) => (noter("setupIntents.create", p), { client_secret: "seti_1_secret_x" }),
    retrieve: async (id) => ({
      id,
      customer: id === "seti_autre" ? "cus_quelquun" : "cus_pay1",
      status: "succeeded",
      payment_method: { id: id === "seti_2" ? "pm_2" : "pm_1", card: { brand: "visa", last4: id === "seti_2" ? "1111" : "4242", exp_month: 12, exp_year: 2030 } },
    }),
  },
  paymentIntents: {
    create: async (p, o) => {
      noter("paymentIntents.create", p, o);
      if (refuserCarte) throw Object.assign(new Error("Your card was declined."), { type: "StripeCardError" });
      return { id: "pi_1", status: "succeeded", latest_charge: "ch_1" };
    },
  },
  transfers: { create: async (p, o) => (noter("transfers.create", p, o), { id: "tr_1" }) },
  accounts: {
    create: async () => { throw new Error("Accounts v1 ne doit plus être utilisé"); },
    createLoginLink: async () => ({ url: "https://connect.stripe.com/express/tableau" }),
  },
  v2: {
    core: {
      accounts: {
        create: async (p, o) => (noter("v2.accounts.create", p, o), { id: "acct_den" }),
        retrieve: async (id, p) => (noter("v2.accounts.retrieve", { id, ...p }), compte),
      },
      accountLinks: { create: async (p) => (noter("v2.accountLinks.create", p), { url: "https://connect.stripe.com/setup/e/inscription" }) },
    },
  },
};

const p = await import(`${REPO}functions/src/paiements.js`);
p.__remplacerStripe(fauxStripe);
const f = await import(`${REPO}functions/src/cycleDemande.js`);
const { db } = await import(`${REPO}functions/src/admin.js`);
const appel = (fn, uid, data) => fn.run({ auth: uid ? { uid } : undefined, data });
const derniers = (nom) => appels.filter((a) => a.nom === nom);
async function echoue(promesse, code, texte) {
  try { await promesse; } catch (e) { assert.equal(e.code, code, `${texte} : code ${e.code} (${e.message})`); return e; }
  assert.fail(`${texte} : aurait dû échouer (${code})`);
}
const lire = async (id) => (await db.doc(`demandes/${id}`).get()).data();
let ok = 0; const test = async (nom, fn) => { await fn(); ok++; console.log("  ✓", nom); };

await db.doc("users/payClient").set({ displayName: "Sophie Roy", email: "sophie@exemple.ca", role: ["donneur_ouvrage"] });
await db.doc("users/payDen").set({ displayName: "Éric Pelletier", email: "eric@exemple.ca", role: ["deneigeur_x"], villeGeoId: "ID_QUEBEC", connectStatus: "non_demarre" });
const demain = new Date(Date.now() + 24 * 3600e3).toISOString();
const base = { adresse: "10, 4e Avenue, Québec", titre: "Entrée simple", typeService: "entree", montant: 50, dateHeureSouhaitee: demain };

console.log("Paiements Stripe (faux Stripe)");
await test("publier : refusé sans carte enregistrée", async () => {
  const e = await echoue(appel(f.publierDemande, "payClient", base), "failed-precondition", "sans carte");
  assert.equal(e.message, "carte-requise");
});
await test("carte : un seul client Stripe, SetupIntent hors session, carte d'un autre refusée", async () => {
  const r = await appel(p.preparerCarte, "payClient", {});
  assert.equal(r.clientSecret, "seti_1_secret_x");
  await appel(p.preparerCarte, "payClient", {});
  assert.equal(derniers("customers.create").length, 1);
  assert.equal(derniers("setupIntents.create")[0].params.usage, "off_session");
  await echoue(appel(p.enregistrerCarte, "payClient", { setupIntentId: "seti_autre" }), "permission-denied", "carte d'un autre");
  await echoue(appel(p.enregistrerCarte, "payClient", { setupIntentId: "pas-un-id" }), "invalid-argument", "id invalide");
});
await test("carte : enregistrée en résumé (marque, 4 derniers chiffres), carte par défaut chez Stripe", async () => {
  const r = await appel(p.enregistrerCarte, "payClient", { setupIntentId: "seti_1" });
  assert.deepEqual(r.carte, { marque: "visa", derniers4: "4242" });
  const u = (await db.doc("users/payClient").get()).data();
  assert.equal(u.carte.paymentMethodId, "pm_1"); assert.equal(u.stripeCustomerId, "cus_pay1");
  assert.equal(derniers("customers.update")[0].params.invoice_settings.default_payment_method, "pm_1");
});
await test("compte déneigeur (Accounts v2) : créé une fois, inscription, puis tableau de bord une fois actif", async () => {
  const r = await appel(p.lienCompteDeneigeur, "payDen", {});
  assert.equal(r.type, "inscription");
  const lien = derniers("v2.accountLinks.create")[0].params;
  assert.equal(lien.account, "acct_den"); assert.equal(lien.use_case.type, "account_onboarding");
  assert.match(lien.use_case.account_onboarding.return_url, /\/parametres\?stripe=retour$/);
  const creation = derniers("v2.accounts.create")[0].params;
  assert.equal(creation.dashboard, "express"); assert.equal(creation.identity.country, "CA");
  assert.deepEqual(creation.defaults.responsibilities, { fees_collector: "application", losses_collector: "application" });
  assert.equal(creation.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested, true);
  assert.equal(creation.contact_email, "eric@exemple.ca");
  assert.deepEqual(derniers("v2.accounts.retrieve")[0].params.include, ["configuration.recipient", "requirements"]);
  assert.equal((await db.doc("users/payDen").get()).data().connectStatus, "en_attente");
  await appel(p.lienCompteDeneigeur, "payDen", {});
  assert.equal(derniers("v2.accounts.create").length, 1);
  await echoue(appel(p.lienCompteDeneigeur, "payClient", {}), "permission-denied", "client sans rôle déneigeur");
});
let id;
await test("accepter : refusé tant que le compte de paiement n'est pas actif", async () => {
  ({ demandeId: id } = await appel(f.publierDemande, "payClient", base));
  await echoue(appel(f.accepterDemande, "payDen", { demandeId: id }), "failed-precondition", "compte inactif");
  assert.equal(derniers("paymentIntents.create").length, 0);
});
await test("webhook account.updated : compte relu, devient actif ; tableau de bord ensuite", async () => {
  compte = compteV2("active");
  await p.traiterEvenement({ type: "account.updated", data: { object: { id: "acct_den" } } });
  assert.equal((await db.doc("users/payDen").get()).data().connectStatus, "actif");
  assert.equal((await appel(p.lienCompteDeneigeur, "payDen", {})).type, "tableau");
  assert.equal(p.statutConnect(compteV2("restricted")), "restreint");
  assert.equal(p.statutConnect({}), "en_attente");
  await db.doc("users/payDen").set({ connectStatus: "en_attente" }, { merge: true });
  await p.traiterEvenement({ type: "v2.core.account[configuration.recipient].capability_status_updated", related_object: { id: "acct_den" } });
  assert.equal((await db.doc("users/payDen").get()).data().connectStatus, "actif");
});
await test("accepter : 50 $ prélevés hors session sur la carte du client, paiement retenu", async () => {
  await appel(f.accepterDemande, "payDen", { demandeId: id });
  const [pi] = derniers("paymentIntents.create");
  assert.equal(pi.params.amount, 5000); assert.equal(pi.params.currency, "cad");
  assert.equal(pi.params.customer, "cus_pay1"); assert.equal(pi.params.payment_method, "pm_1");
  assert.equal(pi.params.receipt_email, "sophie@exemple.ca");
  assert.equal(pi.params.off_session, true); assert.equal(pi.params.confirm, true); assert.equal(pi.params.transfer_group, id);
  const d = await lire(id);
  assert.equal(d.statut, "matchee"); assert.equal(d.paiement.statutPaiement, "retenu"); assert.equal(d.paiement.stripeChargeId, "ch_1");
  assert.equal(d.paiement.montantDeneigeur, 44);
});
await test("confirmer : 44 $ virés au compte du déneigeur, liés au prélèvement", async () => {
  await appel(f.marquerFaite, "payDen", { demandeId: id });
  await appel(f.confirmerJob, "payClient", { demandeId: id });
  const [tr] = derniers("transfers.create");
  assert.equal(tr.params.amount, 4400); assert.equal(tr.params.destination, "acct_den");
  assert.equal(tr.params.source_transaction, "ch_1"); assert.equal(tr.options.idempotencyKey, `versement-${id}`);
  const d = await lire(id);
  assert.equal(d.paiement.statutPaiement, "verse"); assert.equal(d.paiement.stripeTransferId, "tr_1");
});
await test("signaler une job payée : virement bloqué", async () => {
  const { demandeId } = await appel(f.publierDemande, "payClient", base);
  await appel(f.accepterDemande, "payDen", { demandeId });
  await appel(f.signalerProbleme, "payClient", { demandeId, motif: "absent" });
  assert.equal((await lire(demandeId)).paiement.statutPaiement, "bloque");
  assert.equal(derniers("transfers.create").length, 1);
});
await test("carte refusée : demande en pause, déneigeur libéré, client averti par courriel", async () => {
  const { demandeId } = await appel(f.publierDemande, "payClient", base);
  refuserCarte = true;
  const e = await echoue(appel(f.accepterDemande, "payDen", { demandeId }), "failed-precondition", "carte refusée");
  assert.equal(e.message, "carte-refusee");
  const d = await lire(demandeId);
  assert.equal(d.statut, "paiement_refuse"); assert.equal(d.deneigeurId, null); assert.equal(d.paiement, null);
  assert.equal(courriels.at(-1).to[0], "sophie@exemple.ca");
  assert.match(courriels.at(-1).subject, /carte a été refusée/);
  id = demandeId;
});
await test("relancer : exige une nouvelle carte, puis la demande redevient ouverte et se fait prélever", async () => {
  await echoue(appel(f.relancerDemande, "payClient", { demandeId: id }), "failed-precondition", "même carte");
  await new Promise((r) => setTimeout(r, 20));
  await appel(p.enregistrerCarte, "payClient", { setupIntentId: "seti_2" });
  await appel(f.relancerDemande, "payClient", { demandeId: id });
  assert.equal((await lire(id)).statut, "ouverte");
  refuserCarte = false;
  await appel(f.accepterDemande, "payDen", { demandeId: id });
  const pi = derniers("paymentIntents.create").at(-1);
  assert.equal(pi.params.payment_method, "pm_2"); assert.equal(pi.options.idempotencyKey, `prelevement-${id}-pm_2`);
  assert.equal((await lire(id)).paiement.statutPaiement, "retenu");
});
await test("virement en échec : reste « a_verser », réessayé par la tâche planifiée", async () => {
  const { demandeId } = await appel(f.publierDemande, "payClient", base);
  await appel(f.accepterDemande, "payDen", { demandeId });
  await appel(f.marquerFaite, "payDen", { demandeId });
  const creer = fauxStripe.transfers.create;
  fauxStripe.transfers.create = async () => { throw new Error("Stripe indisponible"); };
  await appel(f.confirmerJob, "payClient", { demandeId });
  let d = await lire(demandeId);
  assert.equal(d.paiement.statutPaiement, "a_verser"); assert.equal(d.paiement.erreurVersement, "Stripe indisponible");
  fauxStripe.transfers.create = creer;
  await f.confirmerJobsEchues.run({});
  d = await lire(demandeId);
  assert.equal(d.paiement.statutPaiement, "verse"); assert.equal(d.paiement.erreurVersement, null);
});

await test("erreur Stripe : message lisible renvoyé à l'app", async () => {
  await db.doc("users/payDen2").set({ displayName: "Léa", email: "lea@exemple.ca", role: ["deneigeur_x"] });
  const creer = fauxStripe.v2.core.accounts.create;
  fauxStripe.v2.core.accounts.create = async () => {
    throw Object.assign(new Error("Please review the responsibilities of managing losses for connected accounts."), { type: "StripeInvalidRequestError" });
  };
  const e = await echoue(appel(p.lienCompteDeneigeur, "payDen2", {}), "failed-precondition", "plateforme incomplète");
  assert.match(e.message, /^Stripe : Please review the responsibilities/);
  fauxStripe.v2.core.accounts.create = creer;
});

console.log(`\n${ok} tests réussis`);
process.exit(0);
