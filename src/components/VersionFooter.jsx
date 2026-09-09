// __SNOWRO_VERSION__ et __SNOWRO_BUILD_TIME__ sont injectés au build par
// vite.config.js (commit court + horodatage) — utile pour distinguer les
// déploiements en production sans avoir à fouiller les logs Netlify.
const formatteurDate = new Intl.DateTimeFormat("fr-CA", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function VersionFooter({ className }) {
  const date = new Date(__SNOWRO_BUILD_TIME__);
  const dateLisible = Number.isNaN(date.getTime()) ? __SNOWRO_BUILD_TIME__ : formatteurDate.format(date);

  return (
    <p className={className} style={{ fontFamily: "var(--font-corps)", fontSize: "11px", color: "var(--color-texte-secondaire)", margin: 0 }}>
      Snowro · {__SNOWRO_VERSION__} · déployé le {dateLisible}
    </p>
  );
}
