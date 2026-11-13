import { useEffect, useState } from "react";
import { FRAICHEUR_MS, demanderPrevision, ecouterMeteo, textePastille } from "../lib/meteo";
import "./PrevisionNeige.css";

// Pastille « prochaine bordée » à côté du bonjour du tableau de bord, tirée
// des prévisions d'Environnement Canada pour la ville de l'utilisateur
// (meteo/{villeGeoId}, functions/src/meteo.js), avec le lien vers la
// prévision complète. Légère : aucun graphique ni script externe.
function Flocon() {
  return (
    <svg viewBox="0 0 24 24" className="pastille-neige__flocon" aria-hidden="true">
      <g strokeWidth="2" strokeLinecap="round" fill="none" stroke="currentColor">
        <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" />
        <path d="M9 4l3 2 3-2M9 20l3-2 3 2" />
      </g>
    </svg>
  );
}

const heure = (d) => d.toLocaleTimeString("fr-CA", { hour: "numeric", minute: "2-digit" });

export default function PrevisionNeige({ villeGeoId }) {
  const [meteo, setMeteo] = useState(undefined); // undefined = en cours
  const [demandee, setDemandee] = useState(null);
  const [indisponible, setIndisponible] = useState(false);
  useEffect(() => (villeGeoId ? ecouterMeteo(villeGeoId, setMeteo) : undefined), [villeGeoId]);
  // Aucune prévision, ou trop vieille : on la demande une fois au serveur ;
  // la dernière connue reste affichée en attendant.
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
    if (indisponible) return null;
    return (
      <div className="pastille-neige pastille-neige--attente" aria-live="polite">
        <Flocon />
        Prévisions de neige…
      </div>
    );
  }
  const { ton, texte } = textePastille(meteo.periodes);
  const recue = meteo.recupereeAt?.toDate?.();
  const titre = `Environnement et Changement climatique Canada, station ${meteo.station?.nom}${recue ? `, actualisée à ${heure(recue)}` : ""}`;
  return (
    <div className={`pastille-neige pastille-neige--${ton}`} title={titre}>
      <Flocon />
      <span className="pastille-neige__corps">
        <span>{texte}</span>
        <a href={meteo.lien} target="_blank" rel="noopener noreferrer" className="pastille-neige__lien">
          Prévisions complètes
        </a>
      </span>
    </div>
  );
}
