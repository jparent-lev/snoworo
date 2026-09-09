import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { grantConsent, revokeConsent } from "../lib/consents";
import { mettreAJourAdresseParPosition, mettreAJourAdresseParTexte } from "../lib/adresse";
import { encoderGeohash } from "../lib/geo";
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
  const [erreurAdresse, setErreurAdresse] = useState(null);
  const [majAdresseEnCours, setMajAdresseEnCours] = useState(false);
  const [adresseTexte, setAdresseTexte] = useState("");

  async function basculer(type, accorde) {
    setEnCours(type);
    try {
      if (accorde) await revokeConsent(type);
      else await grantConsent(type);
    } finally {
      setEnCours(null);
    }
  }

  function mettreAJourParPosition() {
    if (!navigator.geolocation) {
      setErreurAdresse("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setErreurAdresse(null);
    setMajAdresseEnCours(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const hash = encoderGeohash(pos.coords.latitude, pos.coords.longitude);
          await mettreAJourAdresseParPosition(hash);
        } catch {
          setErreurAdresse("Impossible de déterminer ta ville à partir de cette position. Réessaie, ou entre ton adresse manuellement.");
        } finally {
          setMajAdresseEnCours(false);
        }
      },
      () => {
        setErreurAdresse("Localisation refusée ou indisponible — entre ton adresse manuellement ci-dessous.");
        setMajAdresseEnCours(false);
      },
      { timeout: 10000 },
    );
  }

  async function mettreAJourParTexte(e) {
    e.preventDefault();
    if (!adresseTexte.trim()) return;
    setErreurAdresse(null);
    setMajAdresseEnCours(true);
    try {
      await mettreAJourAdresseParTexte(adresseTexte.trim());
      setAdresseTexte("");
    } catch {
      setErreurAdresse("Adresse introuvable — vérifie l'orthographe et réessaie.");
    } finally {
      setMajAdresseEnCours(false);
    }
  }

  if (!profile) return null;

  return (
    <div className="parametres__page">
      <h1>Ton adresse de service</h1>
      <p className="parametres__intro">
        Détermine les demandes que tu peux voir : jamais hors de ta ville, même si la distance semble
        raisonnable.
      </p>

      <div className="parametres__item">
        <div className="parametres__item-texte">
          <h3>{profile.ville ? profile.ville : "Aucune adresse enregistrée"}</h3>
          <p>
            {profile.ville
              ? "Tu vois les demandes ouvertes dans cette ville."
              : "Ajoute ton adresse pour voir les demandes près de chez toi."}
          </p>
          {erreurAdresse && <p className="parametres__meta">{erreurAdresse}</p>}
        </div>
        <button
          type="button"
          className="auth-form__bouton"
          onClick={mettreAJourParPosition}
          disabled={majAdresseEnCours}
          style={{ flex: "none" }}
        >
          {majAdresseEnCours ? "Localisation…" : profile.ville ? "Mettre à jour" : "Utiliser ma position"}
        </button>
      </div>

      <form className="parametres__adresse-manuelle" onSubmit={mettreAJourParTexte}>
        <label className="auth-form__champ" style={{ flex: 1 }}>
          Ou entre ton adresse
          <input
            type="text"
            value={adresseTexte}
            onChange={(e) => setAdresseTexte(e.target.value)}
            placeholder="123 rue des Érables, Lévis"
            disabled={majAdresseEnCours}
          />
        </label>
        <button type="submit" className="auth-form__bouton" disabled={majAdresseEnCours || !adresseTexte.trim()}>
          {majAdresseEnCours ? "Recherche…" : "Utiliser cette adresse"}
        </button>
      </form>

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
