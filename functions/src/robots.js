// Repérage des inscriptions automatisées (novembre 2026 : des comptes au nom
// fait d'un seul « mot » de 16 à 23 lettres aux majuscules aléatoires, sans
// rôle, jamais revenus). Utilisé pour ne pas leur envoyer de courriel et pour
// les tenir à l'écart des chiffres du tableau admin.
//
// Un vrai nom peut être d'un seul mot (« Marc ») ou avoir une majuscule
// interne (« MacDonald ») : on ne signale qu'un long mot unique avec au moins
// trois passages de minuscule à majuscule, ou sans voyelle.
const VOYELLES = /[aeiouyàâäéèêëîïôöùûü]/gi;

export function nomRobot(nom) {
  const n = String(nom ?? "").trim();
  // Un nom vide ne suffit pas : d'autres parcours (lien magique, invitation)
  // peuvent créer un compte sans nom.
  if (!n || /\s/.test(n) || n.length < 12) return null;
  const passages = (n.match(/\p{Ll}\p{Lu}/gu) ?? []).length;
  if (passages >= 3) return "majuscules aléatoires";
  if ((n.match(VOYELLES) ?? []).length / n.length < 0.15) return "sans voyelles";
  return null;
}
