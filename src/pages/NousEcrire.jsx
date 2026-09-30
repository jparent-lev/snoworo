import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageLegale from "../components/PageLegale";
import { envoyerMessageContact } from "../lib/contact";
import "./NousEcrire.css";

// Doit rester aligné sur SUJETS dans functions/src/contact.js.
const SUJETS = [
  { valeur: "question", libelle: "Une question sur Snowro" },
  { valeur: "deneigeur", libelle: "Devenir déneigeur de quartier" },
  { valeur: "pro", libelle: "Snowro Pro (entreprises de déneigement)" },
  { valeur: "renseignements", libelle: "Mes renseignements personnels" },
  { valeur: "autre", libelle: "Autre chose" },
];
const LONGUEUR_MAX_MESSAGE = 5000;

export default function NousEcrire() {
  // ?sujet=renseignements (lien de la politique de confidentialité) présélectionne le sujet.
  const [parametres] = useSearchParams();
  const sujetDemande = parametres.get("sujet");
  const [nom, setNom] = useState("");
  const [courriel, setCourriel] = useState("");
  const [sujet, setSujet] = useState(SUJETS.some((s) => s.valeur === sujetDemande) ? sujetDemande : "question");
  const [message, setMessage] = useState("");
  const [siteWeb, setSiteWeb] = useState(""); // honeypot — reste vide pour un humain
  const [envoye, setEnvoye] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await envoyerMessageContact({
        nom: nom.trim() || null,
        courriel: courriel.trim(),
        sujet,
        message: message.trim(),
        siteWeb,
      });
      setEnvoye(true);
    } catch {
      setErreur("Ton message n'est pas parti. Vérifie ton courriel et réessaie dans quelques minutes.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <PageLegale surtitre="Contact" titre="Nous écrire">
      <p>
        Une question, une idée, un problème avec une job ? Écris-nous : on répond habituellement en un ou deux
        jours ouvrables.
      </p>

      {envoye ? (
        <div className="nous-ecrire nous-ecrire--succes" role="status">
          <span className="nous-ecrire__succes-titre">Message reçu, merci !</span>
          <span className="nous-ecrire__succes-texte">On te répond à {courriel.trim()} dès qu'on peut.</span>
        </div>
      ) : (
        <form className="nous-ecrire" onSubmit={onSubmit}>
          <label className="nous-ecrire__champ">
            <span className="eyebrow nous-ecrire__libelle">Ton nom (optionnel)</span>
            <input
              type="text"
              autoComplete="name"
              maxLength={120}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="nous-ecrire__input"
            />
          </label>

          <label className="nous-ecrire__champ">
            <span className="eyebrow nous-ecrire__libelle">Ton courriel</span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="ton@courriel.com"
              value={courriel}
              onChange={(e) => setCourriel(e.target.value)}
              className="nous-ecrire__input"
            />
          </label>

          <label className="nous-ecrire__champ">
            <span className="eyebrow nous-ecrire__libelle">Sujet</span>
            <select value={sujet} onChange={(e) => setSujet(e.target.value)} className="nous-ecrire__input">
              {SUJETS.map((s) => (
                <option key={s.valeur} value={s.valeur}>
                  {s.libelle}
                </option>
              ))}
            </select>
          </label>

          <label className="nous-ecrire__champ">
            <span className="eyebrow nous-ecrire__libelle">Ton message</span>
            <textarea
              required
              rows={6}
              maxLength={LONGUEUR_MAX_MESSAGE}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="nous-ecrire__input nous-ecrire__textarea"
            />
          </label>

          {/* Honeypot anti-spam, même technique que WaitlistForm. */}
          <label className="nous-ecrire__honeypot" aria-hidden="true">
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

          {erreur && <p className="nous-ecrire__erreur">{erreur}</p>}

          <button type="submit" className="nous-ecrire__bouton" disabled={enCours || !message.trim()}>
            {enCours ? "Envoi…" : "Envoyer"}
          </button>
          <p className="nous-ecrire__mention">
            On utilise ton courriel seulement pour te répondre. Voir notre{" "}
            <Link to="/confidentialite">politique de confidentialité</Link>.
          </p>
        </form>
      )}
    </PageLegale>
  );
}
