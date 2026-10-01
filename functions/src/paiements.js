import Stripe from "stripe";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { defineBoolean, defineSecret, defineString } from "firebase-functions/params";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { RESEND_API_KEY, echapperHtml, envoyerCourriel, gabaritCourriel } from "./courriels.js";

// Paiements Stripe Connect (comptes Express), modèle « charges et virements
// séparés » :
//   1. le client enregistre une carte en publiant (SetupIntent) ; rien n'est
//      prélevé tant que personne n'accepte ;
//   2. à l'acceptation, Snowro prélève le montant offert sur la carte
//      enregistrée (PaymentIntent hors session) et le garde ;
//   3. à la confirmation (par le client ou automatique après 12 h), Snowro
//      vire au compte du déneigeur le montant moins ses frais (Transfer lié au
//      prélèvement). Un signalement bloque le virement ; un remboursement se
//      fait à la main dans le tableau de bord Stripe.
//
// PAIEMENT_REEL (functions/.env.<projet>) : false = paiement simulé (préfixe
// « simule_ »), true = Stripe. Les deux secrets doivent exister dans Secret
// Manager dans les deux cas : le déploiement les exige.
export const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
export const PAIEMENT_REEL = defineBoolean("PAIEMENT_REEL", { default: false });
// Adresse du site, pour les retours de Stripe (inscription du déneigeur).
export const URL_SITE = defineString("URL_SITE", { default: "https://snowro.com" });

const REGION = "northamerica-northeast1";
const DEVISE = "cad";

let client = null;
let remplacant = null;
export function stripe() {
  if (remplacant) return remplacant;
  if (!client) client = new Stripe(STRIPE_SECRET_KEY.value());
  return client;
}
// Tests seulement : un faux client Stripe.
export function __remplacerStripe(faux) {
  remplacant = faux;
}

export const paiementReel = () => PAIEMENT_REEL.value();
export const enCents = (montant) => Math.round(montant * 100);

function exigerConnexion(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  return request.auth.uid;
}

// Une erreur renvoyée par Stripe (compte de plateforme incomplet, carte
// refusée, etc.) devient un message lisible dans l'app au lieu de « Quelque
// chose a bloqué », et reste notée dans le journal des fonctions.
function avecStripe(gestionnaire) {
  return async (request) => {
    try {
      return await gestionnaire(request);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error(`Stripe (${err.type ?? "erreur"}${err.code ? `, ${err.code}` : ""}) : ${err.message}`);
      if (String(err.type ?? "").startsWith("Stripe")) throw new HttpsError("failed-precondition", `Stripe : ${err.message}`);
      throw err;
    }
  };
}

// ---- Carte du client ----

async function clientStripe(uid) {
  const ref = db.doc(`users/${uid}`);
  const profil = (await ref.get()).data() ?? {};
  if (profil.stripeCustomerId) return { customerId: profil.stripeCustomerId, profil };
  const customer = await stripe().customers.create(
    { email: profil.email || undefined, name: profil.displayName || undefined, metadata: { uid } },
    { idempotencyKey: `client-${uid}` },
  );
  await ref.set({ stripeCustomerId: customer.id }, { merge: true });
  return { customerId: customer.id, profil };
}

// Prépare l'enregistrement d'une carte : renvoie le client_secret d'un
// SetupIntent pour le Payment Element de Stripe dans l'app.
export const preparerCarte = onCall({ region: REGION, secrets: [STRIPE_SECRET_KEY] }, avecStripe(async (request) => {
  const uid = exigerConnexion(request);
  const { customerId } = await clientStripe(uid);
  const intent = await stripe().setupIntents.create({
    customer: customerId,
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: { uid },
  });
  return { clientSecret: intent.client_secret };
}));

// Après la confirmation du SetupIntent dans l'app : vérifie qu'il appartient
// bien à ce client, en fait la carte par défaut et en garde un résumé
// (marque, 4 derniers chiffres) dans users/{uid}.carte (champ protégé).
export const enregistrerCarte = onCall({ region: REGION, secrets: [STRIPE_SECRET_KEY] }, avecStripe(async (request) => {
  const uid = exigerConnexion(request);
  const { setupIntentId } = request.data ?? {};
  if (typeof setupIntentId !== "string" || !setupIntentId.startsWith("seti_")) {
    throw new HttpsError("invalid-argument", "setupIntentId requis.");
  }
  const { customerId } = await clientStripe(uid);
  const intent = await stripe().setupIntents.retrieve(setupIntentId, { expand: ["payment_method"] });
  if (intent.customer !== customerId) throw new HttpsError("permission-denied", "Cette carte n'est pas la tienne.");
  if (intent.status !== "succeeded") throw new HttpsError("failed-precondition", "La carte n'a pas été confirmée.");
  const pm = intent.payment_method;
  await stripe().customers.update(customerId, { invoice_settings: { default_payment_method: pm.id } });
  const carte = {
    paymentMethodId: pm.id,
    marque: pm.card?.brand ?? "carte",
    derniers4: pm.card?.last4 ?? "",
    expMois: pm.card?.exp_month ?? null,
    expAnnee: pm.card?.exp_year ?? null,
  };
  await db.doc(`users/${uid}`).set({ carte, carteMiseAJourAt: FieldValue.serverTimestamp() }, { merge: true });
  return { carte: { marque: carte.marque, derniers4: carte.derniers4 } };
}));

