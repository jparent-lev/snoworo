import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/v2";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { RESEND_API_KEY, echapperHtml, envoyerCourriel, gabaritCourriel } from "./courriels.js";
import { STRIPE_SECRET_KEY, URL_SITE, rembourser } from "./paiements.js";
import { SECRETS_SMS, envoyerTexto } from "./sms.js";

// Demande acceptée dont l'heure limite est passée sans « C'est fait » :
//   1. à l'heure limite : avis au déneigeur (courriel, texto s'il y consent)
//      et au client ; la demande s'affiche « En retard » et le client peut
//      l'annuler et être remboursé (annulerDemande) ;
//   2. DELAI_RETARD_MS plus tard, toujours sans « C'est fait » : annulation et
//      remboursement automatiques, aucun versement au déneigeur.
// Une demande marquée faite suit le chemin habituel (confirmation par le
// client ou automatique 12 h après, functions/src/cycleDemande.js).
export const DELAI_RETARD_MS = 12 * 60 * 60 * 1000;

const formatMoment = new Intl.DateTimeFormat("fr-CA", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Toronto",
});
const formatArgent = (n) => `${n.toLocaleString("fr-CA", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} $`;

export const limiteRetard = (demande) => demande.dateHeureSouhaitee.toMillis() + DELAI_RETARD_MS;
export const estEnRetard = (demande, maintenant = Date.now()) =>
  demande.statut === "matchee" && demande.dateHeureSouhaitee.toMillis() <= maintenant;

// Dans une transaction : annulation pour retard. Le remboursement réel se
// fait après (rembourser), comme le virement après une confirmation.
export function annulerPourRetard(tx, ref, demande, { par }) {
  const maj = {
    statut: "annulee",
    annuleeAt: FieldValue.serverTimestamp(),
    annulation: { raison: "retard", par, at: FieldValue.serverTimestamp() },
  };
  const statut = demande.paiement?.statutPaiement;
  if (statut === "retenu") maj["paiement.statutPaiement"] = "a_rembourser";
  else if (statut?.startsWith("simule_")) maj["paiement.statutPaiement"] = "simule_rembourse";
  tx.update(ref, maj);
}

const bouton = (lien, libelle) =>
  `<a href="${lien}" style="display:inline-block;padding:12px 20px;background:#C1652F;color:#FFFDF8;border-radius:999px;font-weight:700;text-decoration:none;">${libelle}</a>`;

async function courriel(profil, { sujet, titre, paragraphes, lien, libelle, type, cle, pied }) {
  if (!profil?.email) return;
  try {
    await envoyerCourriel({
      a: profil.email,
      sujet,
      html: gabaritCourriel({ titre, paragraphes: [...paragraphes.map(echapperHtml), bouton(lien, libelle)], piedDePage: pied }),
      texte: [...paragraphes, "", `${libelle} : ${lien}`].join("\n"),
      cleIdempotence: cle,
      type,
    });
  } catch (err) {
    logger.error(`Courriel « ${type} » non envoyé : ${err.message}`);
  }
}

const lireProfils = async (demande) => {
  const [client, deneigeur] = await Promise.all([
    db.doc(`users/${demande.donneurOuvrageId}`).get(),
    db.doc(`users/${demande.deneigeurId}`).get(),
  ]);
  return { client: client.data(), deneigeur: deneigeur.data() };
};

export async function avertirRetard(demandeId, demande) {
  const { client, deneigeur } = await lireProfils(demande);
  const site = URL_SITE.value();
  const prevue = formatMoment.format(demande.dateHeureSouhaitee.toDate());
  const limite = formatMoment.format(new Date(limiteRetard(demande)));
  const lienDeneigeur = `${site}/tableau-de-bord?mode=deneigeur`;
  const lienClient = `${site}/tableau-de-bord?mode=client`;
  await courriel(deneigeur, {
    sujet: `En retard : « ${demande.titre} »`,
    titre: "Cette demande est en retard",
    paragraphes: [
      `La demande « ${demande.titre} » devait être faite avant ${prevue}.`,
      "Si c'est fait, marquez-la « C'est fait » avec vos photos dès maintenant.",
      `Sinon, elle sera annulée ${limite} et le client sera remboursé : aucun versement ne vous sera fait.`,
    ],
    lien: lienDeneigeur,
    libelle: "Ouvrir mes demandes",
    type: "retard_deneigeur",
    cle: `retard-deneigeur-${demandeId}`,
    pied: "Vous recevez ce courriel parce que vous avez accepté cette demande sur Snowro.",
  });
  await envoyerTexto(
    deneigeur,
    `Snowro : « ${demande.titre} » devait être faite avant ${prevue}. Marquez-la « C'est fait » avec photos, sinon elle sera annulée ${limite} et le client remboursé. ${lienDeneigeur}`,
    { contexte: `retard ${demandeId}` },
  );
  const qui = demande.deneigeurPrenom || "Le déneigeur de quartier";
  await courriel(client, {
    sujet: `Votre demande « ${demande.titre} » est en retard`,
    titre: "Votre demande est en retard",
    paragraphes: [
      `${qui} n'a pas encore marqué « ${demande.titre} » comme faite, alors qu'elle était prévue avant ${prevue}.`,
      "Vous pouvez lui écrire depuis votre tableau de bord, ou annuler la demande et être remboursé.",
      `Sans nouvelles d'ici ${limite}, la demande sera annulée et vous serez remboursé automatiquement.`,
    ],
    lien: lienClient,
    libelle: "Voir ma demande",
    type: "retard_client",
    cle: `retard-client-${demandeId}`,
    pied: "Vous recevez ce courriel parce que vous avez publié une demande sur Snowro.",
  });
}

