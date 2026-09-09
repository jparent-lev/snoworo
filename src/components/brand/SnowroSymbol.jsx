// « Le S sur sa lame » — géométrie et couleurs figées, voir
// design_handoff_snowro_brand/README.md (§ Le symbole). Rendu en <text> +
// Fraunces (chargée globalement dans styles/tokens.css) : à vectoriser en
// <path> avant un envoi de production qui ne garantit pas le chargement de la police.
const VARIANTS = {
  x: { lame: "#D9A544", lettre: "#C1652F", tuile: null },
  pro: { lame: "#D9A544", lettre: "#4F6B72", tuile: null, barreZone: "#4F6B72" },
  reversed: { lame: "#D9A544", lettre: "#EDE0CC", tuile: null },
  appIcon: { lame: "#D9A544", lettre: "#EDE0CC", tuile: "#C1652F" },
};

export default function SnowroSymbol({ variant = "x", size = 32, className }) {
  const v = VARIANTS[variant] ?? VARIANTS.x;
  const isPro = variant === "pro";
  const viewBox = isPro ? "0 0 100 106" : "0 0 100 100";

  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={isPro ? (size * 106) / 100 : size}
      className={className}
      role="img"
      aria-label="Snowro"
    >
      {v.tuile && <rect x="0" y="0" width="100" height="100" rx="30" fill={v.tuile} />}
      <path fill={v.lame} d="M24 70 H76 L78 84 A9 9 0 0 1 69 92 H31 A9 9 0 0 1 22 84 Z" />
      <text
        x="50"
        y="74"
        textAnchor="middle"
        fontFamily="Fraunces"
        fontWeight="900"
        fontSize="92"
        fill={v.lettre}
      >
        S
      </text>
      {isPro && <rect x="14" y="99" width="72" height="7" rx="3.5" fill={v.barreZone} />}
    </svg>
  );
}