// ---- Prélèvement à l'acceptation ----

// Prélève `demande.remunerationOfferte` sur la carte du client. Renvoie
// { ok: true, paymentIntentId, chargeId } ou { ok: false, raison }.
export async function prelever(demandeId, demande) {
  const client = (await db.doc(`users/${demande.donneurOuvrageId}`).get()).data() ?? {};
  if (!client.stripeCustomerId || !client.carte?.paymentMethodId) return { ok: false, raison: "Aucune carte enregistrée." };
  try {
    const intent = await stripe().paymentIntents.create(
      {
        amount: enCents(demande.remunerationOfferte),
        currency: DEVISE,
        customer: client.stripeCustomerId,
        payment_method: client.carte.paymentMethodId,
        off_session: true,
        confirm: true,
        transfer_group: demandeId,
        description: `Snowro : ${demande.titre}`,
        // Reçu envoyé par Stripe (promis dans les conditions d'utilisation).
        receipt_email: client.email || undefined,
        metadata: { demandeId },
      },
      // Une tentative par demande et par carte : relancer après un échec avec
      // une nouvelle carte crée un nouveau prélèvement.
      { idempotencyKey: `prelevement-${demandeId}-${client.carte.paymentMethodId}` },
    );
    if (intent.status !== "succeeded") return { ok: false, raison: `Paiement ${intent.status}.` };
    return { ok: true, paymentIntentId: intent.id, chargeId: intent.latest_charge };
  } catch (err) {
    logger.warn(`Prélèvement refusé pour la demande ${demandeId} : ${err.message}`);
    return { ok: false, raison: err.message };
  }
}

export async function avertirCarteRefusee(demande) {
  const client = (await db.doc(`users/${demande.donneurOuvrageId}`).get()).data();
  if (!client?.email) return;
  const lien = `${URL_SITE.value()}/tableau-de-bord?mode=client`;
  const paragraphes = [
    `Un déneigeur de quartier voulait prendre ta demande « ${demande.titre} », mais ta carte a été refusée.`,
    "Ta demande est en pause : mets ta carte à jour et elle redevient visible tout de suite.",
  ];
  try {
    await envoyerCourriel({
      a: client.email,
      sujet: "Ta carte a été refusée : ta demande est en pause",
      html: gabaritCourriel({
        titre: "Ta carte a été refusée",
        paragraphes: [
          ...paragraphes.map(echapperHtml),
          `<a href="${lien}" style="display:inline-block;padding:12px 20px;background:#C1652F;color:#FFFDF8;border-radius:999px;font-weight:700;text-decoration:none;">Mettre ma carte à jour</a>`,
        ],
        piedDePage: "Tu reçois ce courriel parce que tu as publié une demande sur Snowro.",
      }),
      texte: [...paragraphes, "", `Mettre ma carte à jour : ${lien}`].join("\n"),
      type: "carte_refusee",
    });
  } catch (err) {
    logger.error(`Avis de carte refusée non envoyé : ${err.message}`);
  }
}

// ---- Virement au déneigeur à la confirmation ----

// Idempotent (clé par demande) : peut être relancé sans risque de double
// virement. Laisse « a_verser » en cas d'échec ; confirmerJobsEchues réessaie.
export async function verser(demandeId) {
  const ref = db.doc(`demandes/${demandeId}`);
  const demande = (await ref.get()).data();
  if (demande?.paiement?.statutPaiement !== "a_verser") return false;
  const deneigeur = (await db.doc(`users/${demande.deneigeurId}`).get()).data() ?? {};
  try {
    if (!deneigeur.stripeConnectAccountId) throw new Error("compte de paiement du déneigeur absent");
    const virement = await stripe().transfers.create(
      {
        amount: enCents(demande.paiement.montantDeneigeur),
        currency: DEVISE,
        destination: deneigeur.stripeConnectAccountId,
        source_transaction: demande.paiement.stripeChargeId,
        transfer_group: demandeId,
        description: `Snowro : ${demande.titre}`,
        metadata: { demandeId },
      },
      { idempotencyKey: `versement-${demandeId}` },
    );
    await ref.update({
      "paiement.statutPaiement": "verse",
      "paiement.stripeTransferId": virement.id,
      "paiement.verseAt": FieldValue.serverTimestamp(),
      "paiement.erreurVersement": null,
    });
    return true;
  } catch (err) {
    logger.error(`Virement non fait pour la demande ${demandeId} : ${err.message}`);
    await ref.update({ "paiement.erreurVersement": err.message });
    return false;
  }
}