export async function avertirAnnulationRetard(demandeId, demande, { par }) {
  const { client, deneigeur } = await lireProfils(demande);
  const site = URL_SITE.value();
  const montant = formatArgent(demande.remunerationOfferte);
  const reel = demande.paiement?.statutPaiement === "retenu";
  await courriel(client, {
    sujet: `Demande annulée : « ${demande.titre} »`,
    titre: reel ? "Demande annulée, vous êtes remboursé" : "Demande annulée",
    paragraphes: [
      par === "client"
        ? `Vous avez annulé « ${demande.titre} », qui n'avait pas été faite à temps.`
        : `« ${demande.titre} » n'a pas été marquée faite dans les 12 h suivant l'heure prévue : nous l'avons annulée.`,
      reel
        ? `Le montant de ${montant} vous est remboursé en entier. Il apparaîtra sur votre relevé d'ici 5 à 10 jours ouvrables.`
        : "Aucun montant ne vous a été prélevé.",
      "Vous pouvez publier une nouvelle demande en tout temps.",
    ],
    lien: `${site}/publier`,
    libelle: "Publier une nouvelle demande",
    type: "annulation_retard_client",
    cle: `annulation-retard-client-${demandeId}`,
    pied: "Vous recevez ce courriel parce que vous avez publié une demande sur Snowro.",
  });
  await courriel(deneigeur, {
    sujet: `Demande annulée : « ${demande.titre} »`,
    titre: "Demande annulée pour retard",
    paragraphes: [
      par === "client"
        ? `Le client a annulé « ${demande.titre} », qui n'avait pas été marquée faite à l'heure prévue.`
        : `« ${demande.titre} » n'a pas été marquée faite dans les 12 h suivant l'heure prévue : elle est annulée.`,
      "Le client est remboursé et aucun versement ne vous sera fait pour cette demande.",
    ],
    lien: `${site}/tableau-de-bord?mode=deneigeur`,
    libelle: "Voir les demandes près de chez vous",
    type: "annulation_retard_deneigeur",
    cle: `annulation-retard-deneigeur-${demandeId}`,
    pied: "Vous recevez ce courriel parce que vous aviez accepté cette demande sur Snowro.",
  });
}

// Toutes les 15 minutes : avis à l'heure limite, puis annulation remboursée
// 12 h plus tard. Réessaie aussi les remboursements restés « a_rembourser ».
export const traiterRetards = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "America/Toronto",
    region: "northamerica-northeast1",
    secrets: [STRIPE_SECRET_KEY, RESEND_API_KEY, ...SECRETS_SMS],
  },
  async () => {
    await traiterRetardsMaintenant();
  },
);

export async function traiterRetardsMaintenant(maintenant = Date.now()) {
  const enRetard = await db
    .collection("demandes")
    .where("statut", "==", "matchee")
    .where("dateHeureSouhaitee", "<=", Timestamp.fromMillis(maintenant))
    .limit(200)
    .get();
  let avis = 0;
  let annulees = 0;
  for (const doc of enRetard.docs) {
    const action = await db.runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref);
      const demande = snap.data();
      // Revérifié dans la transaction : « C'est fait » ou un signalement a pu arriver.
      if (!demande || !estEnRetard(demande, maintenant)) return null;
      if (limiteRetard(demande) <= maintenant) {
        annulerPourRetard(tx, doc.ref, demande, { par: "automatique" });
        return { type: "annulation", demande };
      }
      if (demande.retardAvisAt) return null;
      tx.update(doc.ref, { retardAvisAt: FieldValue.serverTimestamp() });
      return { type: "avis", demande };
    });
    if (action?.type === "avis") {
      avis += 1;
      await avertirRetard(doc.id, action.demande);
    } else if (action?.type === "annulation") {
      annulees += 1;
      await rembourser(doc.id);
      await avertirAnnulationRetard(doc.id, action.demande, { par: "automatique" });
    }
  }
  const aRembourser = await db.collection("demandes").where("paiement.statutPaiement", "==", "a_rembourser").limit(100).get();
  for (const doc of aRembourser.docs) await rembourser(doc.id);
  if (avis || annulees) logger.info(`Retards : ${avis} avis, ${annulees} annulation(s) remboursée(s).`);
  return { avis, annulees };
}
