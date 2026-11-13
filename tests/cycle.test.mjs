// Tests d'intégration contre l'émulateur Firestore : logique des Cloud
// Functions du cycle de vie (cycleDemande.js) + Firestore rules.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, setDoc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";

process.env.GCLOUD_PROJECT = "demo-snowro";
process.env.GOOGLE_GEOCODING_API_KEY = "cle-factice";
process.env.RESEND_API_KEY = "cle-factice";
process.env.TWILIO_ACCOUNT_SID = "ACfactice";
process.env.TWILIO_AUTH_TOKEN = "jeton-factice";
process.env.TWILIO_NUMERO = "+15815550000";
const REPO = fileURLToPath(new URL("..", import.meta.url));
const geohashLib = createRequire(`${REPO}functions/package.json`)("ngeohash");

// Géocodage simulé : toute adresse contenant « Lévis » tombe à Lévis, le reste à Québec (Limoilou).
const fetchOriginal = globalThis.fetch;
const fetchGeocodage = async (url) => {
  const u = new URL(url);
  const levis = (u.searchParams.get("address") ?? "").includes("Lévis") || (u.searchParams.get("latlng") ?? "").startsWith("46.803");
  const parTexte = u.searchParams.get("address");
  if (parTexte || u.searchParams.get("place_id")) {
    // « rue seulement » : Google ne trouve que la rue, sans numéro civique.
    const imprecise = (parTexte ?? "").includes("rue seulement");
    return { json: async () => ({ status: "OK", results: [{
      types: imprecise ? ["route"] : ["street_address"],
      place_id: u.searchParams.get("place_id") ?? "ChIJ_adresse",
      formatted_address: imprecise ? "3e Avenue, Québec, QC, Canada" : `${levis ? "10 rue Saint-Laurent, Lévis" : "1234 3e Avenue, Québec"}, QC G1L 2M4, Canada`,
      address_components: [
        ...(imprecise ? [] : [{ long_name: "1234", short_name: "1234", types: ["street_number"] }]),
        { long_name: "Canada", short_name: "CA", types: ["country", "political"] },
      ],
      geometry: { location_type: imprecise ? "GEOMETRIC_CENTER" : "ROOFTOP", location: levis ? { lat: 46.8032, lng: -71.1779 } : { lat: 46.8263, lng: -71.2206 } },
    }] }) };
  }
  return { json: async () => ({ status: "OK", results: [
    { types: ["street_address"], address_components: [{ long_name: "G1L 2M4", types: ["postal_code"] }, { long_name: levis ? "Lauzon" : "Limoilou", types: ["neighborhood"] }] },
    { types: ["locality", "political"], place_id: levis ? "ID_LEVIS" : "ID_QUEBEC", address_components: [{ long_name: levis ? "Lévis" : "Québec", types: ["locality"] }] },
  ] }) };
};
globalThis.fetch = fetchGeocodage;

const f = await import(`${REPO}functions/src/cycleDemande.js`);
const carnet = await import(`${REPO}functions/src/carnet.js`);
const { db } = await import(`${REPO}functions/src/admin.js`);
const appel = (fn, uid, data) => fn.run({ auth: uid ? { uid } : undefined, data });
async function echoue(promesse, code, texte) {
  try { await promesse; } catch (e) { assert.equal(e.code, code, `${texte} : code ${e.code} (${e.message})`); return e; }
  assert.fail(`${texte} : aurait dû échouer (${code})`);
}
const lire = async (id) => (await db.doc(`demandes/${id}`).get()).data();
let ok = 0; const test = async (nom, fn) => { await fn(); ok++; console.log("  ✓", nom); };

console.log("Cycle de vie (Cloud Functions)");
await db.doc("users/client1").set({ displayName: "Mireille Gagnon", role: [] });
await db.doc("users/den1").set({ displayName: "Marc Tremblay", role: ["deneigeur_x"], villeGeoId: "ID_QUEBEC", ratingAvg: 4.8, nbJobsCompletees: 23 });
await db.doc("users/den2").set({ displayName: "Luc Lévis", role: ["deneigeur_x"], villeGeoId: "ID_LEVIS" });
await db.doc("users/den3").set({ displayName: "Julie L", role: ["deneigeur_x"], villeGeoId: "ID_QUEBEC" });
await db.doc("users/sansrole").set({ displayName: "Paul", role: [], villeGeoId: "ID_QUEBEC" });
const demain = new Date(Date.now() + 24 * 3600e3).toISOString();
const base = { adresse: "1234, 3e Avenue, Québec", lien: "moi", attestation: true, titre: "Entrée double + balcon", description: "Pelle sur le balcon", typeService: "entree_balcon", montant: 45, dateHeureSouhaitee: demain, outilsFournis: true };

// Plus petit JPEG valable : « C'est fait » exige au moins une photo.
const jpeg = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9]).toString("base64");
const photos = [jpeg];

