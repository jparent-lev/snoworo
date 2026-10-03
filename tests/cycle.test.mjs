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
const REPO = fileURLToPath(new URL("..", import.meta.url));

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
const base = { adresse: "1234, 3e Avenue, Québec", titre: "Entrée double + balcon", description: "Pelle sur le balcon", typeService: "entree_balcon", montant: 45, dateHeureSouhaitee: demain, outilsFournis: true };

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
  await appel(f.confirmerJob, "client1", { demandeId: id });
  const d = await lire(id);
  assert.equal(d.statut, "completee"); assert.equal(d.confirmationAuto, false); assert.equal(d.paiement.statutPaiement, "simule_verse");
  assert.equal((await db.doc("users/den1").get()).data().nbJobsCompletees, 24);
});
await test("confirmation automatique : seulement les jobs faites dont les 12 h sont écoulées", async () => {
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
await test("confirmer avec 4 étoiles et un mot : moyenne recalculée, mot privé", async () => {
  await db.doc("users/den3").set({ ratingAvg: 5, ratingCount: 1 }, { merge: true });
  await echoue(appel(f.confirmerJob, "client1", { demandeId: avecPhoto, note: 6 }), "invalid-argument", "note 6");
  await appel(f.confirmerJob, "client1", { demandeId: avecPhoto, note: 4, commentaire: "Merci, très propre !" });
  const den3 = (await db.doc("users/den3").get()).data();
  assert.equal(den3.ratingAvg, 4.5); assert.equal(den3.ratingCount, 2);
  assert.equal((await lire(avecPhoto)).evaluee, true);
  assert.deepEqual((({ note, commentaire }) => ({ note, commentaire }))((await db.doc(`demandes/${avecPhoto}/prive/evaluation`).get()).data()), { note: 4, commentaire: "Merci, très propre !" });
});
await test("évaluer après coup : une seule fois, client seulement, dans les 7 jours", async () => {
  const x = await jobFaite("den3");
  await echoue(appel(f.evaluerJob, "client1", { demandeId: x, note: 5 }), "failed-precondition", "pas encore confirmée");
  await appel(f.confirmerJob, "client1", { demandeId: x });
  assert.notEqual((await lire(x)).evaluee, true);
  await echoue(appel(f.evaluerJob, "den3", { demandeId: x, note: 5 }), "permission-denied", "déneigeur");
  await appel(f.evaluerJob, "client1", { demandeId: x, note: 5 });
  assert.equal((await db.doc("users/den3").get()).data().ratingCount, 3);
  await echoue(appel(f.evaluerJob, "client1", { demandeId: x, note: 1 }), "already-exists", "deux fois");
  const y = await jobFaite("den3");
  await appel(f.confirmerJob, "client1", { demandeId: y });
  await db.doc(`demandes/${y}`).update({ confirmeeAt: TS.fromMillis(Date.now() - 8 * 24 * 3600e3) });
  await echoue(appel(f.evaluerJob, "client1", { demandeId: y, note: 5 }), "failed-precondition", "après 7 jours");
});
await test("purge : photos et messages effacés 30 jours après la job, gardés si la job est signalée", async () => {
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
  assert.match(corps.subject, /Marc t'a écrit à propos de « Entrée double »/);
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
await test("conservation : liste d'attente et « Nous écrire » effacés après 24 mois, le reste gardé", async () => {
  const vieux = TS.fromMillis(Date.now() - 731 * 24 * 3600e3);
  await db.doc("listeAttente/vieux@exemple.ca").set({ courriel: "vieux@exemple.ca", createdAt: vieux });
  await db.doc("listeAttente/recent@exemple.ca").set({ courriel: "recent@exemple.ca", createdAt: TS.now() });
  await db.doc("messagesContact/vieux").set({ courriel: "a@exemple.ca", createdAt: vieux });
  await db.doc("messagesContact/recent").set({ courriel: "b@exemple.ca", createdAt: TS.now() });
  assert.deepEqual(await cons.appliquerConservation(), { listeAttente: 1, messagesContact: 1 });
  assert.equal((await db.doc("listeAttente/vieux@exemple.ca").get()).exists, false);
  assert.equal((await db.doc("listeAttente/recent@exemple.ca").get()).exists, true);
  assert.equal((await db.doc("messagesContact/recent").get()).exists, true);
});
await test("fermer son compte : refusé pendant une job en cours ou sans confirmation", async () => {
  await db.doc("demandes/ferm-encours").set({ statut: "matchee", donneurOuvrageId: "ferme1", deneigeurId: "den1" });
  await echoue(appel(compte.fermerCompte, "ferme1", {}), "invalid-argument", "sans confirmation");
  const e = await echoue(appel(compte.fermerCompte, "ferme1", { confirmation: "FERMER" }), "failed-precondition", "job en cours");
  assert.equal(e.message, "job-en-cours");
  await db.doc("demandes/ferm-encours").update({ statut: "completee" });
  await db.doc("demandes/ferm-versement").set({ statut: "completee", donneurOuvrageId: "client1", deneigeurId: "ferme1", paiement: { statutPaiement: "a_verser" } });
  assert.equal((await echoue(appel(compte.fermerCompte, "ferme1", { confirmation: "FERMER" }), "failed-precondition", "versement")).message, "versement-en-attente");
  await db.doc("demandes/ferm-versement").delete();
});
await test("fermer son compte : profil, connexion, adresses, photos, messages et liste d'attente effacés ; paiement gardé", async () => {
  const { uid } = await getAuth().createUser({ email: "ferme@exemple.ca", password: "motdepasse" });
  await db.doc(`users/${uid}`).set({ displayName: "Zoé Fermé", email: "Ferme@exemple.ca", role: ["donneur_ouvrage", "deneigeur_x"] });
  await db.doc(`users/${uid}/lectures/d1`).set({ luAt: TS.now() });
  await db.doc("listeAttente/ferme@exemple.ca").set({ courriel: "ferme@exemple.ca", createdAt: TS.now() });
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

console.log("Firestore rules");
globalThis.fetch = fetchOriginal;
const env = await initializeTestEnvironment({ projectId: "demo-snowro", firestore: { rules: readFileSync(`${REPO}firestore.rules`, "utf8"), host: "127.0.0.1", port: 8080 } });
const c1 = env.authenticatedContext("client1").firestore();
const d1 = env.authenticatedContext("den1").firestore();
const d3 = env.authenticatedContext("den3").firestore();
await test("users : lecture de sa fiche seulement", async () => {
  await assertSucceeds(getDoc(doc(c1, "users/client1")));
  await assertFails(getDoc(doc(c1, "users/den1")));
});
await test("users : impossible de modifier sa note ou son compteur ; rôles modifiables", async () => {
  await assertFails(updateDoc(doc(d1, "users/den1"), { ratingAvg: 5 }));
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
await test("messages : job terminée = lecture seule ; demande encore ouverte = rien", async () => {
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
