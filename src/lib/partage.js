// Texte et lien du partage après l'inscription à la liste d'attente (voir
// src/pages/landing/PartageListe.jsx). Même lien pour tout le monde : aucun
// suivi de qui a invité qui.
export const URL_SITE = "https://snowro.com";

export function messagePartage({ role, ville }) {
  const ou = ville ? `à ${ville}` : "dans notre coin";
  return role === "deneigeur"
    ? `Je viens de m'inscrire comme déneigeur de quartier sur Snowro : tu publies ta demande de déneigement, un voisin vient pelleter, sans contrat. Ça ouvre ${ou} dès qu'on est assez nombreux. Inscris-toi toi aussi :`
    : `Je viens de m'inscrire à Snowro : du déneigement à la demande par des déneigeurs de quartier, sans contrat. Ça ouvre ${ou} dès qu'on est assez nombreux. Inscris-toi toi aussi :`;
}