let id;
await test("publier : ville, geohash arrondi, adresse privée, rôle client ajouté", async () => {
  ({ demandeId: id } = await appel(f.publierDemande, "client1", base));
  const d = await lire(id);
  assert.equal(d.statut, "ouverte"); assert.equal(d.villeGeoId, "ID_QUEBEC"); assert.equal(d.quartier, "Limoilou");
  assert.equal(d.adresseGeohash.length, 7); assert.equal(d.donneurPrenom, "Mireille"); assert.equal(d.outilsFournis, true);
  const prive = (await db.doc(`demandes/${id}/prive/adresse`).get()).data();
  assert.equal(prive.adresse, "1234 3e Avenue, Québec, QC G1L 2M4");
  assert.equal(prive.saisie, "texte");
  assert.deepEqual((await db.doc("users/client1").get()).data().role, ["donneur_ouvrage"]);
});
await test("publier : adresse choisie dans les suggestions (placeId) et appartement, adresse reconnue enregistrée", async () => {
  const { demandeId, adresse } = await appel(f.publierDemande, "client1", { ...base, adresse: undefined, placeId: "ChIJ_choisie", unite: "3" });
  assert.equal(adresse, "1234 3e Avenue, Québec, QC G1L 2M4 (app. 3)");
  const prive = (await db.doc(`demandes/${demandeId}/prive/adresse`).get()).data();
  assert.equal(prive.placeId, "ChIJ_choisie"); assert.equal(prive.unite, "3"); assert.equal(prive.saisie, "suggestion");
  assert.equal((await lire(demandeId)).villeGeoId, "ID_QUEBEC");
});
await test("publier : adresse sans numéro civique refusée ; « toiture » n'est plus accepté ; « autre » exige une description", async () => {
  const e = await echoue(appel(f.publierDemande, "client1", { ...base, adresse: "3e Avenue rue seulement, Québec" }), "invalid-argument", "rue seule");
  assert.match(e.message, /numéro civique/);
  await echoue(appel(f.publierDemande, "client1", { ...base, typeService: "toiture" }), "invalid-argument", "toiture");
  await echoue(appel(f.publierDemande, "client1", { ...base, typeService: "autre", description: "" }), "invalid-argument", "autre sans description");
  await appel(f.publierDemande, "client1", { ...base, typeService: "autre", description: "Escalier extérieur" });
});
await test("publier : refus sans connexion, montant hors bornes, heure passée, type invalide", async () => {
  await echoue(appel(f.publierDemande, null, base), "unauthenticated", "sans connexion");
  await echoue(appel(f.publierDemande, "client1", { ...base, montant: 5 }), "invalid-argument", "montant 5");
  await echoue(appel(f.publierDemande, "client1", { ...base, dateHeureSouhaitee: new Date().toISOString() }), "invalid-argument", "heure");
  await echoue(appel(f.publierDemande, "client1", { ...base, typeService: "piscine" }), "invalid-argument", "type");
});
await test("publier : attestation et lien exigés ; adresse d'un proche avec prénom sur place, enregistrée au carnet", async () => {
  await echoue(appel(f.publierDemande, "client1", { ...base, attestation: false }), "invalid-argument", "sans attestation");
  await echoue(appel(f.publierDemande, "client1", { ...base, lien: undefined }), "invalid-argument", "sans lien");
  const { demandeId } = await appel(f.publierDemande, "client1", { ...base, lien: "proche", personneSurPlace: "Ginette", enregistrer: { nom: "Parents" } });
  const prive = (await db.doc(`demandes/${demandeId}/prive/adresse`).get()).data();
  assert.equal(prive.lien, "proche"); assert.equal(prive.personneSurPlace, "Ginette");
  assert.equal(prive.attestation.source, "demande"); assert.equal(prive.attestation.version, carnet.ATTESTATION.version);
  assert.ok(prive.attestation.at && prive.attestation.adresseId);
  const a = (await db.doc(`users/client1/adresses/${prive.attestation.adresseId}`).get()).data();
  assert.equal(a.nom, "Parents"); assert.equal(a.lien, "proche"); assert.equal(a.personneSurPlace, "Ginette");
  assert.equal(a.attestation.texte, carnet.ATTESTATION.texte); assert.ok(a.attestation.at);
  // « Chez moi » : pas de prénom gardé même s'il est envoyé.
  const { demandeId: d2 } = await appel(f.publierDemande, "client1", { ...base, personneSurPlace: "Ignoré" });
  assert.equal((await db.doc(`demandes/${d2}/prive/adresse`).get()).data().personneSurPlace, "");
});
await test("carnet : ajout formel (nom, lien, attestation, géocodage précis), publier depuis le carnet, suppression", async () => {
  await echoue(appel(carnet.ajouterAdresse, null, { nom: "Maison", adresse: base.adresse, lien: "moi", attestation: true }), "unauthenticated", "sans connexion");
  await echoue(appel(carnet.ajouterAdresse, "client1", { adresse: base.adresse, lien: "moi", attestation: true }), "invalid-argument", "sans nom");
  await echoue(appel(carnet.ajouterAdresse, "client1", { nom: "Maison", adresse: base.adresse, lien: "moi" }), "invalid-argument", "sans attestation");
  await echoue(appel(carnet.ajouterAdresse, "client1", { nom: "Maison", adresse: base.adresse, lien: "voisin", attestation: true }), "invalid-argument", "lien inconnu");
  await echoue(appel(carnet.ajouterAdresse, "client1", { nom: "Maison", adresse: "3e Avenue rue seulement, Québec", lien: "moi", attestation: true }), "invalid-argument", "rue seule");
  const { adresseId, ville } = await appel(carnet.ajouterAdresse, "client1", { nom: "Chalet de Luc", adresse: "10 rue Saint-Laurent, Lévis", unite: "2", lien: "proche", personneSurPlace: "Luc", attestation: true });
  assert.equal(ville, "Lévis");
  const { demandeId, adresse } = await appel(f.publierDemande, "client1", { ...base, adresse: undefined, lien: undefined, attestation: undefined, adresseId });
  assert.equal(adresse, "10 rue Saint-Laurent, Lévis, QC G1L 2M4 (app. 2)");
  const d = await lire(demandeId);
  assert.equal(d.villeGeoId, "ID_LEVIS"); assert.equal(d.quartier, "Lauzon");
  const prive = (await db.doc(`demandes/${demandeId}/prive/adresse`).get()).data();
  assert.equal(prive.personneSurPlace, "Luc"); assert.equal(prive.unite, "2");
  assert.deepEqual({ source: prive.attestation.source, adresseId: prive.attestation.adresseId }, { source: "carnet", adresseId });
  // L'adresse d'un autre compte n'existe pas pour moi.
  await echoue(appel(f.publierDemande, "den1", { ...base, adresseId }), "not-found", "carnet d'un autre");
  await appel(carnet.supprimerAdresse, "client1", { adresseId });
  assert.equal((await db.doc(`users/client1/adresses/${adresseId}`).get()).exists, false);
  await echoue(appel(f.publierDemande, "client1", { ...base, adresseId }), "not-found", "adresse supprimée");
  await echoue(appel(carnet.supprimerAdresse, "client1", { adresseId: "a/b" }), "invalid-argument", "chemin");
});
await test("courriel non confirmé : publier et accepter refusés ; lien Snowro et courriel en français", async () => {
  const nonConfirme = (fn, uid, data) => fn.run({ auth: { uid, token: { email_verified: false } }, data });
  const e = await echoue(nonConfirme(f.publierDemande, "client1", base), "failed-precondition", "publier sans courriel confirmé");
  assert.equal(e.message, "courriel-non-confirme");
  const { demandeId } = await appel(f.publierDemande, "client1", base);
  await echoue(nonConfirme(f.accepterDemande, "den1", { demandeId }), "failed-precondition", "accepter sans courriel confirmé");
  await f.accepterDemande.run({ auth: { uid: "den1", token: { email_verified: true } }, data: { demandeId } });
  assert.equal((await lire(demandeId)).statut, "matchee");
  const cc = await import(`${REPO}functions/src/courrielConfirmation.js`);
  assert.equal(
    cc.lienSnowro("https://snowro-app.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=AbC-123_x&apiKey=k&lang=en", "https://snowro.com"),
    "https://snowro.com/courriel/confirmer?code=AbC-123_x",
  );
  const c = cc.courrielConfirmation({ prenom: "Mireille <b>", lien: "https://snowro.com/courriel/confirmer?code=x&y=1" });
  assert.match(c.html, /Bonjour Mireille &lt;b&gt;,/); assert.match(c.html, /code=x&amp;y=1/);
  assert.match(c.texte, /https:\/\/snowro\.com\/courriel\/confirmer\?code=x&y=1/);
  assert.doesNotMatch(c.html + c.texte, /—/, "pas de tiret cadratin");
});
await test("liens de compte : même réponse sans compte, rien envoyé ; liens Snowro ; courriels en français", async () => {
  const lc = await import(`${REPO}functions/src/liensCompte.js`);
  const appels = [];
  const fetchAvant = globalThis.fetch;
  globalThis.fetch = async (url, o) => { appels.push(String(url)); return fetchAvant(url, o); };
  try {
    assert.deepEqual(await appel(lc.demanderLienCompte, null, { courriel: "Personne@Exemple.ca", type: "reinitialisation" }), { ok: true });
    assert.deepEqual(await appel(lc.demanderLienCompte, null, { courriel: "personne@exemple.ca", type: "connexion" }), { ok: true });
    assert.equal(appels.filter((u) => u.includes("resend")).length, 0, "aucun courriel pour une adresse sans compte");
  } finally {
    globalThis.fetch = fetchAvant;
  }
  await echoue(appel(lc.demanderLienCompte, null, { courriel: "pas-un-courriel", type: "connexion" }), "invalid-argument", "adresse");
  await echoue(appel(lc.demanderLienCompte, null, { courriel: "a@b.ca", type: "autre" }), "invalid-argument", "type");
  assert.equal(
    lc.lienVersSnowro("https://x.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=R1&apiKey=k&lang=en", "https://snowro.com", "/mot-de-passe", ["oobCode"]),
    "https://snowro.com/mot-de-passe?code=R1",
  );
  assert.equal(
    lc.lienVersSnowro("https://x.firebaseapp.com/__/auth/action?mode=signIn&oobCode=S1&apiKey=k&continueUrl=z&lang=en", "https://snowro.com", "/connexion/lien", ["mode", "oobCode", "apiKey", "lang"]),
    "https://snowro.com/connexion/lien?mode=signIn&oobCode=S1&apiKey=k&lang=en",
  );
  for (const type of ["connexion", "reinitialisation"]) {
    const c = lc.courrielLien(type, { prenom: "Luc", lien: "https://snowro.com/x?a=1&b=2" });
    assert.match(c.html, /Bonjour Luc,/); assert.match(c.html, /a=1&amp;b=2/);
    assert.doesNotMatch(c.html + c.texte, /\u2014/);
  }
});
await test("accepter : hors ville refusé (exclusion dure), propre demande refusée, sans rôle refusé", async () => {
  await echoue(appel(f.accepterDemande, "den2", { demandeId: id }), "permission-denied", "hors ville");
  await echoue(appel(f.accepterDemande, "client1", { demandeId: id }), "permission-denied", "propre demande");
  await echoue(appel(f.accepterDemande, "sansrole", { demandeId: id }), "permission-denied", "sans rôle");
});
await test("annuler ou augmenter : impossible pour un autre que le client", async () => {
  await echoue(appel(f.annulerDemande, "den1", { demandeId: id }), "permission-denied", "annuler par autre");
});
await test("augmenter l'offre : plus bas refusé, plus haut accepté", async () => {
  await echoue(appel(f.augmenterOffre, "client1", { demandeId: id, montant: 40 }), "invalid-argument", "plus bas");
  await appel(f.augmenterOffre, "client1", { demandeId: id, montant: 50 });
  assert.equal((await lire(id)).remunerationOfferte, 50);
});
await test("accepter : premier arrivé, paiement simulé calculé (2 $ + 8 %)", async () => {
  await appel(f.accepterDemande, "den1", { demandeId: id });
  const d = await lire(id);
  assert.equal(d.statut, "matchee"); assert.equal(d.deneigeurId, "den1"); assert.equal(d.deneigeurPrenom, "Marc");
  assert.deepEqual(d.deneigeurNote, { moyenne: 4.8, nombre: 23 });
  assert.equal(d.paiement.montantTotal, 50); assert.equal(d.paiement.fraisSnowro, 6); assert.equal(d.paiement.montantDeneigeur, 44);
  assert.equal(d.paiement.statutPaiement, "simule_retenu");
});
await test("accepter : le deuxième reçoit « déjà prise »", async () => {
  const e = await echoue(appel(f.accepterDemande, "den3", { demandeId: id }), "already-exists", "deuxième");
  assert.equal(e.message, "deja-prise");
});
await test("pas d'annulation une fois acceptée, ni augmentation", async () => {
  await echoue(appel(f.annulerDemande, "client1", { demandeId: id }), "failed-precondition", "annuler acceptée");
  await echoue(appel(f.augmenterOffre, "client1", { demandeId: id, montant: 60 }), "failed-precondition", "augmenter acceptée");
});
await test("marquer faite : seulement le déneigeur choisi ; confirmation auto dans 12 h", async () => {
  await echoue(appel(f.marquerFaite, "den3", { demandeId: id, photos }), "permission-denied", "autre déneigeur");
  await echoue(appel(f.confirmerJob, "client1", { demandeId: id }), "failed-precondition", "confirmer avant faite");
  await appel(f.marquerFaite, "den1", { demandeId: id, photos });
  const d = await lire(id);
  assert.equal(d.statut, "faite");
  const ecart = d.confirmationAutoAt.toMillis() - Date.now();
  assert.ok(ecart > 11.9 * 3600e3 && ecart <= 12 * 3600e3, `délai ${ecart}`);
});
await test("confirmer (client) : completee, versement simulé, compteur du déneigeur +1", async () => {
  await echoue(appel(f.confirmerJob, "den1", { demandeId: id }), "permission-denied", "confirmer par déneigeur");
  await echoue(appel(f.confirmerJob, "client1", { demandeId: id }), "invalid-argument", "confirmer sans noter");
  await appel(f.confirmerJob, "client1", { demandeId: id, notes: { ponctualite: 5, communication: 5, qualite: 5 } });
  const d = await lire(id);
  assert.equal(d.statut, "completee"); assert.equal(d.confirmationAuto, false); assert.equal(d.paiement.statutPaiement, "simule_verse");
  assert.equal((await db.doc("users/den1").get()).data().nbJobsCompletees, 24);
});
await test("confirmation automatique : seulement les demandes faites dont les 12 h sont écoulées", async () => {
  const { demandeId: a } = await appel(f.publierDemande, "client1", base);
  const { demandeId: b } = await appel(f.publierDemande, "client1", base);
  for (const x of [a, b]) { await appel(f.accepterDemande, "den3", { demandeId: x }); await appel(f.marquerFaite, "den3", { demandeId: x, photos }); }
  const { Timestamp } = createRequire(`${REPO}functions/package.json`)("firebase-admin/firestore");
  await db.doc(`demandes/${a}`).update({ confirmationAutoAt: Timestamp.fromMillis(Date.now() - 60e3) });
  await f.confirmerJobsEchues.run({});
  assert.equal((await lire(a)).statut, "completee"); assert.equal((await lire(a)).confirmationAuto, true);
  assert.equal((await lire(b)).statut, "faite");
});
await test("signaler : bloque le versement et la confirmation auto ; tiers refusé", async () => {
  const { demandeId: c } = await appel(f.publierDemande, "client1", base);
  await appel(f.accepterDemande, "den1", { demandeId: c });
  await echoue(appel(f.signalerProbleme, "den3", { demandeId: c, motif: "absent" }), "permission-denied", "tiers");
  await echoue(appel(f.signalerProbleme, "client1", { demandeId: c, motif: "meteo" }), "invalid-argument", "motif");
  await appel(f.signalerProbleme, "client1", { demandeId: c, motif: "absent", details: "Personne venu" });
  const d = await lire(c);
  assert.equal(d.statut, "signalee"); assert.equal(d.signalement.par, "client"); assert.equal(d.signalement.statutPrecedent, "matchee");
  assert.equal(d.paiement.statutPaiement, "simule_bloque");
});
await test("retard : avis à l'heure prévue (une fois), annulation remboursée 12 h après ; une demande faite n'est pas touchée", async () => {
  const r = await import(`${REPO}functions/src/retards.js`);
  const { Timestamp } = createRequire(`${REPO}functions/package.json`)("firebase-admin/firestore");
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const { demandeId } = await appel(f.publierDemande, "client1", base);
    await appel(f.accepterDemande, "den1", { demandeId });
    ids.push(demandeId);
  }
  const [avis, annule, faite] = ids;
  await appel(f.marquerFaite, "den1", { demandeId: faite, photos });
  await db.doc(`demandes/${avis}`).update({ dateHeureSouhaitee: Timestamp.fromMillis(Date.now() - 3600e3) });
  await db.doc(`demandes/${annule}`).update({ dateHeureSouhaitee: Timestamp.fromMillis(Date.now() - 13 * 3600e3) });
  await db.doc(`demandes/${faite}`).update({ dateHeureSouhaitee: Timestamp.fromMillis(Date.now() - 13 * 3600e3) });
  const res = await r.traiterRetardsMaintenant();
  assert.ok(res.avis >= 1 && res.annulees >= 1, JSON.stringify(res));
  let d = await lire(avis);
  assert.equal(d.statut, "matchee"); assert.ok(d.retardAvisAt, "avis noté");
  const premierAvis = d.retardAvisAt.toMillis();
  d = await lire(annule);
  assert.equal(d.statut, "annulee"); assert.equal(d.annulation.raison, "retard"); assert.equal(d.annulation.par, "automatique");
  assert.equal(d.paiement.statutPaiement, "simule_rembourse");
  assert.equal((await lire(faite)).statut, "faite");
  // Deuxième passage : pas de nouvel avis.
  await r.traiterRetardsMaintenant();
  assert.equal((await lire(avis)).retardAvisAt.toMillis(), premierAvis);
  // Le déneigeur ne peut plus marquer faite une demande annulée.
  await echoue(appel(f.marquerFaite, "den1", { demandeId: annule, photos }), "failed-precondition", "faite après annulation");
});
await test("retard : le client peut annuler une demande acceptée seulement après l'heure prévue", async () => {
  const { Timestamp } = createRequire(`${REPO}functions/package.json`)("firebase-admin/firestore");
  const { demandeId } = await appel(f.publierDemande, "client1", base);
  await appel(f.accepterDemande, "den1", { demandeId });
  await echoue(appel(f.annulerDemande, "client1", { demandeId }), "failed-precondition", "avant l'heure");
  await echoue(appel(f.annulerDemande, "den1", { demandeId }), "permission-denied", "par le déneigeur");
  await db.doc(`demandes/${demandeId}`).update({ dateHeureSouhaitee: Timestamp.fromMillis(Date.now() - 60e3) });
  await appel(f.annulerDemande, "client1", { demandeId });
  const d = await lire(demandeId);
  assert.equal(d.statut, "annulee"); assert.equal(d.annulation.par, "client"); assert.equal(d.paiement.statutPaiement, "simule_rembourse");
});
await test("annuler : permis tant qu'ouverte", async () => {
  const { demandeId: e } = await appel(f.publierDemande, "client1", base);
  await appel(f.annulerDemande, "client1", { demandeId: e });
  assert.equal((await lire(e)).statut, "annulee");
});

