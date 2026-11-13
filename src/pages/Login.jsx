import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { auth } from "../lib/firebase";
import VersionFooter from "../components/VersionFooter";
import "./AuthForm.css";
import { mesurer } from "../lib/mesure";
import { demanderLienCompte, retenirCourrielLien } from "../lib/liensCompte";
import { messageServeur } from "../lib/erreurs";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [lienEnvoye, setLienEnvoye] = useState(null);
  const [lienEnCours, setLienEnCours] = useState(false);
  const navigate = useNavigate();
  const depuis = useLocation().state?.depuis;
  // Seulement un chemin interne : jamais de redirection vers un autre site.
  const destination = typeof depuis === "string" && depuis.startsWith("/") && !depuis.startsWith("//") ? depuis : "/tableau-de-bord";

  async function onSubmit(e) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      mesurer("login", { method: "courriel" });
      navigate(destination, { replace: true });
    } catch {
      setErreur("Courriel ou mot de passe incorrect.");
    } finally {
      setEnCours(false);
    }
  }

  // Lien de connexion par courriel, sans mot de passe.
  async function envoyerLien() {
    setErreur(null);
    const adresse = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse)) {
      setErreur("Entrez d'abord votre courriel ci-dessus.");
      return;
    }
    setLienEnCours(true);
    try {
      await demanderLienCompte(adresse, "connexion");
      retenirCourrielLien(adresse);
      setLienEnvoye(adresse);
    } catch (err) {
      setErreur(messageServeur(err) || "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLienEnCours(false);
    }
  }

  return (
    <div className="auth-form__page">
      <form className="auth-form__carte" onSubmit={onSubmit}>
        <h1 className="auth-form__titre">Se connecter</h1>
        <label className="auth-form__champ">
          Courriel
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="auth-form__champ">
          Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        <p className="auth-form__lien auth-form__lien--droite">
          <Link to="/mot-de-passe-oublie" state={{ courriel: email.trim() }}>
            Mot de passe oublié?
          </Link>
        </p>
        {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
        <button type="submit" className="auth-form__bouton" disabled={enCours}>
          {enCours ? "Connexion…" : "Se connecter"}
        </button>
        <div className="auth-form__separateur">
          <span>ou</span>
        </div>
        {lienEnvoye ? (
          <p role="status" className="auth-form__aide">
            Si un compte existe pour <strong>{lienEnvoye}</strong>, un lien de connexion vient de partir. Ouvrez-le sur cet
            appareil pour être connecté directement.
          </p>
        ) : (
          <button type="button" className="btn btn--fantome auth-form__bouton-secondaire" onClick={envoyerLien} disabled={lienEnCours}>
            {lienEnCours ? "Envoi…" : "Recevoir un lien de connexion par courriel"}
          </button>
        )}
        <p className="auth-form__lien">
          Pas de compte ? <Link to="/inscription">Créer un compte</Link>
        </p>
      </form>
      <Link to="/" className="auth-form__retour">
        ← Retour à l'accueil
      </Link>
      <VersionFooter className="auth-form__version" />
    </div>
  );
}
