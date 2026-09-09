// Formatage québécois exact demandé par design_handoff_snowro_site/README.md :
// virgule décimale, espace insécable avant le $, décimales ",00" supprimées
// ("5,60 $", "18 $" — pas "18,00 $").
export function formatArgent(montant) {
  const arrondi = Math.round(montant * 100) / 100;
  const texte = arrondi.toFixed(2).replace(".", ",").replace(",00", "");
  return `${texte} $`;
}