console.log("Photo et évaluation");
const { Timestamp: TS } = createRequire(`${REPO}functions/package.json`)("firebase-admin/firestore");
async function jobFaite(deneigeur, liste = photos) {
  const { demandeId } = await appel(f.publierDemande, "client1", base);
  await appel(f.accepterDemande, deneigeur, { demandeId });
  await appel(f.marquerFaite, deneigeur, { demandeId, photos: liste });
  return demandeId;
}
let avecPhoto;
await test("photos : au moins une exigée, 3 au plus, JPEG seulement, taille limitée", async () => {
  const { demandeId } = await appel(f.publierDemande, "client1", base);
  await appel(f.accepterDemande, "den3", { demandeId });
  const e = await echoue(appel(f.marquerFaite, "den3", { demandeId }), "invalid-argument", "sans photo");
  assert.equal(e.message, "photos-requises");
  await echoue(appel(f.marquerFaite, "den3", { demandeId, photos: [] }), "invalid-argument", "liste vide");
  await echoue(appel(f.marquerFaite, "den3", { demandeId, photos: [jpeg, jpeg, jpeg, jpeg] }), "invalid-argument", "4 photos");
  await echoue(appel(f.marquerFaite, "den3", { demandeId, photos: ["data:image/png;base64,iVBORw0KGgo="] }), "invalid-argument", "png");
  await echoue(appel(f.marquerFaite, "den3", { demandeId, photos: [jpeg, "data:image/jpeg;base64,PHN2Zz4="] }), "invalid-argument", "faux jpeg");
  await echoue(appel(f.marquerFaite, "den3", { demandeId, photos: [jpeg + "A".repeat(f.PHOTO_MAX_CARACTERES)] }), "invalid-argument", "trop lourde");
  assert.equal((await lire(demandeId)).statut, "matchee");
});
await test("photos : enregistrées en privé avec « C'est fait » (3 documents), effacement prévu dans 30 jours", async () => {
  avecPhoto = await jobFaite("den3", [jpeg, jpeg, jpeg]);
  const d = await lire(avecPhoto);
  assert.equal(d.statut, "faite"); assert.equal(d.photo, true); assert.equal(d.nbPhotos, 3);
  const ecart = d.photoExpireAt.toMillis() - Date.now();
  assert.ok(ecart > 29.9 * 24 * 3600e3 && ecart <= 30 * 24 * 3600e3, `délai ${ecart}`);
  for (const i of [0, 1, 2]) assert.equal((await db.doc(`demandes/${avecPhoto}/prive/photo-${i}`).get()).data().donnees, jpeg);
});
await test("confirmer après la notation sur trois critères : moyennes recalculées, mot privé", async () => {
  await db.doc("users/den3").set({ ratingAvg: 5, ratingCount: 1 }, { merge: true });
  await echoue(appel(f.confirmerJob, "client1", { demandeId: avecPhoto, notes: { ponctualite: 6, communication: 4, qualite: 3 } }), "invalid-argument", "note 6");
  await echoue(appel(f.confirmerJob, "client1", { demandeId: avecPhoto, notes: { ponctualite: 5, communication: 4 } }), "invalid-argument", "critère manquant");
  const notes = { ponctualite: 5, communication: 4, qualite: 3 };
  await appel(f.confirmerJob, "client1", { demandeId: avecPhoto, notes, commentaire: "Merci, très propre !" });
  const den3 = (await db.doc("users/den3").get()).data();
  assert.equal(den3.ratingAvg, 4.5); assert.equal(den3.ratingCount, 2);
  assert.deepEqual(den3.ratingCriteres, { ponctualite: { moyenne: 5, nombre: 1 }, communication: { moyenne: 4, nombre: 1 }, qualite: { moyenne: 3, nombre: 1 } });
  assert.equal((await lire(avecPhoto)).evaluee, true);
  const ev = (await db.doc(`demandes/${avecPhoto}/prive/evaluation`).get()).data();
  assert.deepEqual({ note: ev.note, notes: ev.notes, commentaire: ev.commentaire }, { note: 4, notes, commentaire: "Merci, très propre !" });
});
await test("évaluer après coup : une seule fois, client seulement, dans les 7 jours", async () => {
  const x = await jobFaite("den3");
  await echoue(appel(f.evaluerJob, "client1", { demandeId: x, notes: { ponctualite: 5, communication: 5, qualite: 5 } }), "failed-precondition", "pas encore confirmée");
  // Confirmée automatiquement (12 h), donc sans note.
  await db.doc(`demandes/${x}`).update({ statut: "completee", confirmeeAt: TS.now(), confirmationAuto: true });
  assert.notEqual((await lire(x)).evaluee, true);
  await echoue(appel(f.evaluerJob, "den3", { demandeId: x, notes: { ponctualite: 5, communication: 5, qualite: 5 } }), "permission-denied", "déneigeur");
  await appel(f.evaluerJob, "client1", { demandeId: x, notes: { ponctualite: 5, communication: 5, qualite: 5 } });
  const den3 = (await db.doc("users/den3").get()).data();
  assert.equal(den3.ratingCount, 3); assert.equal(den3.ratingCriteres.qualite.nombre, 2); assert.equal(den3.ratingCriteres.qualite.moyenne, 4);
  await echoue(appel(f.evaluerJob, "client1", { demandeId: x, notes: { ponctualite: 5, communication: 5, qualite: 5 } }), "already-exists", "deux fois");
  const y = await jobFaite("den3");
  await db.doc(`demandes/${y}`).update({ statut: "completee", confirmationAuto: true, confirmeeAt: TS.fromMillis(Date.now() - 8 * 24 * 3600e3) });
  await echoue(appel(f.evaluerJob, "client1", { demandeId: y, notes: { ponctualite: 5, communication: 5, qualite: 5 } }), "failed-precondition", "après 7 jours");
});
await test("purge : photos et messages effacés 30 jours après la demande, gardés si la demande est signalée", async () => {
  const signalee = await jobFaite("den1");
  await appel(f.signalerProbleme, "client1", { demandeId: signalee, motif: "incomplet" });
  for (const x of [avecPhoto, signalee]) {
    await db.doc(`demandes/${x}`).update({ photoExpireAt: TS.fromMillis(Date.now() - 1000), dernierMessage: { par: "client1" } });
    await db.collection(`messages/${x}/messages`).add({ expediteurId: "client1", contenu: "Merci !" });
  }
  await f.purgerPhotos.run({});
  for (const i of [0, 1, 2]) assert.equal((await db.doc(`demandes/${avecPhoto}/prive/photo-${i}`).get()).exists, false);
  const purgee = await lire(avecPhoto);
  assert.equal(purgee.photo, false); assert.equal(purgee.nbPhotos, 0);
  assert.equal(purgee.messagesEffaces, true); assert.equal(purgee.dernierMessage, null);
  assert.equal((await db.collection(`messages/${avecPhoto}/messages`).get()).size, 0);
  assert.equal((await db.doc(`demandes/${signalee}/prive/photo-0`).get()).exists, true);
  assert.equal((await db.collection(`messages/${signalee}/messages`).get()).size, 1);
});

