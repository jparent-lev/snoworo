import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FRAICHEUR_MS, demanderPrevision, ecouterMeteo, libelleCm, nomCourt, resumePrevision } from "../lib/meteo";
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

const heure = (d) => d.toLocaleTimeString("fr-CA", { hour: "numeric", minute: "2-digit" });
function quand(d) {
  const jour = new Date();
  if (d.toDateString() === jour.toDateString()) return `à ${heure(d)}`;
  return `le ${d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} à ${heure(d)}`;
}

export default function PrevisionNeige({ villeGeoId, role }) {
  const [meteo, setMeteo] = useState(undefined); // undefined = en cours
  const [demandee, setDemandee] = useState(null);
  const [indisponible, setIndisponible] = useState(false);
  useEffect(() => (villeGeoId ? ecouterMeteo(villeGeoId, setMeteo) : undefined), [villeGeoId]);
  // Aucune prévision, ou trop vieille : on la demande une fois au serveur,
  // et la dernière connue reste affichée en attendant.
  useEffect(() => {
    if (!villeGeoId || meteo === undefined || demandee === villeGeoId) return;
    const recue = meteo?.recupereeAt?.toMillis?.() ?? 0;
    if (!meteo || Date.now() - recue > FRAICHEUR_MS) {
      setDemandee(villeGeoId);
      setIndisponible(false);
      demanderPrevision(villeGeoId).then((r) => {
        if (!r?.data?.aJour && !r?.data?.ecrites) setIndisponible(true);
      });
    }
  }, [villeGeoId, meteo, demandee]);
  if (!villeGeoId) return null;
  if (!meteo?.periodes?.length) {
    return (
      <section className="prevision prevision--attente" aria-label="Prévision de neige">
        <p className="prevision__resume">Prévision de neige</p>
        <p className="prevision__pied">{indisponible ? "Prévision indisponible pour l'instant. Nouvel essai à la prochaine visite." : "Chargement de la prévision d'Environnement Canada…"}</p>
      </section>
    );
  }

  const periodes = meteo.periodes.slice(0, 6);
  const bordee = periodes.some((p) => p.neige === "accumulation");
  const emise = meteo.emiseA ? new Date(meteo.emiseA) : null;
  const recue = meteo.recupereeAt?.toDate?.() ?? null;
  const vieille = recue && Date.now() - recue.getTime() > 3 * 3600e3;

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
          {recue && <strong className={vieille ? "prevision__vieille" : ""}>Actualisée {quand(recue)}. </strong>}
          {emise && `Prévision émise ${quand(emise)}. `}
          Source : Environnement et Changement climatique Canada, station {meteo.station?.nom}.{" "}
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
