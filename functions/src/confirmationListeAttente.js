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
    const inscription = event.data?.data();
    // Inscription déjà effacée (fermeture de compte, durée de conservation)
    // avant que l'événement arrive : rien à confirmer.
    if (!inscription) return;
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
    role === "pro"
      ? [
          `Merci de votre intérêt pour Snowro Pro. Votre entreprise est inscrite pour être avertie en premier.`,
          `On prépare une offre pour les entreprises de déneigement qui veulent voir où la demande se trouve dans leurs secteurs, à commencer ${coin}. On vous écrit dès que les détails sont prêts.`,
        ]
      : role === "deneigeur"
      ? [
          `Merci de vouloir donner un coup de pelle avec Snowro. Ton inscription comme déneigeur de quartier compte pour ouvrir Snowro ${coin}.`,
          "Avant l'ouverture, on t'écrit pour que tu puisses créer ton compte et être prêt à recevoir les premières demandes.",
        ]
      : [
          `Ton inscription compte pour ouvrir Snowro ${coin} : on ouvre quartier par quartier, là où il y a du monde.`,
          "On t'écrit dès que Snowro débarque dans ton secteur. Pas de spam, promis : juste ça.",
        ];
  // Partage simple (même lien pour tout le monde), comme sur le site.
  const partage = (lien) =>
    `Tu connais des voisins qui voudraient faire déneiger ou donner un coup de pelle ? Partage-leur ${lien} : plus on est nombreux dans ton secteur, plus vite on ouvre.`;

  const titre = "C'est noté, merci !";
  const pied =
    role === "pro"
      ? "Vous recevez ce courriel parce que cette adresse a été inscrite à la liste Snowro Pro sur snowro.com. " +
        "Si ce n'est pas vous, ou pour vous retirer de la liste, répondez simplement à ce courriel."
      : "Tu reçois ce courriel parce que cette adresse a été inscrite à la liste d'attente sur snowro.com. " +
        "Si ce n'est pas toi, ou si tu veux te retirer de la liste, réponds simplement à ce courriel.";
  const pro = role === "pro";
  const coin = (v) => (v ? `à ${v}` : pro ? "dans votre secteur" : "dans ton coin");
  // Pas d'invitation au partage pour Pro : elle s'adresse aux voisins.
  const lignes = [...paragraphes(coin(ville)), ...(pro ? [] : [partage("https://snowro.com")])];

  return {
    sujet: role === "pro" ? "C'est noté : votre entreprise est sur la liste Snowro Pro" : "C'est noté : tu es sur la liste Snowro",
    html: gabaritCourriel({
      titre,
      paragraphes: [
        ...paragraphes(coin(ville && echapperHtml(ville))),
        ...(pro ? [] : [partage('<a href="https://snowro.com" style="color:#9E4E23;font-weight:700;">snowro.com</a>')]),
      ],
      piedDePage: pied,
    }),
    texte: [titre, "", ...lignes, "", "L'équipe Snowro", "https://snowro.com", "", pied].join("\n"),
  };
}
