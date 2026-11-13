import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import VersionFooter from "../components/VersionFooter";
import { demanderLienCompte } from "../lib/liensCompte";
import { messageServeur } from "../lib/erreurs";
import "./AuthForm.css";

// /mot-de-passe-oublie : envoie un lien pour choisir un nouveau mot de passe.
export default function MotDePasseOublie() {
  const [email, setEmail] = useState(useLocation().state?.courriel ?? "");
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await demanderLienCompte(email.trim(), "reinitialisation");
      setEnvoye(true);
    } catch (err) {
      setErreur(messageServeur(err) || "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="auth-form__page">
      <form className="auth-form__carte" onSubmit={onSubmit}>
        <h1 className="auth-form__titre">Mot de passe oublié</h1>
        {envoye ? (
          <p role="status">
            Si un compte Snowro existe pour <strong>{email.trim()}</strong>, un lien pour choisir un nouveau mot de passe vient de
            partir. Il est valide une heure. Pensez à regarder dans les courriels indésirables.
          </p>
        ) : (
          <>
            <p className="auth-form__aide">Entrez l'adresse de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
            <label className="auth-form__champ">
              Courriel
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
            <button type="submit" className="auth-form__bouton" disabled={enCours}>
              {enCours ? "Envoi…" : "Recevoir le lien"}
            </button>
          </>
        )}
        <p className="auth-form__lien">
          <Link to="/connexion">Retour à la connexion</Link>
        </p>
      </form>
      <Link to="/" className="auth-form__retour">
        ← Retour à l'accueil
      </Link>
      <VersionFooter className="auth-form__version" />
    </div>
  );
}
