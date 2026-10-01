import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin.js";
import { RESEND_API_KEY, echapperHtml, envoyerCourriel, gabaritCourriel } from "./courriels.js";

// Un courriel d'avis au plus par conversation et par destinataire dans cet
// intervalle : une rafale de messages ne devient pas une rafale de courriels.
export const DELAI_AVIS_MS = 15 * 60 * 1000;
const EXTRAIT_MAX = 280;

// À chaque nouveau message (messages/{demandeId}/messages/{messageId}, écrit
// par le client selon firestore.rules) :
// 1. recopie l'heure et l'auteur du dernier message dans la demande
//    (`dernierMessage`), ce qui permet aux tableaux de bord d'afficher
//    « nouveau message » sans écouter chaque conversation ;
// 2. avertit l'autre personne par courriel, au plus une fois par
//    DELAI_AVIS_MS (heure du dernier avis dans demandes/{id}/prive/avis).
// Un envoi qui échoue est noté dans le journal sans faire échouer le reste.
export const notifierNouveauMessage = onDocumentCreated(
  {
    document: "messages/{demandeId}/messages/{messageId}",
    region: "northamerica-northeast1",
    secrets: [RESEND_API_KEY],
  },
  async (event) => {
    const { demandeId } = event.params;
    const message = event.data.data();
    const refDemande = db.doc(`demandes/${demandeId}`);
    const demande = (await refDemande.get()).data();
    if (!demande) return;

    await refDemande.update({
      dernierMessage: { at: FieldValue.serverTimestamp(), par: message.expediteurId },
    });

    const parClient = message.expediteurId === demande.donneurOuvrageId;
    const destinataireId = parClient ? demande.deneigeurId : demande.donneurOuvrageId;
    const expediteurPrenom = parClient ? demande.donneurPrenom : demande.deneigeurPrenom;
    if (!destinataireId) return;

    // Réserve le créneau d'avis dans une transaction : deux messages presque
    // simultanés ne produisent qu'un courriel.
    const refAvis = db.doc(`demandes/${demandeId}/prive/avis`);
    const maintenant = Date.now();
    const doitAvertir = await db.runTransaction(async (tx) => {
      const avis = (await tx.get(refAvis)).data() ?? {};
      const dernier = avis[destinataireId]?.toMillis?.() ?? 0;
      if (maintenant - dernier < DELAI_AVIS_MS) return false;
      tx.set(refAvis, { [destinataireId]: new Date(maintenant) }, { merge: true });
      return true;
    });
    if (!doitAvertir) return;

    const destinataire = (await db.doc(`users/${destinataireId}`).get()).data();
    if (!destinataire?.email) {
      logger.warn(`Avis de message non envoyé : pas de courriel pour ${destinataireId}`);
      return;
    }

    const { sujet, html, texte } = composerAvis({
      expediteurPrenom,
      titreDemande: demande.titre,
      extrait: message.contenu,
      lien: `https://snowro.com/tableau-de-bord?conversation=${demandeId}&mode=${parClient ? "deneigeur" : "client"}`,
    });
    try {
      await envoyerCourriel({
        a: destinataire.email,
        sujet,
        html,
        texte,
        cleIdempotence: `message-${demandeId}-${event.params.messageId}`,
        type: "nouveau_message",
      });
    } catch (err) {
      logger.error(`Avis de message non envoyé pour la demande ${demandeId} : ${err.message}`);
    }
  },
);

export function composerAvis({ expediteurPrenom, titreDemande, extrait, lien }) {
  const qui = expediteurPrenom || "L'autre personne";
  const court = extrait.length > EXTRAIT_MAX ? `${extrait.slice(0, EXTRAIT_MAX).trimEnd()}…` : extrait;
  const titre = `${qui} t'a écrit`;
  const pied =
    "Tu reçois ce courriel parce que tu as une job en cours sur Snowro. " +
    "Pour ta sécurité, garde les échanges et les paiements dans Snowro.";
  return {
    sujet: `${qui} t'a écrit à propos de « ${titreDemande} »`,
    html: gabaritCourriel({
      titre: echapperHtml(titre),
      paragraphes: [
        `À propos de « ${echapperHtml(titreDemande)} » :`,
        `<span style="display:block;padding:12px 14px;background:#F7F1E6;border-radius:12px;white-space:pre-wrap;">${echapperHtml(court)}</span>`,
        `<a href="${lien}" style="display:inline-block;padding:12px 20px;background:#C1652F;color:#FFFDF8;border-radius:999px;font-weight:700;text-decoration:none;">Répondre dans Snowro</a>`,
      ],
      piedDePage: pied,
    }),
    texte: [titre, "", `À propos de « ${titreDemande} » :`, "", court, "", `Répondre dans Snowro : ${lien}`, "", pied].join("\n"),
  };
}
