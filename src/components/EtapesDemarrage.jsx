import { Link } from "react-router-dom";
import { etapesDemarrage } from "../lib/etapes";

// Liste numérotée des étapes à faire avant d'utiliser Snowro comme déneigeur.
// Affichée seulement tant qu'une étape obligatoire manque.
export default function EtapesDemarrage({ profile }) {
  const etapes = etapesDemarrage(profile);
  const manquantes = etapes.filter((e) => e.requis && !e.fait);
  if (!manquantes.length) return null;
  const prochaine = etapes.find((e) => !e.fait && e.requis);
  return (
    <section className="etapes-demarrage" aria-labelledby="etapes-demarrage-titre">
      <h2 id="etapes-demarrage-titre">
        {manquantes.length === 1 ? "Une étape avant de commencer" : `${manquantes.length} étapes avant de commencer`}
      </h2>
      <p className="etapes-demarrage__intro">
        {profile.villeGeoId
          ? "Vous voyez les demandes de votre ville, mais vous pourrez en accepter une seulement une fois ces étapes faites."
          : "Faites ces étapes une seule fois pour voir les demandes de votre ville et commencer à déneiger."}
      </p>
      <ol className="etapes-demarrage__liste">
        {etapes.map((e, i) => (
          <li key={e.cle} className={`etapes-demarrage__etape ${e.fait ? "etapes-demarrage__etape--faite" : ""}`}>
            <span className="etapes-demarrage__num" aria-hidden="true">
              {e.fait ? "✓" : i + 1}
            </span>
            <div className="etapes-demarrage__texte">
              <b>
                {e.titre}
                {e.fait && <span className="sr-only"> : fait</span>}
              </b>
              {!e.fait && <span>{e.detail}</span>}
            </div>
            {!e.fait && (
              <Link to={e.lien} className={`btn ${e === prochaine ? "btn--principal" : "btn--fantome"} etapes-demarrage__action`}>
                {e.action}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
