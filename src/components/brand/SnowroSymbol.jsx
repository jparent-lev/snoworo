// « Le S sur sa lame » — géométrie et couleurs figées, voir
// design_handoff_snowro_brand/README.md (§ Le symbole). Rendu en <text> +
// Fraunces (chargée globalement dans styles/tokens.css) : à vectoriser en
// <path> avant un envoi de production qui ne garantit pas le chargement de la police.
const VARIANTS = {
  x: { lame: "#D9A544", lettre: "#C1652F", tuile: null },
  pro: { lame: "#D9A544", lettre: "#4F6B72", tuile: null, barreZone: "#4F6B72" },
  reversed: { lame: "#D9A544", lettre: "#EDE0CC", tuile: null },
  // Icône d'appli sans neige : tuile argile, lettre lin (contraste normal du système).
  appIcon: { lame: "#D9A544", lettre: "#EDE0CC", tuile: "#C1652F" },
};

// Amas de neige sur l'épaule du S — voir handoff_logo_neige/README.md.
// Calé sur le contour réel du glyphe (Fraunces 900, font-size 92, baseline
// y=74) : à recaler si la lettre est revectorisée ou la graisse ajustée.
const NEIGE_PATH =
  "M22 29 Q20 12 28 6 Q33 0 39 3 Q47 0 51 8 Q45 12 39 12 Q33 13 29 17 Q25 22 24 30 Z";
const NEIGE_COULEUR = "#FFFDF8"; // doit rester la valeur la plus claire de la composition
const NEIGE_TAILLE_MIN = 32; // en dessous, l'amas devient une entaille indistincte

export default function SnowroSymbol({ variant = "x", neige = false, size = 32, className }) {
  const v = VARIANTS[variant] ?? VARIANTS.x;
  const isPro = variant === "pro";
  const isAppIcon = variant === "appIcon";
  const viewBox = isPro ? "0 0 100 106" : "0 0 100 100";
  const afficherNeige = neige && size >= NEIGE_TAILLE_MIN;

  // Deux règles de contraste du handoff neige, appliquées automatiquement
  // pour que l'appelant n'ait pas à s'en souvenir :
  // - Sur fond terre, le S doit rester en argile (jamais lin) pour que
  //   l'amas blanc cassé se détache de la lettre.
  // - Sur l'icône d'appli, la neige inverse tuile/lettre (lin + argile)
  //   plutôt qu'argile + lin, sinon l'amas se confond avec la tuile.
  let lettre = v.lettre;
  let tuile = v.tuile;
  if (afficherNeige && variant === "reversed") lettre = "#C1652F";
  if (afficherNeige && isAppIcon) {
    tuile = "#EDE0CC";
    lettre = "#C1652F";
  }

  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={isPro ? (size * 106) / 100 : size}
      className={className}
      role="img"
      aria-label="Snowro"
    >
      {tuile && <rect x="0" y="0" width="100" height="100" rx="30" fill={tuile} />}
      <path fill={v.lame} d="M24 70 H76 L78 84 A9 9 0 0 1 69 92 H31 A9 9 0 0 1 22 84 Z" />
      <text
        x="50"
        y="74"
        textAnchor="middle"
        fontFamily="Fraunces"
        fontWeight="900"
        fontSize="92"
        fill={lettre}
      >
        S
      </text>
      {afficherNeige && <path fill={NEIGE_COULEUR} d={NEIGE_PATH} />}
      {isPro && <rect x="14" y="99" width="72" height="7" rx="3.5" fill={v.barreZone} />}
    </svg>
  );
}
