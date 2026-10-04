// Crédit d'impôt pour maintien à domicile des aînés (Revenu Québec).
// Seul endroit à modifier lors de la mise à jour annuelle : tous les textes de
// la page /credit-impot lisent ces valeurs. Source : pages de Revenu Québec
// (liens dans le pied de la page).
export const CREDIT_MAD = {
  annee: 2026,
  taux: 0.4,
  seuilReductionRevenu: 72465,
  plafondSeulAutonome: 19500,
  plafondCoupleAutonome: 39000,
};

// Version de la page : à incrémenter à chaque déploiement qui la modifie.
// v1.1 : sans les versements anticipés ni la notion de contrat (Snowro
// fonctionne à la demande) ; le relevé de fin d'année est mis de l'avant.
export const VERSION_PAGE_CREDIT = "credit-impot v1.1";

export const LIENS_REVENU_QUEBEC = {
  credit: "https://www.revenuquebec.ca/fr/citoyens/credits-dimpot/credit-dimpot-pour-maintien-a-domicile/",
  demande:
    "https://www.revenuquebec.ca/fr/citoyens/credits-dimpot/credit-dimpot-pour-maintien-a-domicile/demande-du-credit-maintien-a-domicile/",
};

// Curseur du calculateur.
export const CURSEUR = { min: 200, max: 1500, pas: 25, defaut: 600 };

// Format fr-CA, espace insécable avant le symbole.
export const dollars = (n) => `${n.toLocaleString("fr-CA")} $`;
export const pourcent = (taux) => `${Math.round(taux * 100)} %`;
export const creditPour = (montant) => Math.round(montant * CREDIT_MAD.taux);
