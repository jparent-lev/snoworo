// Mesure d'audience : DÉSACTIVÉE. Snowro n'a ni outil de mesure ni bannière
// de consentement, et la politique de confidentialité affirme qu'aucun témoin
// de mesure d'audience n'est utilisé (Loi 25 : rien avant consentement). Les
// pages appellent déjà mesurer() aux bons endroits ; brancher un outil ici,
// derrière un consentement explicite, sera un chantier à part (bannière,
// politique, évaluation des transferts hors Québec).
export function mesurer(evenement, donnees = {}) {
  void evenement;
  void donnees;
}
