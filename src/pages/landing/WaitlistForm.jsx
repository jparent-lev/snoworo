import { useState } from "react";
import { Link } from "react-router-dom";
import { rejoindreListeAttente } from "../../lib/listeAttente";
import PartageListe from "./PartageListe";
import "./WaitlistForm.css";

const CODE_POSTAL_REGEX = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

// Pro (entreprises de déneigement) a sa propre entrée dans la liste, avec le
// nom de l'entreprise : la liste se segmente par rôle. Le bouton « Être averti
// pour Pro » de l'accueil présélectionne ce rôle (role / onRole contrôlés par
// Landing).
const ROLES = [
  ["client", "Client"],
  ["deneigeur", "Déneigeur de quartier"],
  ["pro", "Entreprise (Pro)"],
];

export default function WaitlistForm({ role: roleControle, onRole }) {
  const [roleLocal, setRoleLocal] = useState("client");
  const role = roleControle ?? roleLocal;
  const setRole = onRole ?? setRoleLocal;
  const pro = role === "pro";
  const [entreprise, setEntreprise] = useState("");
  const [courriel, setCourriel] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [siteWeb, setSiteWeb] = useState(""); // honeypot — reste vide pour un humain
  // null tant que pas inscrit ; ensuite { ville } (ville dérivée par le serveur, peut être absente).
  const [inscription, setInscription] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (!CODE_POSTAL_REGEX.test(codePostal.trim())) {
      setErreur("Code postal canadien invalide, format attendu : G1L 2M4.");
      return;
    }
    setErreur(null);
    setEnCours(true);
    try {
      const resultat = await rejoindreListeAttente({
        courriel: courriel.trim(),
        codePostal: codePostal.trim(),
        role,
        siteWeb,
        ...(pro ? { entreprise: entreprise.trim() } : {}),
      });
      setInscription({ ville: resultat.data?.ville ?? null });
    } catch {
      setErreur(
        pro
          ? "Quelque chose a bloqué. Vérifie le nom de l'entreprise, le courriel et le code postal, puis réessaie."
          : "Quelque chose a bloqué. Vérifie ton courriel et ton code postal, puis réessaie.",
      );
    } finally {
      setEnCours(false);
    }
  }

  if (inscription && pro) {
    return (
      <div className="waitlist-form waitlist-form--succes">
        <span className="waitlist-form__succes-titre">C'est noté, merci !</span>
        <span className="waitlist-form__succes-texte">
          Ton entreprise est sur la liste Snowro Pro. On t'écrit dès que les détails de l'offre sont prêts.
        </span>
      </div>
    );
  }

  if (inscription) {
    return (
      <div className="waitlist-form waitlist-form--succes">
        <span className="waitlist-form__succes-titre">C'est noté, merci !</span>
        <span className="waitlist-form__succes-texte">
          On t'écrit dès qu'on ouvre dans ton secteur. Pas de spam, promis : juste ça.
        </span>
        <PartageListe role={role} ville={inscription.ville} />
      </div>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={onSubmit}>
      <div className="waitlist-form__champ">
        <span className="eyebrow waitlist-form__eyebrow">Je m'inscris comme</span>
        <div className="waitlist-form__role" role="radiogroup" aria-label="Je m'inscris comme">
          {ROLES.map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              role="radio"
              aria-checked={role === cle}
              className={`waitlist-form__role-bouton ${role === cle ? "waitlist-form__role-bouton--actif" : ""}`}
              onClick={() => setRole(cle)}
            >
              {libelle}
            </button>
          ))}
        </div>
      </div>

      {pro && (
        <label className="waitlist-form__label">
          <span className="sr-only">Nom de l'entreprise</span>
          <input
            type="text"
            required
            minLength={2}
            maxLength={120}
            placeholder="Nom de l'entreprise"
            autoComplete="organization"
            value={entreprise}
            onChange={(e) => setEntreprise(e.target.value)}
            className="waitlist-form__input"
          />
        </label>
      )}

      <label className="waitlist-form__label">
        <span className="sr-only">Courriel</span>
        <input
          type="email"
          required
          placeholder="ton@courriel.com"
          value={courriel}
          onChange={(e) => setCourriel(e.target.value)}
          className="waitlist-form__input"
        />
      </label>

      <label className="waitlist-form__label">
        <span className="sr-only">{pro ? "Code postal de ton secteur principal" : "Code postal"}</span>
        <input
          type="text"
          required
          placeholder={pro ? "Code postal de ton secteur principal" : "Code postal (ex. G1L 2M4)"}
          value={codePostal}
          onChange={(e) => setCodePostal(e.target.value)}
          className="waitlist-form__input"
        />
      </label>

      {/* Honeypot anti-spam : masqué visuellement, un lecteur d'écran ne l'annonce
          pas (aria-hidden + tabIndex -1) — un bot qui remplit tous les champs le
          remplira, un humain ne le voit jamais. */}
      <label className="waitlist-form__honeypot" aria-hidden="true">
        Site web
        <input
          type="text"
          name="siteWeb"
          tabIndex={-1}
          autoComplete="off"
          value={siteWeb}
          onChange={(e) => setSiteWeb(e.target.value)}
        />
      </label>

      {erreur && <p className="message-erreur" role="alert">{erreur}</p>}

      <button type="submit" className="waitlist-form__bouton landing__bouton-neige landing__bouton-neige--f" disabled={enCours}>
        {enCours ? "Envoi…" : pro ? "Être averti pour Pro" : "Rejoindre la liste"}
      </button>
      <p className="waitlist-form__mention">
        {pro
          ? "On demande ton secteur pour te présenter les données de ta région en premier."
          : "On demande ton code postal juste pour savoir quelle ville ouvrir en premier."}{" "}
        Détails dans la{" "}
        <Link to="/confidentialite">politique de confidentialité</Link>.
      </p>
    </form>
  );
}