console.log("Messagerie (avis par courriel)");
const m = await import(`${REPO}functions/src/messagerie.js`);
const envois = [];
globalThis.fetch = async (url, options) => {
  envois.push({ url, corps: JSON.parse(options.body) });
  return { ok: true, json: async () => ({ id: `resend-${envois.length}` }) };
};
await db.doc("users/client1").set({ email: "mireille@exemple.ca" }, { merge: true });
await db.doc("users/den1").set({ email: "marc@exemple.ca" }, { merge: true });
await db.doc("demandes/conv1").set({ statut: "matchee", titre: "Entrée double", donneurOuvrageId: "client1", donneurPrenom: "Mireille", deneigeurId: "den1", deneigeurPrenom: "Marc" });
async function nouveauMessage(expediteurId, contenu) {
  const ref = await db.collection("messages/conv1/messages").add({ expediteurId, contenu, createdAt: new Date() });
  await m.notifierNouveauMessage.run({ params: { demandeId: "conv1", messageId: ref.id }, data: await ref.get() });
}
await test("message du déneigeur : la cliente reçoit un avis, dernierMessage recopié", async () => {
  await nouveauMessage("den1", "J'arrive vers 7 h. Je mets la neige à gauche du stationnement ?");
  assert.equal(envois.length, 1);
  const { corps } = envois[0];
  assert.deepEqual(corps.to, ["mireille@exemple.ca"]);
  assert.match(corps.subject, /Marc vous a écrit à propos de « Entrée double »/);
  assert.match(corps.text, /J'arrive vers 7 h/);
  assert.match(corps.text, /conversation=conv1&mode=client/);
  assert.equal((await lire("conv1")).dernierMessage.par, "den1");
});
await test("rafale : un seul avis par 15 min et par destinataire ; l'autre personne a le sien", async () => {
  await nouveauMessage("den1", "Et le balcon aussi ?");
  assert.equal(envois.length, 1);
  await nouveauMessage("client1", "Oui, à gauche, merci !");
  assert.equal(envois.length, 2);
  assert.deepEqual(envois[1].corps.to, ["marc@exemple.ca"]);
  assert.match(envois[1].corps.text, /mode=deneigeur/);
});
await test("avis : le contenu est échappé dans le HTML et tronqué s'il est long", async () => {
  const { html, texte } = m.composerAvis({ expediteurPrenom: "Marc", titreDemande: "Entrée", extrait: "<b>salut</b> " + "x".repeat(400), lien: "https://snowro.com" });
  assert.ok(html.includes("&lt;b&gt;salut&lt;/b&gt;") && !html.includes("<b>salut"));
  assert.ok(texte.includes("…") && !texte.includes("x".repeat(300)));
});

console.log("Suggestions d'adresses");
const sa = await import(`${REPO}functions/src/suggestionsAdresse.js`);
let requetePlaces;
globalThis.fetch = async (url, options) => {
  requetePlaces = { url, corps: JSON.parse(options.body) };
  return { ok: true, json: async () => ({ suggestions: [
    { placePrediction: { placeId: "ChIJ_1", structuredFormat: { mainText: { text: "1234 3e Avenue" }, secondaryText: { text: "Québec, QC, Canada" } } } },
    { queryPrediction: { text: { text: "ignorée" } } },
  ] }) };
};
await test("suggestions : Canada, adresses civiques, en français ; connexion requise ; texte trop court ignoré", async () => {
  const { suggestions } = await appel(sa.suggererAdresses, "client1", { texte: "1234 3e av", session: "s1" });
  assert.deepEqual(suggestions, [{ placeId: "ChIJ_1", principal: "1234 3e Avenue", secondaire: "Québec, QC, Canada" }]);
  assert.match(requetePlaces.url, /places:autocomplete/);
  assert.deepEqual(requetePlaces.corps.includedRegionCodes, ["ca"]);
  assert.ok(requetePlaces.corps.includedPrimaryTypes.includes("street_address"));
  assert.equal(requetePlaces.corps.languageCode, "fr-CA"); assert.equal(requetePlaces.corps.sessionToken, "s1");
  await echoue(appel(sa.suggererAdresses, null, { texte: "1234 3e av" }), "unauthenticated", "sans connexion");
  assert.deepEqual((await appel(sa.suggererAdresses, "client1", { texte: "12" })).suggestions, []);
});
await test("suggestions : service Google indisponible -> « suggestions-indisponibles » (le site passe en saisie complète)", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: { message: "Places API (New) has not been used" } }) });
  const e = await echoue(appel(sa.suggererAdresses, "client1", { texte: "1234 3e av" }), "unavailable", "indisponible");
  assert.equal(e.message, "suggestions-indisponibles");
});

await test("suggestions : noms mal encodés par Google réparés (« Les Ã\uFFFDBoulements » -> « Les Éboulements »)", async () => {
  const { reparerTexteGoogle } = await import(`${REPO}functions/src/geocoding.js`);
  assert.equal(reparerTexteGoogle("Les \u00C3\uFFFDBoulements, QC, Canada"), "Les Éboulements, QC, Canada");
  assert.equal(reparerTexteGoogle("Qu\u00C3\u00A9bec"), "Québec");
  assert.equal(reparerTexteGoogle("Rue de l'Église, Québec"), "Rue de l'Église, Québec");
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ suggestions: [{ placePrediction: { placeId: "p1",
    structuredFormat: { mainText: { text: "155 Rue des Saules" }, secondaryText: { text: "Les \u00C3\uFFFDBoulements, QC, Canada" } } } }] }) });
  const { suggestions } = await appel(sa.suggererAdresses, "client1", { texte: "155 rue des Saul" });
  assert.equal(suggestions[0].secondaire, "Les Éboulements, QC, Canada");
});

console.log("Adresse de service du déneigeur");
const ad = await import(`${REPO}functions/src/adresse.js`);
await db.doc("users/den9").set({ displayName: "Léa Roy", role: ["deneigeur_x"] });
await test("adresse de service : suggestion choisie (placeId) ou adresse complète ; rue seule refusée", async () => {
  globalThis.fetch = fetchGeocodage;
  assert.deepEqual(await appel(ad.mettreAJourAdresseUtilisateur, "den9", { placeId: "ChIJ_choisie" }), { ville: "Québec", villeGeoId: "ID_QUEBEC" });
  const u = (await db.doc("users/den9").get()).data();
  assert.equal(u.addressGeohash.length, 9); assert.equal(u.ville, "Québec");
  assert.equal((await appel(ad.mettreAJourAdresseUtilisateur, "den9", { adresse: "10 rue Saint-Laurent, Lévis" })).villeGeoId, "ID_LEVIS");
  const e = await echoue(appel(ad.mettreAJourAdresseUtilisateur, "den9", { adresse: "3e Avenue rue seulement, Québec" }), "invalid-argument", "rue seule");
  assert.match(e.message, /numéro/i);
  assert.equal((await db.doc("users/den9").get()).data().villeGeoId, "ID_LEVIS", "adresse précédente gardée");
  await echoue(appel(ad.mettreAJourAdresseUtilisateur, null, { placeId: "x" }), "unauthenticated", "sans connexion");
  await echoue(appel(ad.mettreAJourAdresseUtilisateur, "den9", {}), "invalid-argument", "rien");
});

