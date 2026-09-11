import { useState } from "react";
import { rejoindreListeAttente } from "../../lib/listeAttente";
import "./WaitlistForm.css";

const CODE_POSTAL_REGEX = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

export default function WaitlistForm() {
  const [role, setRole] = useState("client");
  const [courriel, setCourriel] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [siteWeb, setSiteWeb] = useState(""); // honeypot — reste vide pour un humain
  const [inscrit, setInscrit] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (!CODE_POSTAL_REGEX.test(codePostal.trim())) {
      setErreur("Code postal canadien invalide — format attendu : G1L 2M4.");
      return;
    }
    setErreur(null);
    setEnCours(true);
    try {
      await rejoindreListeAttente({ courriel: courriel.trim(), codePostal: codePostal.trim(), role, siteWeb });
      setInscrit(true);
    } catch {
      setErreur("Quelque chose a bloqué — vérifie ton courriel et ton code postal, puis réessaie.");
    } finally {
      setEnCours(false);
    }
  }

  if (inscrit) {
    return (
      <div className="waitlist-form waitlist-form--succes">
        <span className="waitlist-form__succes-titre">C'est noté, merci !</span>
        <span className="waitlist-form__succes-texte">
          On t'écrit dès qu'on ouvre dans ton secteur. Pas de spam, promis — juste ça.
        </span>
      </div>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={onSubmit}>
      <div className="waitlist-form__champ">
        <span className="eyebrow waitlist-form__eyebrow">Je m'inscris comme</span>
        <div className="waitlist-form__role" role="radiogroup" aria-label="Je m'inscris comme">
          <button
            type="button"
            role="radio"
            aria-checked={role === "client"}
            className={`waitlist-form__role-bouton ${role === "client" ? "waitlist-form__role-bouton--actif" : ""}`}
            onClick={() => setRole("client")}
          >
            Client
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={role === "deneigeur"}
            className={`waitlist-form__role-bouton ${role === "deneigeur" ? "waitlist-form__role-bouton--actif" : ""}`}
            onClick={() => setRole("deneigeur")}
          >
            Déneigeur citoyen
          </button>
        </div>
      </div>

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
        <span className="sr-only">Code postal</span>
        <input
          type="text"
          required
          placeholder="Code postal — G1L 2M4"
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

      {erreur && <p className="waitlist-form__erreur">{erreur}</p>}

      <button type="submit" className="waitlist-form__bouton landing__bouton-neige landing__bouton-neige--f" disabled={enCours}>
        {enCours ? "Envoi…" : "Rejoindre la liste"}
      </button>
      <p className="waitlist-form__mention">
        On demande ton code postal juste pour savoir quelle ville ouvrir en premier.
      </p>
    </form>
  );
}
