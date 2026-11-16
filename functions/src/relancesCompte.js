import { echapperHtml, gabaritCourriel } from "./courriels.js";

// Gabarits des courriels de relance (comptes incomplets), purs et testables.
// La série (qui reçoit quoi, quand) est dans relancesSerie.js.
// Trois courriels au plus par personne, seulement l'étape qui manque.

export const ETAPES = {
  adresseService: {
    titre: "Ajouter votre adresse de service",
    detail: "elle détermine les demandes que vous voyez près de chez vous.",
    lien: "/parametres#adresse",
  },
  versement: {
    titre: "Configurer votre compte de versement",
    detail: "Stripe vérifie votre identité et votre compte bancaire, une seule fois. C'est là que l'argent de vos demandes est versé.",
    lien: "/parametres#paiement",
  },
  courriel: {
    titre: "Confirmer votre adresse courriel",
    detail: "nécessaire pour publier une demande.",
    lien: "/parametres",
  },
  adresseClient: {
    titre: "Enregistrer votre adresse",
    detail: "votre demande se publie ensuite en quelques secondes.",
    lien: "/parametres#adresses",
  },
  carte: {
    titre: "Enregistrer votre carte (facultatif)",
    detail: "rien n'est prélevé avant qu'un déneigeur de quartier accepte votre demande.",
    lien: "/parametres#paiement",
  },
};

const bouton = (lien, texte) =>
  `<a href="${echapperHtml(lien)}" style="display:inline-block;background:#9E4E23;color:#FFFDF8;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px;">${echapperHtml(texte)}</a>`;
const signature = "Jonathan Parent, fondateur<br>Snowro";
const signatureTexte = "Jonathan Parent, fondateur\nSnowro";
const bonjour = (prenom) => (prenom ? `Bonjour ${prenom},` : "Bonjour,");
const piedHtml = (lienDesabonnement) =>
  `Vous recevez ce courriel parce que votre compte Snowro n'est pas encore complet. Vous ne recevrez pas plus de trois rappels. <a href="${echapperHtml(lienDesabonnement)}" style="color:#6B5445;">Ne plus recevoir ces rappels</a>`;
const piedTexte = (lienDesabonnement) =>
  `Vous recevez ce courriel parce que votre compte Snowro n'est pas encore complet. Vous ne recevrez pas plus de trois rappels. Ne plus recevoir ces rappels : ${lienDesabonnement}`;
const listeHtml = (cles) =>
  cles.map((c) => `&bull; <strong>${echapperHtml(ETAPES[c].titre)}</strong> : ${echapperHtml(ETAPES[c].detail)}`).join("<br>");
const listeTexte = (cles) => cles.map((c) => `- ${ETAPES[c].titre} : ${ETAPES[c].detail}`).join("\n");
const premiereEtape = (cles) => ETAPES[cles.find((c) => c !== "carte") ?? cles[0]]?.lien ?? "/parametres";

// Courriel 1 : le lendemain de l'inscription.
export function courrielEtapes({ prenom, manquantes, urlSite, lienDesabonnement }) {
  const n = manquantes.filter((c) => c !== "carte").length || manquantes.length;
  const sujet = `Il vous reste ${n} étape${n > 1 ? "s" : ""} pour être prêt avec Snowro`;
  const lien = `${urlSite}${premiereEtape(manquantes)}`;
  const intro = "Merci d'avoir créé votre compte Snowro. Pour être prêt le jour où la neige tombe, il vous reste :";
  return {
    sujet,
    html: gabaritCourriel({
      titre: "Votre compte est presque prêt",
      paragraphes: [echapperHtml(bonjour(prenom)), echapperHtml(intro), listeHtml(manquantes), bouton(lien, "Compléter mon compte"), "Ça prend environ 5 minutes.", signature],
      piedDePage: piedHtml(lienDesabonnement),
    }),
    texte: [bonjour(prenom), intro, listeTexte(manquantes), `Compléter mon compte : ${lien}`, "Ça prend environ 5 minutes.", signatureTexte, piedTexte(lienDesabonnement)].join("\n\n"),
  };
}

// Courriel 2 : quatre jours après, déneigeurs sans compte de versement actif.
export function courrielVersement({ prenom, commence, urlSite, lienDesabonnement }) {
  const lien = `${urlSite}${ETAPES.versement.lien}`;
  const etat = commence ? "est commencé, mais pas terminé" : "n'est pas encore configuré";
  const p1 = `Votre compte de déneigeur est créé, mais votre compte de versement ${etat}. Sans lui, vous ne pouvez pas être payé pour vos demandes.`;
  const p2 = "Mieux vaut le faire maintenant, au calme. Stripe vérifie votre identité et votre compte bancaire une seule fois, et votre tout premier versement prend environ 7 jours. Ensuite, l'argent arrive en général 2 à 4 jours ouvrables après chaque demande confirmée.";
  const p3 = "Aucune entreprise n'est requise : vous vous inscrivez comme particulier.";
  return {
    sujet: "Votre compte de versement n'est pas encore prêt",
    html: gabaritCourriel({
      titre: "Votre compte de versement",
      paragraphes: [echapperHtml(bonjour(prenom)), echapperHtml(p1), echapperHtml(p2), bouton(lien, "Configurer mon compte de versement"), echapperHtml(p3), signature],
      piedDePage: piedHtml(lienDesabonnement),
    }),
    texte: [bonjour(prenom), p1, p2, `Configurer mon compte de versement : ${lien}`, p3, signatureTexte, piedTexte(lienDesabonnement)].join("\n\n"),
  };
}

// Courriel 3 : la veille d'une bordée annoncée dans la ville, une seule fois.
export function courrielBordee({ prenom, deneigeur, manquantes, ville, jour, cm, urlSite, lienDesabonnement }) {
  const lien = `${urlSite}${premiereEtape(manquantes)}`;
  const annonce = `Environnement Canada annonce ${cm} cm de neige ${jour} à ${ville}.`;
  const corps = deneigeur
    ? "Les demandes vont arriver. Pour pouvoir les accepter et être payé, il vous reste :"
    : "Si vous voulez de l'aide pour déneiger, votre compte sera prêt plus vite si vous complétez d'abord :";
  const fin = deneigeur ? null : "Vous pourrez ensuite publier votre demande en deux minutes.";
  return {
    sujet: `Bordée annoncée ${jour} à ${ville} : êtes-vous prêt ?`,
    html: gabaritCourriel({
      titre: `Bordée annoncée ${echapperHtml(jour)}`,
      paragraphes: [
        echapperHtml(bonjour(prenom)),
        echapperHtml(annonce),
        echapperHtml(corps),
        listeHtml(manquantes),
        ...(fin ? [echapperHtml(fin)] : []),
        bouton(lien, "Compléter mon compte"),
        signature,
      ],
      piedDePage: piedHtml(lienDesabonnement),
    }),
    texte: [bonjour(prenom), annonce, corps, listeTexte(manquantes), ...(fin ? [fin] : []), `Compléter mon compte : ${lien}`, signatureTexte, piedTexte(lienDesabonnement)].join("\n\n"),
  };
}
