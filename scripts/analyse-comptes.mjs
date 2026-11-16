// Analyse en lecture seule des comptes de production, pour repérer des
// inscriptions automatisées. Lancée à la main par le workflow « Analyse des
// comptes ». Les journaux du dépôt sont publics : aucun nom, courriel, UID
// ni adresse n'est affiché. Les noms sont réduits à leur forme (Aaaa Aaaa),
// les domaines de courriel rares sont regroupés sous « autre ».
import { createRequire } from "node:module";

const { getAuth } = createRequire(new URL("../functions/package.json", import.meta.url))("firebase-admin/auth");

if (process.env.GCLOUD_PROJECT !== "snowro-app") throw new Error("Production seulement (snowro-app).");
// Même contournement que l'annonce d'ouverture : firebase-admin 12 ne lit pas
// les identifiants de la fédération GitHub à l'initialisation.
const fichierIdentifiants = process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const { db } = await import("../functions/src/admin.js");
if (fichierIdentifiants) process.env.GOOGLE_APPLICATION_CREDENTIALS = fichierIdentifiants;

const DOMAINES_COURANTS = new Set(["gmail.com", "hotmail.com", "outlook.com", "live.ca", "live.com", "yahoo.com", "yahoo.ca", "icloud.com", "videotron.ca", "videotron.qc.ca", "bell.net", "sympatico.ca", "hotmail.ca", "outlook.fr", "me.com", "protonmail.com", "proton.me"]);
const forme = (s) => String(s ?? "").replace(/\p{Lu}/gu, "A").replace(/\p{Ll}/gu, "a").replace(/\d/g, "9").slice(0, 30);
const ms = (t) => t?.toMillis?.() ?? (t ? Date.parse(t) : null);
const heure = (m) => (m ? new Date(m).toISOString().slice(0, 13).replace("T", " ") + " h UTC" : "?");
const voyelles = (s) => (String(s).match(/[aeiouyàâéèêëîïôùûü]/gi) ?? []).length;
const majusculesInternes = (s) => /\p{Ll}\p{Lu}/u.test(String(s));

// Comptes Auth (date de création, dernière connexion, courriel vérifié).
const auth = new Map();
let page;
do {
  const r = await getAuth().listUsers(1000, page);
  r.users.forEach((u) => auth.set(u.uid, u));
  page = r.pageToken;
} while (page);

const fiches = (await db.collection("users").get()).docs;
const lignes = [];
const domaines = new Map();
const parHeure = new Map();
for (const d of fiches) {
  const u = d.data();
  const a = auth.get(d.id);
  const nom = String(u.displayName ?? "");
  const courriel = String(u.email ?? a?.email ?? "").toLowerCase();
  const [local = "", domaine = ""] = courriel.split("@");
  const cree = ms(u.createdAt) ?? ms(a?.metadata?.creationTime);
  const derniere = ms(a?.metadata?.lastSignInTime);
  domaines.set(DOMAINES_COURANTS.has(domaine) ? domaine : domaine ? "autre" : "(aucun)", (domaines.get(DOMAINES_COURANTS.has(domaine) ? domaine : domaine ? "autre" : "(aucun)") ?? 0) + 1);
  const h = heure(cree);
  parHeure.set(h, (parHeure.get(h) ?? 0) + 1);
  const signes = [];
  if (nom && voyelles(nom) / Math.max(1, nom.replace(/\s/g, "").length) < 0.2) signes.push("nom sans voyelles");
  if (majusculesInternes(nom)) signes.push("majuscules au milieu du nom");
  if (/\d/.test(nom)) signes.push("chiffres dans le nom");
  if (nom && !/\s/.test(nom.trim()) && nom.length >= 12) signes.push("nom d'un seul long mot");
  if (/\d{3,}/.test(local)) signes.push("courriel avec 3 chiffres ou plus");
  if (local.replace(/\./g, "").length >= 6 && voyelles(local) / local.length < 0.15) signes.push("courriel sans voyelles");
  if ((local.match(/\./g) ?? []).length >= 3) signes.push("courriel avec 3 points ou plus");
  if (a && !a.emailVerified) signes.push("courriel non confirmé");
  if (a && derniere && cree && derniere - cree < 10 * 60e3) signes.push("jamais revenu après l'inscription");
  if (!(u.role ?? []).length) signes.push("aucun rôle");
  lignes.push({
    cree,
    forme: forme(nom),
    domaine: DOMAINES_COURANTS.has(domaine) ? domaine : "autre",
    roles: (u.role ?? []).map((r) => (r.startsWith("deneigeur") ? "déneigeur" : "client")).join("+") || "-",
    ville: u.ville ? "oui" : "non",
    cell: u.telephoneVerifie ? "oui" : "non",
    carte: u.carte ? "oui" : "non",
    versement: u.connectStatus ?? "-",
    signes,
  });
}
lignes.sort((x, y) => (x.cree ?? 0) - (y.cree ?? 0));

console.log(`Fiches users : ${fiches.length} ; comptes Auth : ${auth.size}`);
console.log(`Comptes Auth sans fiche : ${[...auth.keys()].filter((k) => !fiches.some((f) => f.id === k)).length}`);
console.log("\nDomaines de courriel :");
for (const [k, v] of [...domaines].sort((a, b) => b[1] - a[1])) console.log(`  ${k} : ${v}`);
console.log("\nHeures avec 3 inscriptions ou plus :");
for (const [k, v] of [...parHeure].filter(([, v]) => v >= 3).sort()) console.log(`  ${k} : ${v}`);
console.log("\nComptes, du plus ancien au plus récent (n°, création, forme du nom, domaine, rôles, ville, cell., carte, versement, signes) :");
lignes.forEach((l, i) => {
  console.log(`${String(i + 1).padStart(3)} | ${heure(l.cree)} | ${l.forme || "(vide)"} | ${l.domaine} | ${l.roles} | ville ${l.ville} | cell ${l.cell} | carte ${l.carte} | ${l.versement} | ${l.signes.join(", ") || "-"}`);
});
const suspects = lignes.filter((l) => l.signes.filter((s) => !["courriel non confirmé", "aucun rôle", "jamais revenu après l'inscription"].includes(s)).length >= 1);
console.log(`\nComptes avec au moins un signe de nom ou de courriel inhabituel : ${suspects.length} sur ${lignes.length}`);
process.exit(0);
