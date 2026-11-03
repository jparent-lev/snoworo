import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { FieldValue } from "firebase-admin/firestore";
import { RESEND_API_KEY, echapperHtml, envoyerCourriel, gabaritCourriel } from "./courriels.js";
import { URL_SITE } from "./paiements.js";

// Courriel de confirmation de la liste d'attente (double confirmation,
// anti-pourriel) : il part chaque fois que rejoindreListeAttente pose un
// nouveau jeton (première inscription, ou nouvelle demande plus de 10 minutes
// après la précédente tant que l'adresse n'est pas confirmée). Le lien mène à
// /liste/confirmer, qui appelle confirmerListeAttente.
//
// Séparé de rejoindreListeAttente exprès : un envoi qui échoue ne doit
// jamais faire échouer l'inscription elle-même. Le résultat est noté dans
// `confirmation` sur le document, pour pouvoir relancer à la main les échecs
// (cette écriture ne change pas le jeton : aucun nouvel envoi).
export const envoyerConfirmationListeAttente = onDocumentWritten(
  { document: "listeAttente/{id}", region: "northamerica-northeast1", secrets: [RESEND_API_KEY] },
  async (event) => {
    const avant = event.data?.before?.data();
    const apres = event.data?.after?.data();
    // Inscription effacée, déjà confirmée, ou jeton inchangé : rien à envoyer.
    if (!apres?.jetonConfirmation || apres.confirmee !== false) return;
    if (apres.jetonConfirmation === avant?.jetonConfirmation) return;

    const { id } = event.params;
    const lien = `${URL_SITE.value()}/liste/confirmer?c=${encodeURIComponent(id)}&j=${apres.jetonConfirmation}`;
    const { sujet, html, texte } = composerConfirmation({ ...apres, lien });
    const ref = event.data.after.ref;
    try {
      const resendId = await envoyerCourriel({
        a: apres.courriel,
        sujet,
        html,
        texte,
        cleIdempotence: `liste-attente-${id}-${apres.jetonConfirmation.slice(0, 16)}`,
        type: "confirmation_liste_attente",
      });
      await ref.update({
        confirmation: { statut: "envoyee", resendId, envoyeeAt: FieldValue.serverTimestamp(), erreur: null },
      });
    } catch (err) {
      logger.error(`Confirmation de liste d'attente non envoyée à ${apres.courriel} : ${err.message}`);
      await ref.update({
        confirmation: { statut: "echec", resendId: null, envoyeeAt: null, erreur: err.message },
      });
    }
  },
);

export function composerConfirmation({ nom, role, ville, lien }) {
  // `coin` est inséré tel quel : échappé pour la version HTML seulement.
  const paragraphes = (coin) =>
    role === "pro"
      ? [
          `Merci de votre intérêt pour Snowro Pro. Votre entreprise est inscrite pour être avertie en premier.`,
          `Nous préparons une offre pour les entreprises de déneigement qui souhaitent savoir où se trouve la demande dans leurs secteurs, à commencer ${coin}. Nous vous écrirons dès que les détails sont prêts.`,
        ]
      : role === "deneigeur"
      ? [
          `Merci de vouloir donner un coup de pelle avec Snowro. Votre inscription comme déneigeur de quartier contribue à l'ouverture de Snowro ${coin}.`,
          "Avant l'ouverture, nous vous écrirons afin que vous puissiez créer votre compte et être en mesure de recevoir les premières demandes.",
        ]
      : [
          `Votre inscription contribue à l'ouverture de Snowro ${coin} : nous ouvrons quartier par quartier, là où la demande est présente.`,
          "Nous vous écrirons dès que Snowro sera offert dans votre secteur. Aucun pourriel : uniquement cet avis.",
        ];
  // Partage simple (même lien pour tout le monde), comme sur le site.
  const partage = (lien) =>
    `Connaissez-vous des voisins qui aimeraient faire déneiger ou donner un coup de pelle ? Partagez-leur ${lien} : plus nous sommes nombreux dans votre secteur, plus tôt nous ouvrirons.`;

  const prenom = (nom ?? "").split(" ")[0];
  const titre = prenom ? `Bonjour ${prenom}, une dernière étape` : "Une dernière étape";
  const appel = "Confirmez votre adresse courriel pour terminer votre inscription. Le lien est valide 7 jours.";
  const bouton = `<a href="${echapperHtml(lien)}" style="display:inline-block;background:#9E4E23;color:#FFFDF8;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px;">Confirmer mon inscription</a>`;
  const pied =
    role === "pro"
      ? "Vous recevez ce courriel parce que cette adresse a été inscrite à la liste Snowro Pro sur snowro.com. " +
        "Si ce n'est pas vous, ignorez ce courriel : sans confirmation, l'inscription est effacée après 7 jours."
      : "Vous recevez ce courriel parce que cette adresse a été inscrite à la liste d'attente sur snowro.com. " +
        "Si ce n'est pas vous, ignorez ce courriel : sans confirmation, l'inscription est effacée après 7 jours.";
  const pro = role === "pro";
  const coin = (v) => (v ? `à ${v}` : pro ? "dans votre secteur" : "dans votre secteur");
  // Pas d'invitation au partage pour Pro : elle s'adresse aux voisins.
  const lignes = [appel, `Confirmer mon inscription : ${lien}`, ...paragraphes(coin(ville)), ...(pro ? [] : [partage("https://snowro.com")])];

  return {
    sujet: role === "pro" ? "Confirmez l'inscription de votre entreprise à Snowro Pro" : "Confirmez votre inscription à Snowro",
    html: gabaritCourriel({
      titre,
      paragraphes: [
        appel,
        bouton,
        ...paragraphes(coin(ville && echapperHtml(ville))),
        ...(pro ? [] : [partage('<a href="https://snowro.com" style="color:#9E4E23;font-weight:700;">snowro.com</a>')]),
      ],
      piedDePage: pied,
    }),
    texte: [titre, "", ...lignes, "", "L'équipe Snowro", "https://snowro.com", "", pied].join("\n"),
  };
}