console.log("Conservation et fermeture de compte (Loi 25)");
const cons = await import(`${REPO}functions/src/conservation.js`);
const compte = await import(`${REPO}functions/src/compte.js`);
const { getAuth } = createRequire(`${REPO}functions/package.json`)("firebase-admin/auth");
await test("conservation : liste d'attente et « Nous écrire » après 24 mois, inscriptions non confirmées après 7 jours", async () => {
  const vieux = TS.fromMillis(Date.now() - 731 * 24 * 3600e3);
  await db.doc("listeAttente/vieux@exemple.ca").set({ courriel: "vieux@exemple.ca", createdAt: vieux });
  await db.doc("listeAttente/recent@exemple.ca").set({ courriel: "recent@exemple.ca", createdAt: TS.now() });
  await db.doc("messagesContact/vieux").set({ courriel: "a@exemple.ca", createdAt: vieux });
  await db.doc("messagesContact/recent").set({ courriel: "b@exemple.ca", createdAt: TS.now() });
  await db.doc("listeAttente/jamais@exemple.ca").set({ courriel: "jamais@exemple.ca", confirmee: false, createdAt: TS.now(), jetonExpireAt: TS.fromMillis(Date.now() - 1000) });
  await db.doc("listeAttente/encore@exemple.ca").set({ courriel: "encore@exemple.ca", confirmee: false, createdAt: TS.now(), jetonExpireAt: TS.fromMillis(Date.now() + 3600e3) });
  assert.deepEqual(await cons.appliquerConservation(), { nonConfirmees: 1, listeAttente: 1, messagesContact: 1 });
  assert.equal((await db.doc("listeAttente/jamais@exemple.ca").get()).exists, false, "non confirmée après 7 jours");
  assert.equal((await db.doc("listeAttente/encore@exemple.ca").get()).exists, true, "lien encore valide");
  assert.equal((await db.doc("listeAttente/vieux@exemple.ca").get()).exists, false);
  assert.equal((await db.doc("listeAttente/recent@exemple.ca").get()).exists, true);
  assert.equal((await db.doc("messagesContact/recent").get()).exists, true);
});
await test("fermer son compte : refusé pendant une demande en cours ou sans confirmation", async () => {
  await db.doc("demandes/ferm-encours").set({ statut: "matchee", donneurOuvrageId: "ferme1", deneigeurId: "den1" });
  await echoue(appel(compte.fermerCompte, "ferme1", {}), "invalid-argument", "sans confirmation");
  const e = await echoue(appel(compte.fermerCompte, "ferme1", { confirmation: "FERMER" }), "failed-precondition", "job en cours");
  assert.equal(e.message, "job-en-cours");
  await db.doc("demandes/ferm-encours").update({ statut: "completee" });
  await db.doc("demandes/ferm-versement").set({ statut: "completee", donneurOuvrageId: "client1", deneigeurId: "ferme1", paiement: { statutPaiement: "a_verser" } });
  assert.equal((await echoue(appel(compte.fermerCompte, "ferme1", { confirmation: "FERMER" }), "failed-precondition", "versement")).message, "versement-en-attente");
  await db.doc("demandes/ferm-versement").delete();
  // Côté client aussi : demande confirmée dont le paiement n'est pas terminé.
  for (const statutPaiement of ["prelevement_en_cours", "retenu", "a_verser"]) {
    await db.doc("demandes/ferm-paiement").set({ statut: "completee", donneurOuvrageId: "ferme1", deneigeurId: "den1", paiement: { statutPaiement } });
    assert.equal((await echoue(appel(compte.fermerCompte, "ferme1", { confirmation: "FERMER" }), "failed-precondition", `paiement ${statutPaiement}`)).message, "paiement-en-cours");
  }
  await db.doc("demandes/ferm-paiement").delete();
});
await test("fermer son compte : profil, connexion, adresses, photos, messages et liste d'attente effacés ; paiement gardé", async () => {
  const { uid } = await getAuth().createUser({ email: "ferme@exemple.ca", password: "motdepasse" });
  await db.doc(`users/${uid}`).set({ displayName: "Zoé Fermé", email: "Ferme@exemple.ca", role: ["donneur_ouvrage", "deneigeur_x"] });
  await db.doc(`users/${uid}/lectures/d1`).set({ luAt: TS.now() });
  await db.doc("listeAttente/ferme@exemple.ca").set({ courriel: "ferme@exemple.ca", createdAt: TS.now() });
  await db.doc("listeAttente/pro:ferme@exemple.ca").set({ courriel: "ferme@exemple.ca", role: "pro", createdAt: TS.now() });
  await db.doc("demandes/ferm-client").set({ statut: "completee", donneurOuvrageId: uid, donneurPrenom: "Zoé", titre: "Entrée", description: "Code de porte 1234", deneigeurId: "den1", deneigeurPrenom: "Marc", paiement: { montantTotal: 40, statutPaiement: "verse" } });
  await db.doc("demandes/ferm-client/prive/adresse").set({ adresse: "1 rue X" });
  await db.collection("messages/ferm-client/messages").add({ expediteurId: uid, contenu: "Salut" });
  await db.doc("demandes/ferm-ouverte").set({ statut: "ouverte", donneurOuvrageId: uid, donneurPrenom: "Zoé", titre: "Stationnement" });
  await db.doc("demandes/ferm-deneigeur").set({ statut: "completee", donneurOuvrageId: "client1", donneurPrenom: "Mireille", deneigeurId: uid, deneigeurPrenom: "Zoé", deneigeurNote: { moyenne: 5, nombre: 1 }, paiement: { statutPaiement: "verse" } });
  await db.doc("demandes/ferm-deneigeur/prive/photo-0").set({ donnees: "x" });
  assert.deepEqual(await appel(compte.fermerCompte, uid, { confirmation: "FERMER" }), { ok: true });
  assert.equal((await db.doc(`users/${uid}`).get()).exists, false);
  assert.equal((await db.doc(`users/${uid}/lectures/d1`).get()).exists, false);
  assert.equal((await db.doc("listeAttente/ferme@exemple.ca").get()).exists, false);
  assert.equal((await db.doc("listeAttente/pro:ferme@exemple.ca").get()).exists, false);
  await assert.rejects(getAuth().getUser(uid), /no user record|user-not-found/i);
  const c = await lire("ferm-client");
  assert.equal(c.donneurPrenom, "Compte fermé"); assert.equal(c.description, ""); assert.equal(c.titre, "Entrée");
  assert.equal(c.paiement.montantTotal, 40, "registre de paiement gardé");
  assert.equal((await db.doc("demandes/ferm-client/prive/adresse").get()).exists, false);
  assert.equal((await db.collection("messages/ferm-client/messages").get()).size, 0);
  assert.equal((await lire("ferm-ouverte")).statut, "annulee");
  const d = await lire("ferm-deneigeur");
  assert.equal(d.deneigeurPrenom, "Compte fermé"); assert.equal(d.deneigeurNote, null); assert.equal(d.evaluee, true);
  assert.equal(d.donneurPrenom, "Mireille", "l'autre personne n'est pas touchée");
  assert.equal((await db.doc("demandes/ferm-deneigeur/prive/photo-0").get()).exists, false);
});

console.log("Liste d'attente (Pro distinct)");
const la = await import(`${REPO}functions/src/listeAttente.js`);
await test("liste d'attente : Pro a sa propre entrée avec l'entreprise, sans écraser l'inscription client", async () => {
  globalThis.fetch = fetchGeocodage;
  const base = { nom: "Léa Duo", courriel: "Duo@Exemple.ca", codePostal: "G1L 2M4" };
  await la.rejoindreListeAttente.run({ data: { ...base, role: "client" } });
  await echoue(la.rejoindreListeAttente.run({ data: { ...base, role: "pro" } }), "invalid-argument", "pro sans entreprise");
  await la.rejoindreListeAttente.run({ data: { ...base, role: "pro", entreprise: " Déneigement Duo inc. " } });
  const client = (await db.doc("listeAttente/duo@exemple.ca").get()).data();
  const pro = (await db.doc("listeAttente/pro:duo@exemple.ca").get()).data();
  assert.equal(client.role, "client"); assert.equal(client.entreprise, undefined);
  assert.equal(pro.role, "pro"); assert.equal(pro.entreprise, "Déneigement Duo inc."); assert.equal(pro.ville, "Québec");
  await echoue(la.rejoindreListeAttente.run({ data: { ...base, role: "admin" } }), "invalid-argument", "rôle inconnu");
});

await test("liste d'attente : rôle facultatif, précisé ensuite sans être effacé par une réinscription", async () => {
  globalThis.fetch = fetchGeocodage;
  const base = { nom: "Sam Simple", courriel: "simple@exemple.ca", codePostal: "G1L 2M4" };
  await la.rejoindreListeAttente.run({ data: base });
  assert.equal((await db.doc("listeAttente/simple@exemple.ca").get()).data().role, undefined);
  await la.rejoindreListeAttente.run({ data: { ...base, role: "les_deux" } });
  assert.equal((await db.doc("listeAttente/simple@exemple.ca").get()).data().role, "les_deux");
  await la.rejoindreListeAttente.run({ data: base });
  assert.equal((await db.doc("listeAttente/simple@exemple.ca").get()).data().role, "les_deux");
});

process.env.URL_SITE = "https://snowro.com";
const conf = await import(`${REPO}functions/src/confirmationListeAttente.js`);
const instantane = async (ref) => { const snap = await ref.get(); return { data: () => snap.data(), ref }; };
await test("liste d'attente : nom complet requis ; double confirmation (jeton, lien, confirmé, renvoi limité)", async () => {
  globalThis.fetch = fetchGeocodage;
  const base = { nom: "  Jeanne   Tremblay ", courriel: "Jeanne@Exemple.ca", codePostal: "G1L 2M4" };
  await echoue(la.rejoindreListeAttente.run({ data: { ...base, nom: "" } }), "invalid-argument", "sans nom");
  const r = await la.rejoindreListeAttente.run({ data: base });
  assert.equal(r.confirmationRequise, true);
  const ref = db.doc("listeAttente/jeanne@exemple.ca");
  const e1 = (await ref.get()).data();
  assert.equal(e1.nom, "Jeanne Tremblay"); assert.equal(e1.confirmee, false); assert.match(e1.jetonConfirmation, /^[0-9a-f]{48}$/);
  // Moins de 10 minutes plus tard : même jeton (pas de nouveau courriel).
  await la.rejoindreListeAttente.run({ data: { ...base, role: "deneigeur" } });
  assert.equal((await ref.get()).data().jetonConfirmation, e1.jetonConfirmation);
  await echoue(la.confirmerListeAttente.run({ data: { c: "jeanne@exemple.ca", j: "0".repeat(48) } }), "failed-precondition", "mauvais jeton");
  const ok = await la.confirmerListeAttente.run({ data: { c: "jeanne@exemple.ca", j: e1.jetonConfirmation } });
  assert.deepEqual(ok, { ok: true, deja: false, prenom: "Jeanne", ville: "Québec" });
  const e2 = (await ref.get()).data();
  assert.equal(e2.confirmee, true); assert.equal(e2.jetonConfirmation, undefined); assert.equal(e2.role, "deneigeur");
  assert.equal((await la.confirmerListeAttente.run({ data: { c: "jeanne@exemple.ca", j: e1.jetonConfirmation } })).deja, true);
  // Déjà confirmée : une réinscription ne redemande pas de confirmation.
  assert.equal((await la.rejoindreListeAttente.run({ data: base })).confirmationRequise, false);
  assert.equal((await ref.get()).data().confirmee, true);
  await echoue(la.confirmerListeAttente.run({ data: { c: "x", j: "pas-un-jeton" } }), "invalid-argument", "jeton mal formé");
});
await test("liste d'attente : lien expiré refusé ; nouveau lien après 10 minutes", async () => {
  const ref = db.doc("listeAttente/tard@exemple.ca");
  await ref.set({ nom: "Tom Tard", courriel: "tard@exemple.ca", confirmee: false, jetonConfirmation: "a".repeat(48), jetonEnvoyeAt: TS.fromMillis(Date.now() - 8 * 24 * 3600e3), jetonExpireAt: TS.fromMillis(Date.now() - 1000) });
  const e = await echoue(la.confirmerListeAttente.run({ data: { c: "tard@exemple.ca", j: "a".repeat(48) } }), "failed-precondition", "expiré");
  assert.equal(e.message, "lien-expire");
  globalThis.fetch = fetchGeocodage;
  await la.rejoindreListeAttente.run({ data: { nom: "Tom Tard", courriel: "tard@exemple.ca", codePostal: "G1L 2M4" } });
  const nouveau = (await ref.get()).data();
  assert.notEqual(nouveau.jetonConfirmation, "a".repeat(48));
  assert.ok(nouveau.jetonExpireAt.toMillis() > Date.now() + 6 * 24 * 3600e3);
});
await test("liste d'attente : courriel de confirmation avec le lien, envoyé seulement quand le jeton change", async () => {
  const envoisConf = [];
  globalThis.fetch = async (url, options) => {
    envoisConf.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ id: `resend-conf-${envoisConf.length}` }) };
  };
  const ref = db.doc("listeAttente/lien@exemple.ca");
  await ref.set({ nom: "Lina Lien", courriel: "lien@exemple.ca", ville: "Québec", confirmee: false, jetonConfirmation: "b".repeat(48) });
  const apres = await instantane(ref);
  await conf.envoyerConfirmationListeAttente.run({ params: { id: "lien@exemple.ca" }, data: { before: { data: () => undefined }, after: apres } });
  assert.equal(envoisConf.length, 1);
  assert.deepEqual(envoisConf[0].to, ["lien@exemple.ca"]);
  assert.match(envoisConf[0].subject, /Confirmez votre inscription/);
  assert.ok(envoisConf[0].html.includes(`https://snowro.com/liste/confirmer?c=lien%40exemple.ca&amp;j=${"b".repeat(48)}`));
  assert.match(envoisConf[0].html, /Bonjour Lina/);
  assert.equal((await ref.get()).data().confirmation.statut, "envoyee");
  // Écriture du statut : même jeton, aucun nouvel envoi.
  await conf.envoyerConfirmationListeAttente.run({ params: { id: "lien@exemple.ca" }, data: { before: apres, after: await instantane(ref) } });
  assert.equal(envoisConf.length, 1);
});

