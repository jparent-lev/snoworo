// Envoi unique : annonce de l'ouverture aux inscrits confirmés de la liste
// d'attente, puis effacement de toute la collection listeAttente.
// Lancé à la main par le workflow « Annonce d'ouverture (liste d'attente) ».
//
// ENVOYER=oui : envoie et efface. Sinon : simulation, rien n'est envoyé ni
// effacé. Les journaux du dépôt sont publics : on n'y écrit que des nombres,
// jamais un courriel ou un nom.
import { createHash } from "node:crypto";
import { db } from "../functions/src/admin.js";
import { echapperHtml, envoyerCourriel, gabaritCourriel } from "../functions/src/courriels.js";

const ENVOYER = process.env.ENVOYER === "oui";
if (process.env.GCLOUD_PROJECT !== "snowro-app") throw new Error("Production seulement (snowro-app).");

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const prenomDe = (nom) => (typeof nom === "string" ? nom.trim().split(/\s+/)[0] : "") || "";

const entrees = (await db.collection("listeAttente").get()).docs;
const comptes = new Set(
  (await db.collection("users").select("email").get()).docs.map((d) => String(d.data().email ?? "").toLowerCase()).filter(Boolean),
);

// Une personne peut avoir deux entrées (client et pro) : un seul courriel.
const parCourriel = new Map();
const nonConfirmees = [];
for (const doc of entrees) {
  const e = doc.data();
  const courriel = String(e.courriel ?? "").trim().toLowerCase();
  if (!courriel || e.confirmee === false) {
    nonConfirmees.push(doc.ref);
    continue;
  }
  const p = parCourriel.get(courriel) ?? { refs: [], prenom: "" };
  p.refs.push(doc.ref);
  p.prenom ||= prenomDe(e.nom);
  parCourriel.set(courriel, p);
}
const dejaInscrits = [...parCourriel.keys()].filter((c) => comptes.has(c));
const destinataires = [...parCourriel.entries()].filter(([c]) => !comptes.has(c));

console.log(`Entrées : ${entrees.length}`);
console.log(`Non confirmées (effacées sans courriel) : ${nonConfirmees.length}`);
console.log(`Confirmées, personnes distinctes : ${parCourriel.size}`);
console.log(`  dont déjà un compte Snowro (effacées sans courriel) : ${dejaInscrits.length}`);
console.log(`  courriels à envoyer : ${destinataires.length}`);
if (!ENVOYER) {
  console.log("Simulation : rien n'a été envoyé ni effacé.");
  process.exit(0);
}

function courriel(prenom) {
  const bonjour = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  const lignes = [
    bonjour,
    "Vous vous étiez inscrit à la liste d'attente de Snowro : c'est ouvert ! Vous pouvez dès maintenant publier une demande de déneigement ou prendre des demandes près de chez vous, partout au Québec.",
    "Créez votre compte : https://snowro.com/inscription",
    "Inscription gratuite. Rien n'est prélevé avant qu'un déneigeur de quartier accepte votre demande.",
    "Ce courriel est le seul que vous recevrez au sujet de la liste d'attente. Votre inscription à la liste est maintenant effacée de nos systèmes.",
  ];
  const html = gabaritCourriel({
    titre: "Snowro est ouvert",
    paragraphes: [
      echapperHtml(bonjour),
      echapperHtml(lignes[1]),
      `<a href="https://snowro.com/inscription" style="display:inline-block;background:#9E4E23;color:#FFFDF8;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px;">Créer mon compte</a>`,
      echapperHtml(lignes[3]),
      echapperHtml(lignes[4]),
      "Jonathan Parent, fondateur<br>Snowro",
    ],
    piedDePage: "Vous recevez ce courriel parce que vous vous étiez inscrit à la liste d'attente de Snowro.",
  });
  return { html, texte: [...lignes, "", "Jonathan Parent, fondateur", "Snowro"].join("\n\n") };
}

let envoyes = 0;
let echecs = 0;
for (const [adresse, p] of destinataires) {
  const { html, texte } = courriel(p.prenom);
  try {
    await envoyerCourriel({
      a: adresse,
      sujet: "Snowro est ouvert",
      html,
      texte,
      cleIdempotence: `annonce-ouverture-${createHash("sha256").update(adresse).digest("hex").slice(0, 32)}`,
      type: "annonce_ouverture",
    });
    // Effacée dès l'envoi : une relance du workflow n'écrit pas deux fois.
    await Promise.all(p.refs.map((r) => r.delete()));
    envoyes++;
  } catch {
    echecs++;
  }
  await pause(600); // Resend : 2 envois par seconde au plus.
}
for (const c of dejaInscrits) await Promise.all(parCourriel.get(c).refs.map((r) => r.delete()));
await Promise.all(nonConfirmees.map((r) => r.delete()));

const restantes = (await db.collection("listeAttente").count().get()).data().count;
console.log(`Envoyés : ${envoyes}, échecs : ${echecs} (entrées gardées pour une relance)`);
console.log(`Entrées restantes dans listeAttente : ${restantes}`);
process.exit(echecs ? 1 : 0);
