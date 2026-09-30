import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { FieldValue } from "firebase-admin/firestore";
import { RESEND_API_KEY, echapperHtml, envoyerCourriel, gabaritCourriel } from "./courriels.js";

// Courriel de confirmation envoyé à la première inscription sur la liste
// d'attente. Déclenché à la CRÉATION du document seulement : une
// réinscription avec le même courriel (rejoindreListeAttente fait un set avec
// merge) met à jour l'entrée sans renvoyer de courriel.
//
// Séparé de rejoindreListeAttente exprès : un envoi qui échoue ne doit
// jamais faire échouer l'inscription elle-même. Le résultat est noté dans
// `confirmation` sur le document, pour pouvoir relancer à la main les échecs.
export const confirmerInscriptionListeAttente = onDocumentCreated(
  { document: "listeAttente/{courriel}", region: "northamerica-northeast1", secrets: [RESEND_API_KEY] },
  async (event) => {
    const inscription = event.data.data();
    const { courriel, role, ville } = inscription;
    const { sujet, html, texte } = composerConfirmation({ role, ville });

    try {
      const resendId = await envoyerCourriel({
        a: courriel,
        sujet,
        html,
        texte,
        cleIdempotence: `liste-attente-${event.params.courriel}`,
        type: "confirmation_liste_attente",
      });
      await event.data.ref.update({
        confirmation: { statut: "envoyee", resendId, envoyeeAt: FieldValue.serverTimestamp(), erreur: null },
      });
    } catch (err) {
      logger.error(`Confirmation de liste d'attente non envoyée à ${courriel} : ${err.message}`);
      await event.data.ref.update({
        confirmation: { statut: "echec", resendId: null, envoyeeAt: null, erreur: err.message },
      });
    }
  },
);

function composerConfirmation({ role, ville }) {
  // `coin` est inséré tel quel : échappé pour la version HTML seulement.
  const paragraphes = (coin) =>
    role === "deneigeur"
      ? [
          `Merci de vouloir donner un coup de pelle avec Snowro. Ton inscription comme déneigeur de quartier compte pour ouvrir Snowro ${coin}.`,
          "Avant l'ouverture, on t'écrit pour que tu puisses créer ton compte et être prêt à recevoir les premières demandes.",
        ]
      : [
          `Ton inscription compte pour ouvrir Snowro ${coin} : on ouvre quartier par quartier, là où il y a du monde.`,
          "On t'écrit dès que Snowro débarque dans ton secteur. Pas de spam, promis : juste ça.",
        ];

  const titre = "C'est noté, merci !";
  const pied =
    "Tu reçois ce courriel parce que cette adresse a été inscrite à la liste d'attente sur snowro.com. " +
    "Si ce n'est pas toi, ou si tu veux te retirer de la liste, réponds simplement à ce courriel.";
  const lignes = paragraphes(ville ? `à ${ville}` : "dans ton coin");

  return {
    sujet: "C'est noté : tu es sur la liste Snowro",
    html: gabaritCourriel({
      titre,
      paragraphes: paragraphes(ville ? `à ${echapperHtml(ville)}` : "dans ton coin"),
      piedDePage: pied,
    }),
    texte: [titre, "", ...lignes, "", "L'équipe Snowro", "https://snowro.com", "", pied].join("\n"),
  };
}
