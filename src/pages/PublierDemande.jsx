import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { publierDemande } from "../lib/demandes";
import { encoderGeohash } from "../lib/geo";
import "./AuthForm.css";

const TYPES_SERVICE = [
  { value: "entree", label: "Entrée / allée" },
  { value: "entree_balcon", label: "Entrée + balcon" },
  { value: "toiture", label: "Toiture" },
  { value: "stationnement", label: "Stationnement commercial" },
];

export default function PublierDemande() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [quartier, setQuartier] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [typeService, setTypeService] = useState(TYPES_SERVICE[0].value);
  const [montant, setMontant] = useState("");
  const [dateHeureSouhaitee, setDateHeureSouhaitee] = useState("");
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErreur(null);

    if (!navigator.geolocation) {
      setErreur("La géolocalisation est requise pour publier une demande.");
      return;
    }

    setEnCours(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const adresseGeohash = encoderGeohash(pos.coords.latitude, pos.coords.longitude);
          await publierDemande({
            donneurOuvrageId: user.uid,
            donneurPrenom: (profile?.displayName || "Voisin").split(" ")[0],
            adresseGeohash,
            postalCodePrefix: codePostal.trim().slice(0, 3).toUpperCase(),
            quartier,
            titre,
            description,
            dateHeureSouhaitee: new Date(dateHeureSouhaitee),
            typeService,
            remunerationOfferte: Number(montant),
          });
          navigate("/demandes");
        } catch {
          setErreur("Impossible de publier la demande. Réessaie.");
        } finally {
          setEnCours(false);
        }
      },
      () => {
        setErreur("Localisation refusée — impossible de publier sans adresse approximative.");
        setEnCours(false);
      },
    );
  }

  return (
    <div className="auth-form__page">
      <form className="auth-form__carte" onSubmit={onSubmit} style={{ maxWidth: 420 }}>
        <h1 className="auth-form__titre">Publier une demande</h1>

        <label className="auth-form__champ">
          Titre
          <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Entrée double + balcon" required />
        </label>

        <label className="auth-form__champ">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Avant 8 h demain matin. Pelle fournie si tu en as pas."
            rows={3}
            required
            style={{
              fontFamily: "var(--font-corps)",
              fontSize: "15.5px",
              background: "var(--color-surface-secondaire)",
              border: "1px solid var(--color-bordure)",
              borderRadius: "var(--radius-bouton)",
              padding: "var(--space-4)",
              resize: "vertical",
            }}
          />
        </label>

        <label className="auth-form__champ">
          Quartier
          <input value={quartier} onChange={(e) => setQuartier(e.target.value)} placeholder="Limoilou" required />
        </label>

        <label className="auth-form__champ">
          Code postal
          <input value={codePostal} onChange={(e) => setCodePostal(e.target.value)} placeholder="G1L" required />
        </label>

        <label className="auth-form__champ">
          Type de service
          <select
            value={typeService}
            onChange={(e) => setTypeService(e.target.value)}
            style={{
              fontFamily: "var(--font-corps)",
              fontSize: "15.5px",
              background: "var(--color-surface-secondaire)",
              border: "1px solid var(--color-bordure)",
              borderRadius: "var(--radius-bouton)",
              padding: "var(--space-4)",
            }}
          >
            {TYPES_SERVICE.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="auth-form__champ">
          Montant offert ($)
          <input type="number" min="1" value={montant} onChange={(e) => setMontant(e.target.value)} required />
        </label>

        <label className="auth-form__champ">
          Date et heure souhaitées
          <input
            type="datetime-local"
            value={dateHeureSouhaitee}
            onChange={(e) => setDateHeureSouhaitee(e.target.value)}
            required
          />
        </label>

        {erreur && <p className="auth-form__erreur">{erreur}</p>}

        <button type="submit" className="auth-form__bouton" disabled={enCours}>
          {enCours ? "Publication…" : "Publier"}
        </button>
      </form>
    </div>
  );
}
