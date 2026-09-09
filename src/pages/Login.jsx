import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { auth } from "../lib/firebase";
import "./AuthForm.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/demandes");
    } catch {
      setErreur("Courriel ou mot de passe incorrect.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="auth-form__page">
      <form className="auth-form__carte" onSubmit={onSubmit}>
        <h1 className="auth-form__titre">Se connecter</h1>
        <label className="auth-form__champ">
          Courriel
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="auth-form__champ">
          Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {erreur && <p className="auth-form__erreur">{erreur}</p>}
        <button type="submit" className="auth-form__bouton" disabled={enCours}>
          {enCours ? "Connexion…" : "Se connecter"}
        </button>
        <p className="auth-form__lien">
          Pas de compte ? <Link to="/inscription">Créer un compte</Link>
        </p>
      </form>
    </div>
  );
}
