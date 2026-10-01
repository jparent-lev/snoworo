import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { publierDemande, messageErreur } from "../lib/cycleDemande";
import { calculerPaiement, ecouterConfigFrais } from "../lib/config";
import { formatArgent } from "../lib/formatArgent";
import { PAIEMENT_REEL, libelleCarte } from "../lib/paiements";
import { useAuth } from "../context/AuthContext";
import CarteDePaiement from "../components/CarteDePaiement";
import "./AuthForm.css";

const TYPES_SERVICE = [
  { value: "entree", label: "Entrée / allée" },
  { value: "entree_balcon", label: "Entrée + balcon" },
  { value: "stationnement", label: "Stationnement" },
  { value: "toiture", label: "Toiture" },
];

const styleChamp = {
  fontFamily: "var(--font-corps)",
  fontSize: "15.5px",
  background: "var(--color-surface-secondaire)",
  border: "1px solid var(--color-bordure)",
  borderRadius: "var(--radius-bouton)",
  padding: "var(--space-4)",
  color: "var(--color-terre)",
};

// « 2026-10-01T08:00 » pour un champ datetime-local, en heure locale.
function versChampDate(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

// Par défaut : demain 8 h, le cas le plus courant (« avant d'aller travailler »).
function demainHuitHeures() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return versChampDate(d);
}

// L'adresse saisie est géocodée côté serveur (publierDemande) : jamais la
// position du téléphone, qui peut être au travail plutôt qu'à la maison.
export default function PublierDemande() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  // La carte enregistrée pendant cette visite s'affiche tout de suite, avant
  // que la fiche (users/{uid}.carte, écrite par le serveur) se mette à jour.
  const [carteAjoutee, setCarteAjoutee] = useState(null);
  const [changerCarte, setChangerCarte] = useState(false);
  const carte = carteAjoutee ?? profile?.carte;
  const carteManquante = PAIEMENT_REEL && !carte;
  const [adresse, setAdresse] = useState("");
  const [typeService, setTypeService] = useState(TYPES_SERVICE[1].value);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [outilsFournis, setOutilsFournis] = useState(false);
  const [montant, setMontant] = useState("40");
  const [dateHeureSouhaitee, setDateHeureSouhaitee] = useState(demainHuitHeures);
  const [frais, setFrais] = useState(undefined);
  // Au moins 30 min plus tard (même règle que le serveur), calculé une fois.
  const [minimum] = useState(() => versChampDate(new Date(Date.now() + 30 * 60 * 1000)));
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => ecouterConfigFrais(setFrais), []);

  const montantNombre = Number(montant);
  const apercu = montantNombre >= 10 ? calculerPaiement(montantNombre, frais) : null;
  const titreParDefaut = TYPES_SERVICE.find((t) => t.value === typeService).label;

  async function onSubmit(e) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await publierDemande({
        adresse: adresse.trim(),
        typeService,
        titre: titre.trim() || titreParDefaut,
        description: description.trim(),
        outilsFournis,
        montant: montantNombre,
        dateHeureSouhaitee: new Date(dateHeureSouhaitee).toISOString(),
      });
      navigate("/tableau-de-bord");
    } catch (err) {
      setErreur(messageErreur(err));
      setEnCours(false);
    }
  }

  return (
    <div className="auth-form__page">
      <form className="auth-form__carte" onSubmit={onSubmit} style={{ maxWidth: 460 }}>
        <h1 className="auth-form__titre">Publier une demande</h1>

        <label className="auth-form__champ">
          Adresse à déneiger
          <input
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="1234, 3e Avenue, Québec"
            autoComplete="street-address"
            required
          />
          <span className="auth-form__aide">
            Montrée seulement au déneigeur de quartier qui accepte. Les autres voient le quartier et la distance.
          </span>
        </label>

        <label className="auth-form__champ">
          Type de service
          <select value={typeService} onChange={(e) => setTypeService(e.target.value)} style={styleChamp}>
            {TYPES_SERVICE.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="auth-form__champ">
          Titre (facultatif)
          <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder={titreParDefaut} maxLength={80} />
        </label>

        <label className="auth-form__champ">
          Précisions (facultatif)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Entrée double, marches du balcon, auto dans l'allée…"
            rows={3}
            maxLength={600}
            style={{ ...styleChamp, resize: "vertical" }}
          />
        </label>

        <label className="auth-form__case">
          <input type="checkbox" checked={outilsFournis} onChange={(e) => setOutilsFournis(e.target.checked)} />
          Je fournis la pelle ou le grattoir sur place
        </label>

        <label className="auth-form__champ">
          Au plus tard
          <input
            type="datetime-local"
            value={dateHeureSouhaitee}
            min={minimum}
            onChange={(e) => setDateHeureSouhaitee(e.target.value)}
            required
          />
        </label>

        <label className="auth-form__champ">
          Montant offert ($)
          <input type="number" min="10" max="1000" step="1" value={montant} onChange={(e) => setMontant(e.target.value)} required />
          {apercu && (
            <span className="auth-form__aide">
              Tu paies {formatArgent(apercu.montantTotal)}, le déneigeur reçoit {formatArgent(apercu.montantDeneigeur)} (frais
              Snowro {formatArgent(apercu.fraisSnowro)}). Paiement retenu jusqu'à ce que la job soit confirmée.
            </span>
          )}
        </label>

        {PAIEMENT_REEL && (
          <div className="auth-form__champ">
            Paiement
            {carte && !changerCarte ? (
              <span className="auth-form__carte-enregistree">
                {libelleCarte(carte)}
                <button type="button" className="btn btn--lien" onClick={() => setChangerCarte(true)}>
                  Changer
                </button>
              </span>
            ) : (
              <CarteDePaiement
                onEnregistree={(c) => {
                  setCarteAjoutee(c);
                  setChangerCarte(false);
                }}
              />
            )}
            <span className="auth-form__aide">
              Rien n'est prélevé maintenant. Le montant est prélevé quand un déneigeur de quartier accepte, puis
              versé une fois la job confirmée.
            </span>
          </div>
        )}

        {erreur && <p className="message-erreur" role="alert">{erreur}</p>}

        <button type="submit" className="auth-form__bouton" disabled={enCours || carteManquante}>
          {enCours ? "Publication…" : "Publier la demande"}
        </button>
        <p className="auth-form__aide" style={{ textAlign: "center" }}>
          Une fois acceptée par un déneigeur de quartier, la demande ne peut plus être annulée.
        </p>
      </form>
    </div>
  );
}
