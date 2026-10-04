// Textes de la page /credit-impot (source : snowro-credit-impot.html v1.0,
// validés contre Revenu Québec ; ne pas reformuler les chiffres ni les
// conditions). Pur JavaScript, sans JSX : vite.config.js s'en sert aussi pour
// le titre, la description et le balisage FAQPage de la version statique.
// « 1er » est affiché en exposant par la page.
import { CREDIT_MAD as C, creditPour, dollars, pourcent } from "../../config/creditImpot.js";

const TAUX = pourcent(C.taux);
const SEUIL = dollars(C.seuilReductionRevenu);
const EXEMPLE = 600;

export const META = {
  titre: `Québec rembourse ${TAUX} de votre déneigement | Snowro`,
  description: `Avec le crédit d'impôt pour maintien à domicile des aînés, Québec rembourse ${TAUX} du coût de votre déneigement. Snowro vous jumelle avec un déneigeur de votre quartier et génère vos factures conformes.`,
};

export const FAQ = [
  {
    q: "Mon déneigeur est un particulier, pas une compagnie. Est-ce que ça compte?",
    r: [
      "Oui. Revenu Québec précise que les services peuvent être rendus par une personne que vous employez ou par une entreprise, y compris un travailleur autonome. La condition essentielle : obtenir une facture. C'est exactement ce que Snowro génère à chaque paiement.",
      "Deux exceptions : les services rendus par votre conjoint ou par une personne à votre charge ne donnent pas droit au crédit.",
    ],
  },
  {
    q: "Combien vais-je récupérer exactement?",
    r: [
      `En ${C.annee}, le crédit correspond à ${TAUX} des dépenses admissibles. Pour un contrat de déneigement de ${dollars(EXEMPLE)}, cela représente ${dollars(creditPour(EXEMPLE))} remboursés. C'est un crédit remboursable : vous le recevez même si vous ne payez pas d'impôt.`,
      `Le crédit est réduit graduellement lorsque le revenu familial dépasse environ ${SEUIL}. Des plafonds annuels de dépenses admissibles s'appliquent aussi à l'ensemble de vos services de maintien à domicile (${dollars(C.plafondSeulAutonome)} pour une personne seule autonome, ${dollars(C.plafondCoupleAutonome)} pour un couple autonome).`,
    ],
  },
  {
    q: "C'est quoi, les versements anticipés?",
    r: [
      "Plutôt que d'attendre votre déclaration de revenus au printemps, vous pouvez demander à Revenu Québec de vous verser le crédit pendant l'année. Pour des services comme le déneigement, le versement arrive dans les 30 jours d'une demande transmise en ligne, par dépôt direct.",
      `La demande se fait au plus tard le ${C.dateLimiteVersementsAnticipes} de l'année en cours, en ligne via Mon dossier ou avec le formulaire TPZ-1029.MD.9, accompagné de vos factures.`,
    ],
  },
  {
    q: "Quels documents dois-je conserver?",
    r: [
      "Vos factures et pièces justificatives, pendant six ans. Pour les versements anticipés, le formulaire demande le nom et le numéro de téléphone de chaque fournisseur de services, ainsi que les types de services reçus, à raison d'un formulaire par fournisseur.",
      "Snowro conserve vos factures dans votre compte et vous remet en fin de saison une fiche fiscale par déneigeur qui regroupe tous ces renseignements.",
    ],
  },
  {
    q: "Je paie le déneigement pour mon parent. Le crédit s'applique-t-il?",
    r: [
      "Le crédit vise les dépenses payées par la personne aînée ou son conjoint. Si vous payez de votre poche pour un parent, l'admissibilité devient incertaine. La solution simple : gérer le compte Snowro de votre parent, mais garder son mode de paiement à son nom.",
    ],
  },
  {
    q: "Le sel, l'abrasif ou la location d'équipement comptent-ils?",
    r: [
      "Non. Revenu Québec précise que seul le coût des services est admissible. Le coût des produits et de tout bien utilisé pour réaliser les travaux est exclu. Les factures Snowro distinguent clairement la portion service, pour que votre réclamation soit simple et exacte.",
    ],
  },
  {
    q: "Mon chalet est-il couvert?",
    r: [
      "Non. Le crédit vise uniquement votre lieu principal de résidence. Le déneigement d'une résidence secondaire n'est pas admissible.",
    ],
  },
  {
    q: "Snowro peut-il me donner des conseils fiscaux?",
    r: [
      "Non. L'information sur cette page est générale et provient des publications de Revenu Québec. Pour votre situation personnelle, consultez Revenu Québec (le guide IN-151 résume bien le crédit) ou un professionnel en fiscalité.",
    ],
  },
];

// Balisage schema.org FAQPage, généré à partir des questions ci-dessus.
export function faqSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, r }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: r.join(" ") },
    })),
  };
}
