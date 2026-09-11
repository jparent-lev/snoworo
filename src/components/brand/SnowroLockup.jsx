import SnowroSymbol from "./SnowroSymbol";

// Verrouillage horizontal — voir README § Verrouillage horizontal.
// Sous 28px de hauteur de symbole, tomber au symbole seul (contrainte du design system).
export default function SnowroLockup({ qualifiant = "X", neige = false, size = 42, className }) {
  if (size < 28) {
    return (
      <SnowroSymbol variant={qualifiant === "PRO" ? "pro" : "x"} neige={neige} size={size} className={className} />
    );
  }

  const gap = Math.round(size * 0.28);
  const qualifiantColor = qualifiant === "PRO" ? "var(--color-ardoise)" : "var(--color-argile)";

  return (
    <div className={className} style={{ display: "flex", alignItems: "center", gap }}>
      <SnowroSymbol variant={qualifiant === "PRO" ? "pro" : "x"} neige={neige} size={size} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontFamily: "var(--font-titrage)",
            fontWeight: 600,
            fontSize: size * 0.5,
            letterSpacing: "-0.01em",
            color: "var(--color-terre)",
            lineHeight: 1,
          }}
        >
          snowro
        </span>
        <span
          className="eyebrow"
          style={{ letterSpacing: "0.18em", color: qualifiantColor, lineHeight: 1 }}
        >
          {qualifiant}
        </span>
      </div>
    </div>
  );
}