console.log("Avis de nouvelles demandes aux déneigeurs");
const al = await import(`${REPO}functions/src/alertesDemandes.js`);
await test("nouvelle demande : courriel aux déneigeurs de la ville seulement, sans adresse, au plus un par 20 minutes", async () => {
  const envoisAlerte = [];
  globalThis.fetch = async (url, options) => {
    envoisAlerte.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ id: `resend-al-${envoisAlerte.length}` }) };
  };
  const g = (lat, lng) => geohashLib.encode(lat, lng);
  await db.doc("users/alA").set({ displayName: "Alex Dupuis", email: "alex@exemple.ca", role: ["deneigeur_x"], villeGeoId: "ID_QUEBEC", ville: "Québec", addressGeohash: g(46.83, -71.22) });
  await db.doc("users/alB").set({ displayName: "Bea", email: "bea@exemple.ca", role: ["deneigeur_x"], villeGeoId: "ID_QUEBEC", alertesDemandesCourriel: false });
  await db.doc("users/alC").set({ displayName: "Carl", email: "carl@exemple.ca", role: ["deneigeur_x"], villeGeoId: "ID_LEVIS" });
  await db.doc("users/alD").set({ displayName: "Dom", email: "dom@exemple.ca", role: ["deneigeur_x"], villeGeoId: "ID_QUEBEC", derniereAlerteDemandeAt: TS.fromMillis(Date.now() - 5 * 60e3) });
  await db.doc("users/alE").set({ displayName: "Eve", email: "eve@exemple.ca", role: ["donneur_ouvrage", "deneigeur_x"], villeGeoId: "ID_QUEBEC" });
  await db.doc("users/alF").set({ displayName: "Fred", email: "fred@exemple.ca", role: ["donneur_ouvrage"], villeGeoId: "ID_QUEBEC" });
  const ref = db.doc("demandes/al-1");
  await ref.set({ statut: "ouverte", villeGeoId: "ID_QUEBEC", ville: "Québec", quartier: "Limoilou", titre: "Entrée double + balcon", remunerationOfferte: 45, outilsFournis: true, dateHeureSouhaitee: TS.fromMillis(Date.now() + 20 * 3600e3), adresseGeohash: g(46.826, -71.2206).slice(0, 7), donneurOuvrageId: "alE" });
  await al.avertirDeneigeursNouvelleDemande.run({ params: { demandeId: "al-1" }, data: await ref.get() });
  assert.deepEqual(envoisAlerte.map((e) => e.to[0]).sort(), ["alex@exemple.ca", "marc@exemple.ca"], "Alex et Marc (Québec) ; pas Bea (désactivé), Carl (Lévis), Dom (averti il y a 5 min), Eve (a publié), Fred (pas déneigeur)");
  const courriel = envoisAlerte.find((e) => e.to[0] === "alex@exemple.ca");
  assert.match(courriel.subject, /Nouvelle demande à Limoilou : 39,40\u00A0\$ pour vous/);
  assert.match(courriel.html, /Bonjour Alex/); assert.match(courriel.html, /km de chez vous/); assert.match(courriel.html, /outils fournis/);
  assert.ok(!/3e Avenue|adresse exacte/.test(courriel.html.replace("jamais", "")), "aucune adresse");
  assert.ok((await db.doc("users/alA").get()).data().derniereAlerteDemandeAt);
  assert.equal((await ref.get()).data().alerte.envoyes, 2);
  // Deuxième demande (publiée par Fred) quelques minutes plus tard : Alex et Marc
  // viennent d'être avertis ; seule Eve, qui n'en est pas l'autrice cette fois, l'est.
  const ref2 = db.doc("demandes/al-2");
  await ref2.set({ statut: "ouverte", villeGeoId: "ID_QUEBEC", quartier: "Saint-Roch", titre: "Stationnement", remunerationOfferte: 30, donneurOuvrageId: "alF" });
  await al.avertirDeneigeursNouvelleDemande.run({ params: { demandeId: "al-2" }, data: await ref2.get() });
  assert.deepEqual(envoisAlerte.slice(2).map((e) => e.to[0]), ["eve@exemple.ca"]);
});