// ---- Compte du déneigeur (Stripe Connect, Accounts v2) ----
// Stripe exige Accounts v2 pour une nouvelle intégration Connect : compte
// « destinataire » (configuration recipient, virements vers son solde
// Stripe), tableau de bord Express, frais et pertes assumés par Snowro
// (« application »). Les virements (transfers, API v1) fonctionnent tels quels
// vers un compte v2.

const INCLURE_DESTINATAIRE = ["configuration.recipient", "requirements"];

// connectStatus d'après la capacité « recevoir des virements » du compte.
export function statutConnect(compte) {
  const statut = compte.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  if (statut === "active") return "actif";
  if (statut === "restricted" || statut === "rejected") return "restreint";
  return "en_attente";
}

async function lireCompte(compteId) {
  return stripe().v2.core.accounts.retrieve(compteId, { include: INCLURE_DESTINATAIRE });
}

// Lien vers Stripe : l'inscription (identité, compte bancaire) tant que le
// compte n'est pas actif, ensuite le tableau de bord Express (versements,
// relevés).
export const lienCompteDeneigeur = onCall({ region: REGION, secrets: [STRIPE_SECRET_KEY] }, avecStripe(async (request) => {
  const uid = exigerConnexion(request);
  const ref = db.doc(`users/${uid}`);
  const profil = (await ref.get()).data() ?? {};
  if (!(profil.role ?? []).includes("deneigeur_x")) {
    throw new HttpsError("permission-denied", "Active le mode déneigeur dans tes paramètres.");
  }
  let compteId = profil.stripeConnectAccountId;
  if (!compteId) {
    const compte = await stripe().v2.core.accounts.create(
      {
        contact_email: profil.email || undefined,
        display_name: profil.displayName || undefined,
        identity: { country: "CA" },
        dashboard: "express",
        defaults: {
          currency: "cad",
          locales: ["fr-CA"],
          profile: { product_description: "Déneigement résidentiel offert par l'entremise de Snowro" },
          responsibilities: { fees_collector: "application", losses_collector: "application" },
        },
        configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
        metadata: { uid },
      },
      { idempotencyKey: `compte-v2-${uid}` },
    );
    compteId = compte.id;
    await ref.set({ stripeConnectAccountId: compteId, connectStatus: "en_attente" }, { merge: true });
  }
  const connectStatus = statutConnect(await lireCompte(compteId));
  if (connectStatus !== profil.connectStatus) await ref.set({ connectStatus }, { merge: true });
  if (connectStatus === "actif") {
    const lien = await stripe().accounts.createLoginLink(compteId);
    return { url: lien.url, type: "tableau" };
  }
  const site = URL_SITE.value();
  const lien = await stripe().v2.core.accountLinks.create({
    account: compteId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        refresh_url: `${site}/parametres?stripe=reprendre`,
        return_url: `${site}/parametres?stripe=retour`,
      },
    },
  });
  return { url: lien.url, type: "inscription" };
}));

// Au retour de Stripe : met connectStatus à jour sans attendre le webhook.
export const synchroniserCompteDeneigeur = onCall({ region: REGION, secrets: [STRIPE_SECRET_KEY] }, avecStripe(async (request) => {
  const uid = exigerConnexion(request);
  const ref = db.doc(`users/${uid}`);
  const { stripeConnectAccountId } = (await ref.get()).data() ?? {};
  if (!stripeConnectAccountId) return { connectStatus: "non_demarre" };
  const connectStatus = statutConnect(await lireCompte(stripeConnectAccountId));
  await ref.set({ connectStatus }, { merge: true });
  return { connectStatus };
}));

// ---- Webhook Stripe ----
// URL à inscrire dans Stripe (Développeurs > Webhooks), événements :
// account.updated. Signature vérifiée avec STRIPE_WEBHOOK_SECRET.
export const webhookStripe = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY] },
  async (req, res) => {
    let evenement;
    try {
      evenement = stripe().webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET.value());
    } catch (err) {
      logger.warn(`Webhook Stripe refusé : ${err.message}`);
      res.status(400).send("Signature invalide");
      return;
    }
    try {
      await traiterEvenement(evenement);
      res.status(200).send({ recu: true });
    } catch (err) {
      logger.error(`Webhook Stripe ${evenement.type} : ${err.message}`);
      res.status(500).send("Erreur");
    }
  },
);

// account.updated (événement v1, toujours émis pour les comptes v2) ou
// événement v2 « v2.core.account… » : dans les deux cas, on relit le compte
// pour calculer le statut, plutôt que de dépendre de la forme du message.
export async function traiterEvenement(evenement) {
  let compteId = null;
  if (evenement.type === "account.updated") compteId = evenement.data?.object?.id;
  else if (String(evenement.type).startsWith("v2.core.account")) compteId = evenement.related_object?.id;
  if (!compteId) return;
  const trouves = await db.collection("users").where("stripeConnectAccountId", "==", compteId).limit(1).get();
  if (trouves.empty) return;
  await trouves.docs[0].ref.set({ connectStatus: statutConnect(await lireCompte(compteId)) }, { merge: true });
}
