import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { grantConsent, revokeConsent } from "../lib/consents";
import "./Parametres.css";

const CONSENTS = [
  {
    type: "zonesAgregees",
    titre: "Statistiques de zone (Snowro Pro)",
    description: "Permet d'inclure tes demandes, de façon anonyme et agrégée, dans les statistiques vues par les déneigeurs professionnels abonnés.",
  },
  {
    type: "offresCiblees",
    titre: "Offres ciblées",
    description: "Permet à un déneigeur professionnel de te contacter directement avec une offre. Toujours révocable.",
  },
  {
    type: "notificationsSMS",
    titre: "Notifications SMS",
    description: "Reçois un texto quand une demande ouvre près de toi ou quand ton match est confirmé.",
  },
];

export default function Parametres() {
  const { profile } = useAuth();
  const [enCours, setEnCours] = useState(null);

  async function basculer(type, accorde) {
    setEnCours(type);
    try {
      if (accorde) await revokeConsent(type);
      else await grantConsent(type);
    } finally {
      setEnCours(null);
    }
  }

  if (!profile) return null;

  return (
    <div className="parametres__page">
      <h1>Tes consentements</h1>
      <p className="parametres__intro">
        Chacun de ces consentements est indépendant, daté, et retirable en tout temps — le retrait est aussi
        simple que l'octroi.
      </p>

      <div className="parametres__liste">
        {CONSENTS.map((c) => {
          const etat = profile.consents?.[c.type];
          const accorde = Boolean(etat?.granted);
          return (
            <div key={c.type} className="parametres__item">
              <div className="parametres__item-texte">
                <h3>{c.titre}</h3>
                <p>{c.description}</p>
                {etat?.grantedAt && (
                  <p className="parametres__meta">
                    {accorde ? "Accordé" : "Retiré"} — version {etat.version}
                  </p>
                )}
              </div>
              <button
                type="button"
                className={`parametres__toggle ${accorde ? "parametres__toggle--actif" : ""}`}
                onClick={() => basculer(c.type, accorde)}
                disabled={enCours === c.type}
                role="switch"
                aria-checked={accorde}
              >
                <span className="parametres__toggle-pastille" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
