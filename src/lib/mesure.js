// Mesure d'audience : Google Analytics 4, chargé SEULEMENT après un
// consentement explicite (Loi 25 : une technologie qui permet de suivre la
// navigation est désactivée par défaut).
//
// - Sans VITE_GA_ID (identifiant « G-… » du flux web), rien ne se charge et
//   aucun bandeau ne s'affiche.
// - Avant le choix ou après un refus : aucun script Google, aucun témoin,
//   aucune requête. Les appels à mesurer() sont simplement ignorés.
// - Après « Accepter » : gtag.js est chargé, sans signaux publicitaires
//   (ad_storage, ad_user_data, ad_personalization refusés, Google Signals
//   désactivé). Aucun renseignement identifiant n'est envoyé : ni courriel,
//   ni nom, ni adresse, ni identifiant de compte ou de demande.
// - Le choix est gardé dans le navigateur (localStorage) avec sa date ; il
//   se change en tout temps (lien « Témoins » du pied de page, politique).
//
// La liste des événements est dans docs/mesure.md.

export const ID_MESURE = import.meta.env.VITE_GA_ID || "";
const CLE = "snowro-mesure";
// Version du texte du bandeau : la changer redemande le consentement.
const VERSION = 1;

const ecouteurs = new Set();
let charge = false;

function lireChoix() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) || "null");
    return brut?.version === VERSION ? brut.choix : null;
  } catch {
    return null;
  }
}

// "inactif" (pas d'identifiant), "a-demander", "accepte" ou "refuse".
export function choixMesure() {
  if (!ID_MESURE) return "inactif";
  return lireChoix() ?? "a-demander";
}

export function surChangementChoix(fn) {
  ecouteurs.add(fn);
  return () => ecouteurs.delete(fn);
}

// Lien « Témoins » : rouvre le bandeau pour changer d'avis.
export function ouvrirPreferencesMesure() {
  ecouteurs.forEach((fn) => fn("ouvrir"));
}

export function enregistrerChoix(choix) {
  try {
    localStorage.setItem(CLE, JSON.stringify({ choix, version: VERSION, date: new Date().toISOString() }));
  } catch {
    // Stockage bloqué : le choix vaut pour cette visite seulement.
  }
  if (choix === "accepte") {
    charger();
    // La page en cours n'a pas été comptée avant l'accord.
    pageVue();
  } else {
    retirer();
  }
  ecouteurs.forEach((fn) => fn(choix));
}

function gtag() {
  window.dataLayer = window.dataLayer || [];
  // gtag.js attend l'objet « arguments » tel quel.
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

function charger() {
  if (!ID_MESURE || typeof window === "undefined") return;
  window[`ga-disable-${ID_MESURE}`] = false;
  if (charge) {
    window.gtag("consent", "update", { analytics_storage: "granted" });
    return;
  }
  charge = true;
  window.gtag = gtag;
  gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  gtag("js", new Date());
  gtag("config", ID_MESURE, {
    send_page_view: false, // envoyé à chaque changement de page (pageVue)
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_flags: "SameSite=Lax;Secure",
  });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID_MESURE)}`;
  document.head.appendChild(s);
}

// Retrait du consentement : plus aucun envoi, témoins _ga effacés.
function retirer() {
  if (!ID_MESURE || typeof window === "undefined") return;
  window[`ga-disable-${ID_MESURE}`] = true;
  if (charge) window.gtag("consent", "update", { analytics_storage: "denied" });
  const domaine = location.hostname.replace(/^www\./, "");
  document.cookie.split(";").forEach((c) => {
    const nom = c.split("=")[0].trim();
    if (!nom.startsWith("_ga")) return;
    for (const d of ["", `; domain=${domaine}`, `; domain=.${domaine}`]) {
      document.cookie = `${nom}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
    }
  });
}

// Au démarrage : recharge si la personne avait déjà accepté.
export function demarrerMesure() {
  if (choixMesure() === "accepte") charger();
}

function actif() {
  return charge && choixMesure() === "accepte";
}

// Adresse de la page sans renseignement personnel : seuls les paramètres de
// campagne (utm_*, gclid) sont gardés ; le reste (courriel d'un lien de
// confirmation, jeton, conversation) est retiré.
export function adresseNettoyee(href = location.href) {
  const u = new URL(href);
  const garder = new URLSearchParams();
  for (const [k, v] of u.searchParams) if (/^utm_/.test(k) || k === "gclid") garder.set(k, v);
  const q = garder.toString();
  return `${u.origin}${u.pathname}${q ? `?${q}` : ""}`;
}

export function pageVue() {
  if (!actif()) return;
  window.gtag("event", "page_view", {
    page_location: adresseNettoyee(),
    page_title: document.title,
  });
}

export function mesurer(evenement, donnees = {}) {
  if (!actif()) return;
  window.gtag("event", evenement, donnees);
}

// Propriété non identifiante, pour comparer clients et déneigeurs.
export function definirProfilMesure(roles) {
  if (!actif()) return;
  const r = roles ?? [];
  const role = r.length > 1 ? "les_deux" : r.includes("deneigeur_x") ? "deneigeur" : r.length ? "client" : "aucun";
  window.gtag("set", "user_properties", { role });
}
