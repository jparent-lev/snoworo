import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { getAuth } from "firebase-admin/auth";
import { db } from "./admin.js";

// Tableau de bord admin (page /admin) : métriques d'acquisition et
// d'utilisation, AGRÉGÉES seulement (aucun nom, courriel, adresse ni
// identifiant n'en sort : Loi 25, minimisation).
//
// Accès : ADMIN_UIDS (functions/.env.<projet>), liste d'UID Firebase séparés
// par des virgules. Un UID plutôt qu'un courriel : le dépôt est public, et
// l'inscription ne vérifie pas le courriel (un UID est lié au compte, pas à une
// adresse que quelqu'un d'autre pourrait saisir). Vide = personne.
// Au premier appel réussi, le compte reçoit la revendication { admin: true },
// qui sert seulement à afficher le lien « Admin » ; l'accès est revérifié ici
// à chaque appel.
const REGION = "northamerica-northeast1";
export const ADMIN_UIDS = defineString("ADMIN_UIDS", { default: "" });
const FUSEAU = "America/Toronto";
const JOUR_MS = 24 * 3600e3;
const NB_JOURS = 30;

export const estAdmin = (uid) =>
  Boolean(uid) &&
  ADMIN_UIDS.value()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(uid);

const enMillis = (v) => (v?.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : null);
const jourLocal = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, dateStyle: "short" }).format(new Date(ms));
const arrondir = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
function mediane(valeurs) {
  if (!valeurs.length) return null;
  const v = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
const dans = (ms, maintenant, jours) => ms != null && ms >= maintenant - jours * JOUR_MS;

// Calcul pur, testable : listes de documents (data()) → métriques.
export function calculerMetriques({ users, demandes, listeAttente }, maintenant = Date.now()) {
  const jours = [];
  for (let i = NB_JOURS - 1; i >= 0; i--) jours.push(jourLocal(maintenant - i * JOUR_MS));
  const parJour = Object.fromEntries(jours.map((j) => [j, { jour: j, comptes: 0, demandes: 0 }]));

  const villes = new Map();
  const ville = (nom) => {
    const cle = nom || "Inconnue";
    if (!villes.has(cle)) villes.set(cle, { ville: cle, deneigeurs: 0, clients: 0, demandes: 0, ouvertes: 0, completees: 0 });
    return villes.get(cle);
  };

  const comptes = {
    total: 0, j1: 0, j7: 0, j30: 0,
    clients: 0, deneigeurs: 0, deuxRoles: 0, sansRole: 0,
    deneigeursAdresse: 0, deneigeursVersementActif: 0, cartes: 0, cellulaires: 0, smsConsentis: 0,
  };
  for (const u of users) {
    const roles = u.role ?? [];
    const client = roles.includes("donneur_ouvrage");
    const deneigeur = roles.includes("deneigeur_x");
    const cree = enMillis(u.createdAt);
    comptes.total++;
    if (dans(cree, maintenant, 1)) comptes.j1++;
    if (dans(cree, maintenant, 7)) comptes.j7++;
    if (dans(cree, maintenant, 30)) comptes.j30++;
    if (cree != null && parJour[jourLocal(cree)]) parJour[jourLocal(cree)].comptes++;
    if (client) comptes.clients++;
    if (deneigeur) comptes.deneigeurs++;
    if (client && deneigeur) comptes.deuxRoles++;
    if (!client && !deneigeur) comptes.sansRole++;
    if (deneigeur && u.villeGeoId) comptes.deneigeursAdresse++;
    if (deneigeur && u.connectStatus === "actif") comptes.deneigeursVersementActif++;
    if (u.carte) comptes.cartes++;
    if (u.telephoneVerifie) comptes.cellulaires++;
    if (u.consents?.notificationsSMS?.granted) comptes.smsConsentis++;
    if (deneigeur && u.ville) ville(u.ville).deneigeurs++;
    if (client && u.ville) ville(u.ville).clients++;
  }

  const parStatut = {};
  const d = { total: 0, j1: 0, j7: 0, j30: 0, ouvertesMaintenant: 0, acceptees: 0, annuleesRetard: 0, signalees: 0 };
  const delaisAcceptationMin = [];
  const delaisConfirmationH = [];
  const argent = { volumeConfirme: 0, fraisSnowro: 0, montantDeneigeurs: 0, nbConfirmees: 0, enRetenue: 0, rembourse: 0 };
  for (const x of demandes) {
    const cree = enMillis(x.createdAt);
    d.total++;
    parStatut[x.statut] = (parStatut[x.statut] ?? 0) + 1;
    if (dans(cree, maintenant, 1)) d.j1++;
    if (dans(cree, maintenant, 7)) d.j7++;
    if (dans(cree, maintenant, 30)) d.j30++;
    if (cree != null && parJour[jourLocal(cree)]) parJour[jourLocal(cree)].demandes++;
    if (x.statut === "ouverte") d.ouvertesMaintenant++;
    const acceptee = enMillis(x.matchedAt);
    if (acceptee != null) {
      d.acceptees++;
      if (cree != null) delaisAcceptationMin.push((acceptee - cree) / 60e3);
    }
    const faite = enMillis(x.faiteAt);
    const confirmee = enMillis(x.confirmeeAt);
    if (faite != null && confirmee != null) delaisConfirmationH.push((confirmee - faite) / 3600e3);
    if (x.annulation?.raison === "retard") d.annuleesRetard++;
    if (x.signalement) d.signalees++;
    const p = x.paiement;
    if (x.statut === "completee" && p) {
      argent.nbConfirmees++;
      argent.volumeConfirme += p.montantTotal ?? 0;
      argent.fraisSnowro += p.fraisSnowro ?? 0;
      argent.montantDeneigeurs += p.montantDeneigeur ?? 0;
    }
    if (p && ["retenu", "simule_retenu", "a_verser"].includes(p.statutPaiement)) argent.enRetenue += p.montantTotal ?? 0;
    if (p && ["rembourse", "simule_rembourse"].includes(p.statutPaiement)) argent.rembourse += p.montantTotal ?? 0;
    const v = ville(x.ville);
    v.demandes++;
    if (x.statut === "ouverte") v.ouvertes++;
    if (x.statut === "completee") v.completees++;
  }
  // Taux d'acceptation : sur les demandes qui ne sont plus en attente.
  const tranchees = d.total - d.ouvertesMaintenant;
  const demandesMetriques = {
    ...d,
    parStatut,
    tauxAcceptation: tranchees > 0 ? arrondir(d.acceptees / tranchees, 3) : null,
    delaiMedianAcceptationMin: delaisAcceptationMin.length ? arrondir(mediane(delaisAcceptationMin), 0) : null,
    delaiMedianConfirmationH: delaisConfirmationH.length ? arrondir(mediane(delaisConfirmationH), 1) : null,
  };
  for (const k of Object.keys(argent)) if (k !== "nbConfirmees") argent[k] = arrondir(argent[k]);
  argent.panierMoyen = argent.nbConfirmees ? arrondir(argent.volumeConfirme / argent.nbConfirmees) : null;

  const attente = { total: 0, confirmees: 0, j7: 0 };
  for (const l of listeAttente) {
    attente.total++;
    if (l.confirmee !== false) attente.confirmees++;
    if (dans(enMillis(l.createdAt), maintenant, 7)) attente.j7++;
  }

  return {
    genereA: new Date(maintenant).toISOString(),
    comptes,
    demandes: demandesMetriques,
    argent,
    listeAttente: attente,
    parJour: jours.map((j) => parJour[j]),
    villes: [...villes.values()]
      .filter((v) => v.ville !== "Inconnue" || v.demandes > 0)
      .sort((a, b) => b.demandes + b.deneigeurs + b.clients - (a.demandes + a.deneigeurs + a.clients))
      .slice(0, 15),
  };
}

export const metriquesAdmin = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Connexion requise.");
  if (!estAdmin(uid)) throw new HttpsError("permission-denied", "Accès réservé.");
  if (request.auth.token.admin !== true) {
    const { customClaims } = await getAuth().getUser(uid);
    await getAuth().setCustomUserClaims(uid, { ...(customClaims ?? {}), admin: true });
  }
  // Seulement les champs utiles (select) : rien d'identifiant n'est lu.
  const [users, demandes, listeAttente] = await Promise.all([
    db.collection("users").select("role", "createdAt", "villeGeoId", "ville", "connectStatus", "carte", "telephoneVerifie", "consents").get(),
    db.collection("demandes").select("statut", "createdAt", "matchedAt", "faiteAt", "confirmeeAt", "paiement", "ville", "annulation", "signalement").get(),
    db.collection("listeAttente").select("confirmee", "createdAt").get(),
  ]);
  const donnees = (s) => s.docs.map((x) => x.data());
  return calculerMetriques({ users: donnees(users), demandes: donnees(demandes), listeAttente: donnees(listeAttente) });
});