console.log("Textos (Twilio)");
const sms = await import(`${REPO}functions/src/sms.js`);
const tel = await import(`${REPO}functions/src/telephone.js`);
const tc = await import(`${REPO}functions/src/textosCycle.js`);
const textos = [];
const fetchTextos = async (url, options) => {
  if (String(url).includes("api.twilio.com")) {
    const corps = new URLSearchParams(options.body);
    textos.push({ a: corps.get("To"), de: corps.get("From"), texte: corps.get("Body"), auth: options.headers.Authorization });
    return { ok: true, json: async () => ({ sid: `SM${textos.length}` }) };
  }
  return { ok: true, json: async () => ({ id: "resend-x" }) };
};
const avecConsentementSms = { consents: { notificationsSMS: { granted: true, version: 2 } } };
await test("textos : numéros nord-américains normalisés, les autres refusés", async () => {
  assert.equal(sms.normaliserNumero("418 555-1234"), "+14185551234");
  assert.equal(sms.normaliserNumero("+1 (581) 555-0000"), "+15815550000");
  assert.equal(sms.normaliserNumero("1-418-555-1234"), "+14185551234");
  assert.equal(sms.normaliserNumero("555-1234"), null);
  assert.equal(sms.normaliserNumero("+33 6 12 34 56 78"), null);
  assert.equal(sms.normaliserNumero("011 555 1234"), null);
});
await test("textos : code de vérification par texto, mauvais code compté, bon code enregistre le numéro", async () => {
  globalThis.fetch = fetchTextos;
  textos.length = 0;
  await db.doc("users/telA").set({ displayName: "Tia", email: "tia@exemple.ca" });
  await echoue(appel(tel.envoyerCodeTelephone, "telA", { numero: "555" }), "invalid-argument", "numéro invalide");
  await appel(tel.envoyerCodeTelephone, "telA", { numero: "418 555-1234" });
  assert.equal(textos.length, 1);
  assert.equal(textos[0].a, "+14185551234"); assert.equal(textos[0].de, "+15815550000");
  assert.equal(textos[0].auth, `Basic ${Buffer.from("ACfactice:jeton-factice").toString("base64")}`);
  const code = textos[0].texte.match(/(\d{6})/)[1];
  assert.ok(!JSON.stringify((await db.doc("verificationsTelephone/telA").get()).data()).includes(code), "code jamais stocké en clair");
  const e = await echoue(appel(tel.envoyerCodeTelephone, "telA", { numero: "418 555-1234" }), "resource-exhausted", "un code par minute");
  assert.equal(e.message, "attendre");
  const faux = code === "000000" ? "111111" : "000000";
  assert.deepEqual(await appel(tel.verifierCodeTelephone, "telA", { code: faux }), { ok: false });
  assert.equal((await db.doc("verificationsTelephone/telA").get()).data().essais, 1);
  assert.deepEqual(await appel(tel.verifierCodeTelephone, "telA", { code }), { ok: true, numero: "+14185551234" });
  assert.equal((await db.doc("users/telA").get()).data().telephoneVerifie, "+14185551234");
  await echoue(appel(tel.verifierCodeTelephone, "telA", { code }), "failed-precondition", "code déjà utilisé");
  await appel(tel.retirerTelephone, "telA", {});
  assert.equal((await db.doc("users/telA").get()).data().telephoneVerifie, null);
});
await test("textos : refus de Twilio, le code d'erreur Twilio est renvoyé (sans secret)", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ code: 20003, message: "Authenticate" }) });
  await db.doc("users/telB").set({ displayName: "Bo", email: "bo@exemple.ca" });
  const e = await echoue(appel(tel.envoyerCodeTelephone, "telB", { numero: "418 555-9876" }), "unavailable", "Twilio refuse");
  assert.equal(e.message, "envoi-impossible");
  assert.deepEqual(e.details, { codeTwilio: 20003, statut: 401 });
  assert.equal((await db.doc("verificationsTelephone/telB").get()).exists, false, "rien d'enregistré si le texto n'est pas parti");
});
await test("textos : seulement avec consentement ET numéro vérifié", async () => {
  globalThis.fetch = fetchTextos;
  textos.length = 0;
  assert.equal(await sms.envoyerTexto({ telephoneVerifie: "+14185551234" }, "x"), false, "sans consentement");
  assert.equal(await sms.envoyerTexto(avecConsentementSms, "x"), false, "sans numéro vérifié");
  assert.equal(await sms.envoyerTexto({ ...avecConsentementSms, telephoneVerifie: "+14185551234" }, "Bonjour"), true);
  assert.equal(textos.length, 1);
  assert.match(textos[0].texte, /^\[Test\] Bonjour$/);
});
await test("textos : un accord à l'ancienne version du texte ne suffit pas", async () => {
  globalThis.fetch = fetchTextos;
  textos.length = 0;
  const v1 = { consents: { notificationsSMS: { granted: true, version: 1 } }, telephoneVerifie: "+14185551234" };
  assert.equal(await sms.envoyerTexto(v1, "x"), false);
  assert.equal(textos.length, 0);
});
await test("textos : au plus 3 codes par jour vers un même numéro, peu importe le compte", async () => {
  globalThis.fetch = fetchTextos;
  textos.length = 0;
  for (const u of ["limA", "limB", "limC", "limD"]) await db.doc(`users/${u}`).set({ displayName: u });
  for (const u of ["limA", "limB", "limC"]) await appel(tel.envoyerCodeTelephone, u, { numero: "581 555-7777" });
  const e = await echoue(appel(tel.envoyerCodeTelephone, "limD", { numero: "581 555-7777" }), "resource-exhausted", "4e code au même numéro");
  assert.equal(e.message, "trop-de-codes-numero");
  assert.equal(textos.length, 3);
  const limites = await db.collection("limitesTelephone").get();
  assert.ok(!JSON.stringify(limites.docs.map((d) => [d.id, d.data()])).includes("5815557777"), "numéro jamais stocké en clair");
});
await test("textos : plafond global de codes par jour", async () => {
  globalThis.fetch = fetchTextos;
  const jour = new Date().toISOString().slice(0, 10);
  await db.doc(`limitesTelephone/jour-${jour}`).set({ compteur: tel.PLAFOND_CODES_PAR_JOUR });
  await db.doc("users/limE").set({ displayName: "E" });
  const e = await echoue(appel(tel.envoyerCodeTelephone, "limE", { numero: "581 555-8888" }), "resource-exhausted", "plafond");
  assert.equal(e.message, "plafond-atteint");
  await db.doc(`limitesTelephone/jour-${jour}`).delete();
});
await test("textos : consentement refusé sans cellulaire vérifié ; retrait du numéro retire l'accord", async () => {
  globalThis.fetch = fetchTextos;
  textos.length = 0;
  const consents = await import(`${REPO}functions/src/consents.js`);
  await db.doc("users/essai1").set({ displayName: "Eva" });
  const e = await echoue(appel(consents.grantConsent, "essai1", { type: "notificationsSMS" }), "failed-precondition", "sans numéro");
  assert.equal(e.message, "telephone-non-verifie");
  await db.doc("users/essai1").update({ telephoneVerifie: "+14185553333" });
  await appel(consents.grantConsent, "essai1", { type: "notificationsSMS" });
  assert.equal((await db.doc("users/essai1").get()).data().consents.notificationsSMS.version, 2);
  await appel(tel.retirerTelephone, "essai1", {});
  const p = (await db.doc("users/essai1").get()).data();
  assert.equal(p.telephoneVerifie, null);
  assert.equal(p.consents.notificationsSMS.granted, false);
  assert.equal(p.consents.notificationsSMS.retraitPar, "retrait-numero");
});
await test("textos : STOP par texto retire le consentement (signature Twilio vérifiée)", async () => {
  const entrants = await import(`${REPO}functions/src/textosEntrants.js`);
  await db.doc("users/stop1").set({ displayName: "Sam", telephoneVerifie: "+14185554444", consents: { notificationsSMS: { granted: true, version: 2 } } });
  const url = "https://northamerica-northeast1-demo-snowro.cloudfunctions.net/recevoirTexteTwilio";
  const appelWebhook = async (params, signature) => {
    const req = { method: "POST", body: params, originalUrl: "/recevoirTexteTwilio", get: (h) => ({ host: "exemple.run.app", "X-Twilio-Signature": signature })[h] };
    const res = { statut: 200, status(c) { this.statut = c; return this; }, type() { return this; }, send(b) { this.corps = b; return this; } };
    await entrants.recevoirTexteTwilio(req, res);
    return res;
  };
  const params = { AccountSid: "ACfactice", From: "+14185554444", To: "+15815550000", Body: "Stop" };
  const r1 = await appelWebhook(params, "fausse-signature");
  assert.equal(r1.statut, 403);
  assert.equal((await db.doc("users/stop1").get()).data().consents.notificationsSMS.granted, true, "rien sans signature valide");
  const r2 = await appelWebhook(params, entrants.signatureTwilio("jeton-factice", url, params));
  assert.equal(r2.statut, 200);
  const c = (await db.doc("users/stop1").get()).data().consents.notificationsSMS;
  assert.equal(c.granted, false);
  assert.equal(c.retraitPar, "stop");
  assert.equal(entrants.estArret("arrêt"), true);
  assert.equal(entrants.estArret("Bonjour"), false);
  assert.equal(entrants.estArret("", "STOP"), true);
});
await test("textos : client averti quand sa demande est acceptée, puis faite ; rien sans changement d'étape", async () => {
  globalThis.fetch = fetchTextos;
  textos.length = 0;
  await db.doc("users/telClient").set({ displayName: "Rose", email: "rose@exemple.ca", ...avecConsentementSms, telephoneVerifie: "+14185550001" });
  const base = { titre: "Entrée double", donneurOuvrageId: "telClient", deneigeurPrenom: "Marc" };
  const evt = (avant, apres) => ({ params: { demandeId: "tc-1" }, data: { before: { data: () => avant }, after: { data: () => apres } } });
  await tc.textosCycleDemande.run(evt({ ...base, statut: "ouverte" }, { ...base, statut: "matchee" }));
  await tc.textosCycleDemande.run(evt({ ...base, statut: "matchee" }, { ...base, statut: "matchee", dernierMessage: {} }));
  await tc.textosCycleDemande.run(evt({ ...base, statut: "matchee" }, { ...base, statut: "faite" }));
  assert.equal(textos.length, 2);
  assert.match(textos[0].texte, /Marc s'occupe de votre demande « Entrée double »/);
  assert.match(textos[1].texte, /Marc a terminé « Entrée double »\. Vous avez 12 h pour confirmer/);
  assert.ok(textos.every((t) => t.a === "+14185550001"));
});
await test("textos : nouvelle demande, texto au déneigeur consentant même sans avis par courriel", async () => {
  globalThis.fetch = fetchTextos;
  textos.length = 0;
  await db.doc("users/telDen").set({ displayName: "Gab", email: "gab@exemple.ca", role: ["deneigeur_x"], villeGeoId: "ID_TROIS", alertesDemandesCourriel: false, ...avecConsentementSms, telephoneVerifie: "+18195550002" });
  const ref = db.doc("demandes/tc-alerte");
  await ref.set({ statut: "ouverte", villeGeoId: "ID_TROIS", quartier: "Cap", titre: "Stationnement", remunerationOfferte: 30, donneurOuvrageId: "autre" });
  await al.avertirDeneigeursNouvelleDemande.run({ params: { demandeId: "tc-alerte" }, data: await ref.get() });
  assert.equal(textos.length, 1);
  assert.equal(textos[0].a, "+18195550002");
  assert.match(textos[0].texte, /Snowro : nouvelle demande à Cap, 25,60\u00A0\$ pour vous\. https:\/\/snowro\.com\/tableau-de-bord/);
  assert.equal((await ref.get()).data().alerte.envoyes, 1);
});

await test("admin : métriques agrégées ; accès réservé aux UID de ADMIN_UIDS", async () => {
  const ta = await import(`${REPO}functions/src/tableauAdmin.js`);
  const t = (ms) => ({ toMillis: () => ms });
  const maintenant = Date.UTC(2026, 10, 13, 15, 0);
  const H = 3600e3;
  const m = ta.calculerMetriques({
    users: [
      { role: ["donneur_ouvrage"], createdAt: t(maintenant - 2 * H), ville: "Québec", carte: { derniers4: "4242" } },
      { role: ["deneigeur_x"], createdAt: t(maintenant - 3 * 24 * H), ville: "Québec", villeGeoId: "ID_QUEBEC", connectStatus: "actif", telephoneVerifie: "+14185550000" },
      { role: ["donneur_ouvrage", "deneigeur_x"], createdAt: t(maintenant - 40 * 24 * H), ville: "Lévis", villeGeoId: "ID_LEVIS" },
      { role: [], createdAt: t(maintenant - 10 * H) },
    ],
    demandes: [
      { statut: "ouverte", createdAt: t(maintenant - H), ville: "Québec" },
      { statut: "completee", createdAt: t(maintenant - 30 * H), matchedAt: t(maintenant - 29 * H), faiteAt: t(maintenant - 20 * H), confirmeeAt: t(maintenant - 18 * H), ville: "Québec", paiement: { montantTotal: 40, fraisSnowro: 5.2, montantDeneigeur: 34.8, statutPaiement: "verse" } },
      { statut: "annulee", createdAt: t(maintenant - 50 * H), matchedAt: t(maintenant - 49.5 * H), annulation: { raison: "retard" }, ville: "Lévis", paiement: { montantTotal: 30, statutPaiement: "rembourse" } },
      { statut: "annulee", createdAt: t(maintenant - 60 * H), ville: "Lévis" },
    ],
    listeAttente: [{ confirmee: true, createdAt: t(maintenant - 2 * 24 * H) }, { confirmee: false, createdAt: t(maintenant - 20 * 24 * H) }],
  }, maintenant);
  assert.deepEqual(
    { total: m.comptes.total, j1: m.comptes.j1, j7: m.comptes.j7, clients: m.comptes.clients, deneigeurs: m.comptes.deneigeurs, deux: m.comptes.deuxRoles, sans: m.comptes.sansRole, actifs: m.comptes.deneigeursVersementActif, cartes: m.comptes.cartes },
    { total: 4, j1: 2, j7: 3, clients: 2, deneigeurs: 2, deux: 1, sans: 1, actifs: 1, cartes: 1 },
  );
  assert.equal(m.demandes.total, 4); assert.equal(m.demandes.ouvertesMaintenant, 1);
  assert.equal(m.demandes.tauxAcceptation, 0.667, "2 acceptées sur 3 tranchées");
  assert.equal(m.demandes.delaiMedianAcceptationMin, 45); assert.equal(m.demandes.delaiMedianConfirmationH, 2);
  assert.equal(m.demandes.annuleesRetard, 1);
  assert.deepEqual({ v: m.argent.volumeConfirme, f: m.argent.fraisSnowro, r: m.argent.rembourse, p: m.argent.panierMoyen }, { v: 40, f: 5.2, r: 30, p: 40 });
  assert.deepEqual(m.listeAttente, { total: 2, confirmees: 1, j7: 1 });
  assert.equal(m.parJour.length, 30);
  assert.equal(m.parJour.reduce((s, j) => s + j.comptes, 0), 3, "le compte de 40 jours est hors fenêtre");
  assert.equal(m.villes[0].ville, "Québec");
  // Aucun renseignement identifiant dans la réponse.
  assert.doesNotMatch(JSON.stringify(m), /4242|\+1418|ID_QUEBEC/);
  const ga = await import(`${REPO}functions/src/analyticsAdmin.js`);
  const ligne = (dims, vals) => ({ dimensionValues: dims.map((value) => ({ value })), metricValues: vals.map((value) => ({ value: String(value) })) });
  const f2 = ga.mettreEnForme({
    totaux: { rows: [ligne(["j7"], [40, 55, 30]), ligne(["j30"], [120, 160, 90])] },
    canaux: { rows: [ligne(["Organic Search"], [70, 60]), ligne(["Referral"], [30, 25])] },
    evenements: { rows: [ligne(["sign_up"], [12]), ligne(["demande_publiee"], [5])] },
    parJour: { rows: [ligne(["20261113"], [9]), ligne(["20261112"], [4])] },
  });
  assert.deepEqual(f2.visiteurs, { j7: 40, j30: 120 }); assert.deepEqual(f2.sessions, { j7: 55, j30: 160 });
  assert.equal(f2.canaux[0].canal, "Organic Search"); assert.equal(f2.evenements.sign_up, 12); assert.equal(f2.evenements.demande_confirmee, 0);
  assert.deepEqual(f2.parJour, [{ jour: "2026-11-12", visiteurs: 4 }, { jour: "2026-11-13", visiteurs: 9 }]);
  await echoue(appel(ga.analyticsAdmin, "client1", {}), "permission-denied", "GA pas admin");
  // Accès.
  await echoue(appel(ta.metriquesAdmin, null, {}), "unauthenticated", "sans connexion");
  await echoue(appel(ta.metriquesAdmin, "client1", {}), "permission-denied", "pas admin");
  assert.equal(ta.estAdmin("client1"), false);
});
await test("compteur public : déneigeurs par ville, seulement les villes d'au moins 10", async () => {
  const vp = await import(`${REPO}functions/src/villesPubliques.js`);
  const lot = db.batch();
  for (let i = 0; i < 12; i++) lot.set(db.doc(`users/cvA${i}`), { role: ["deneigeur_x"], villeGeoId: "ID_COMPTEUR_A", ville: "Villeneuve" });
  for (let i = 0; i < 4; i++) lot.set(db.doc(`users/cvB${i}`), { role: ["deneigeur_x"], villeGeoId: "ID_COMPTEUR_B", ville: "Petiteville" });
  lot.set(db.doc("users/cvC"), { role: ["donneur_ouvrage"], villeGeoId: "ID_COMPTEUR_A", ville: "Villeneuve" });
  await lot.commit();
  const villes = await vp.calculerVillesPubliques();
  assert.deepEqual(villes.find((v) => v.nom === "Villeneuve"), { nom: "Villeneuve", deneigeurs: 12 }, "clients non comptés");
  assert.equal(villes.some((v) => v.nom === "Petiteville"), false, "sous le seuil : jamais publiée");
  const publie = (await db.doc("statsPubliques/villes").get()).data();
  assert.equal(publie.seuil, 10);
  assert.ok(!JSON.stringify(publie).includes("cvA"), "aucun identifiant de compte");
});

console.log("Firestore rules");
globalThis.fetch = fetchOriginal;
const env = await initializeTestEnvironment({ projectId: "demo-snowro", firestore: { rules: readFileSync(`${REPO}firestore.rules`, "utf8"), host: "127.0.0.1", port: 8080 } });
const c1 = env.authenticatedContext("client1").firestore();
const d1 = env.authenticatedContext("den1").firestore();
const d3 = env.authenticatedContext("den3").firestore();
await test("compteur public : lisible sans connexion, jamais modifiable", async () => {
  const anonyme = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anonyme, "statsPubliques/villes")));
  await assertFails(setDoc(doc(anonyme, "statsPubliques/villes"), { villes: [] }));
  await assertFails(setDoc(doc(c1, "statsPubliques/villes"), { villes: [] }));
});
await test("users : lecture de sa fiche seulement", async () => {
  await assertSucceeds(getDoc(doc(c1, "users/client1")));
  await assertFails(getDoc(doc(c1, "users/den1")));
});
await test("carnet d'adresses : lecture par le propriétaire seulement, aucune écriture client", async () => {
  await assertSucceeds(getDocs(collection(c1, "users/client1/adresses")));
  await assertFails(getDocs(collection(d1, "users/client1/adresses")));
  await assertFails(setDoc(doc(c1, "users/client1/adresses/x"), { nom: "Maison", attestation: { version: 1 } }));
});
await test("users : impossible de modifier sa note ou son compteur ; rôles modifiables", async () => {
  await assertFails(updateDoc(doc(d1, "users/den1"), { ratingAvg: 1 }));
  await assertFails(updateDoc(doc(d1, "users/den1"), { ratingCriteres: { qualite: { moyenne: 5, nombre: 99 } } }));
  await assertFails(updateDoc(doc(d1, "users/den1"), { nbJobsCompletees: 999 }));
  await assertSucceeds(setDoc(doc(d1, "users/den1"), { role: ["deneigeur_x", "donneur_ouvrage"] }, { merge: true }));
});
await test("demandes : lecture par un connecté, aucune écriture client", async () => {
  await assertSucceeds(getDoc(doc(d3, `demandes/${id}`)));
  await assertFails(updateDoc(doc(d3, `demandes/${id}`), { statut: "matchee", deneigeurId: "den3" }));
  await assertFails(addDoc(collection(c1, "demandes"), { donneurOuvrageId: "client1", statut: "ouverte" }));
});
await test("photo et évaluation privées : client et déneigeur choisi seulement", async () => {
  await db.doc("demandes/privee1").set({ statut: "faite", donneurOuvrageId: "client1", deneigeurId: "den1" });
  await db.doc("demandes/privee1/prive/photo").set({ donnees: "x" });
  await assertSucceeds(getDoc(doc(c1, "demandes/privee1/prive/photo")));
  await assertSucceeds(getDoc(doc(d1, "demandes/privee1/prive/photo")));
  await assertFails(getDoc(doc(d3, "demandes/privee1/prive/photo")));
  await assertFails(setDoc(doc(d1, "demandes/privee1/prive/photo"), { donnees: "autre" }));
});
await test("adresse privée : client et déneigeur choisi seulement", async () => {
  await assertSucceeds(getDoc(doc(c1, `demandes/${id}/prive/adresse`)));
  await assertSucceeds(getDoc(doc(d1, `demandes/${id}/prive/adresse`)));
  await assertFails(getDoc(doc(d3, `demandes/${id}/prive/adresse`)));
});
const msg = (expediteurId, contenu) => ({ expediteurId, contenu, createdAt: serverTimestamp() });
await test("messages : les deux personnes du match écrivent et lisent, un tiers non", async () => {
  await assertSucceeds(addDoc(collection(c1, "messages/conv1/messages"), msg("client1", "Merci !")));
  await assertSucceeds(addDoc(collection(d1, "messages/conv1/messages"), msg("den1", "Avec plaisir")));
  await assertSucceeds(getDocs(collection(c1, "messages/conv1/messages")));
  await assertFails(getDocs(collection(d3, "messages/conv1/messages")));
  await assertFails(addDoc(collection(d3, "messages/conv1/messages"), msg("den3", "Salut")));
});
await test("messages : pas d'usurpation, pas de message vide ou trop long, heure du serveur obligatoire", async () => {
  await assertFails(addDoc(collection(c1, "messages/conv1/messages"), msg("den1", "Je suis Marc")));
  await assertFails(addDoc(collection(c1, "messages/conv1/messages"), msg("client1", "   ")));
  await assertFails(addDoc(collection(c1, "messages/conv1/messages"), msg("client1", "x".repeat(1001))));
  await assertFails(addDoc(collection(c1, "messages/conv1/messages"), { expediteurId: "client1", contenu: "Hier", createdAt: new Date(0) }));
  await assertFails(addDoc(collection(c1, "messages/conv1/messages"), { ...msg("client1", "Salut"), lu: true }));
});
await test("messages : demande terminée = lecture seule ; demande encore ouverte = rien", async () => {
  await assertSucceeds(getDocs(collection(c1, `messages/${id}/messages`)));
  await assertFails(addDoc(collection(c1, `messages/${id}/messages`), msg("client1", "Encore merci")));
  await db.doc("demandes/ouverte1").set({ statut: "ouverte", donneurOuvrageId: "client1" });
  await assertFails(getDocs(collection(c1, "messages/ouverte1/messages")));
  await assertFails(addDoc(collection(c1, "messages/ouverte1/messages"), msg("client1", "Allo ?")));
});
await test("lectures : privées, heure du serveur seulement", async () => {
  await assertSucceeds(setDoc(doc(c1, "users/client1/lectures/conv1"), { luAt: serverTimestamp() }));
  await assertFails(setDoc(doc(c1, "users/client1/lectures/conv1"), { luAt: new Date(2100, 0, 1) }));
  await assertFails(getDoc(doc(d1, "users/client1/lectures/conv1")));
});
await env.cleanup();
console.log(`\n${ok} tests réussis`);
process.exit(0);
