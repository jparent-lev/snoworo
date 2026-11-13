import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ecouterMeteo, libelleCm, nomCourt, resumePrevision } from "../lib/meteo";
import "./PrevisionNeige.css";

// Prévision de neige des prochaines périodes pour la ville de l'utilisateur :
// un petit graphique en SVG (aucune carte, aucun script externe). Rien ne
// s'affiche tant que la ville n'a pas de prévision.
const MAX_CM = 30;

function Flocon({ neige }) {
  return (
    <svg viewBox="0 0 24 24" className={`prevision__flocon prevision__flocon--${neige}`} aria-hidden="true">
      <g strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" />
        <path d="M9 4l3 2 3-2M9 20l3-2 3 2M4 10.5l3.5-.3L6 7M18 13.5l-3.5.3L16 17M4 13.5l3.5.3L6 17M18 10.5l-3.5-.3L16 7" />
      </g>
    </svg>
  );
}

function libellePeriode(p) {
  if (p.neige === "accumulation") return libelleCm(p.cm);
  if (p.neige === "risque") return `${p.probabilite} %`;
  if (p.neige === "neige") return "Neige";
  return "Aucune";
}

export default function PrevisionNeige({ villeGeoId, role }) {
  const [meteo, setMeteo] = useState(null);
  useEffect(() => (villeGeoId ? ecouterMeteo(villeGeoId, setMeteo) : undefined), [villeGeoId]);
  if (!villeGeoId || !meteo?.periodes?.length) return null;

  const periodes = meteo.periodes.slice(0, 6);
  const bordee = periodes.some((p) => p.neige === "accumulation");
  const emise = meteo.emiseA ? new Date(meteo.emiseA).toLocaleTimeString("fr-CA", { hour: "numeric", minute: "2-digit" }) : null;

  return (
    <section className={`prevision ${bordee ? "prevision--bordee" : ""}`} aria-label="Prévision de neige">
      <p className="prevision__resume">{resumePrevision(periodes, { ville: meteo.ville, role })}</p>
      <ol className="prevision__periodes">
        {periodes.map((p, i) => {
          const hauteur = p.neige === "accumulation" ? Math.max(8, Math.min(1, p.cm.max / MAX_CM) * 44) : p.neige === "aucune" ? 0 : 4;
          return (
            <li key={i} className={`prevision__periode prevision__periode--${p.neige}`} title={p.texte}>
              <span className="prevision__nom">{nomCourt(p.nom)}</span>
              <Flocon neige={p.neige} />
              <span className="prevision__barre-zone" aria-hidden="true">
                <span className="prevision__barre" style={{ height: hauteur }} />
              </span>
              <span className="prevision__valeur">{libellePeriode(p)}</span>
              {p.temperature && (
                <span className="prevision__temp">
                  {p.temperature.type === "max" ? "Max" : "Min"} {p.temperature.valeur} °C
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="prevision__pied">
        <span>
          Source : Environnement et Changement climatique Canada, station {meteo.station?.nom}
          {emise ? `, prévision de ${emise}` : ""}.{" "}
          <a href={meteo.lien} target="_blank" rel="noopener noreferrer">
            Prévision complète
          </a>
        </span>
        {bordee && role === "client" && (
          <Link to="/publier" className="btn btn--principal prevision__cta">
            Publier avant la bordée
          </Link>
        )}
      </div>
    </section>
  );
}
