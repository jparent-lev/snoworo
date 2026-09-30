import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { ChoixRoles } from "./tableau/elements";
import "./tableau/Tableau.css";
import VersionFooter from "../components/VersionFooter";
import "./AuthForm.css";

export default function Signup() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setErreur(null);
    if (!roles.length) {
      setErreur("Choisis au moins une façon d'utiliser Snowro.");
      return;
    }
    setEnCours(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) await updateProfile(user, { displayName });
      // merge : onUserCreate (Cloud Function) complète la fiche de son côté,
      // sans jamais toucher aux rôles (voir functions/src/onUserCreate.js).
      await setDoc(doc(db, "users", user.uid), { role: roles, displayName }, { merge: true });
      navigate("/tableau-de-bord");
    } catch (err) {
      setErreur(traduireErreur(err.code));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="auth-form__page">
      <form className="auth-form__carte" onSubmit={onSubmit}>
        <h1 className="auth-form__titre">Créer un compte</h1>
        <label className="auth-form__champ">
          Nom
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </label>
        <label className="auth-form__champ">
          Courriel
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="auth-form__champ">
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        <div className="auth-form__champ">
          Je veux…
          <ChoixRoles valeur={roles} onChange={setRoles} />
        </div>
        {erreur && <p className="auth-form__erreur">{erreur}</p>}
        <button type="submit" className="auth-form__bouton" disabled={enCours}>
          {enCours ? "Création…" : "Créer mon compte"}
        </button>
        <p className="auth-form__lien">
          Déjà un compte ? <Link to="/connexion">Se connecter</Link>
        </p>
      </form>
      <VersionFooter className="auth-form__version" />
    </div>
  );
}

function traduireErreur(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "Ce courriel est déjà associé à un compte.";
    case "auth/weak-password":
      return "Le mot de passe doit contenir au moins 6 caractères.";
    case "auth/invalid-email":
      return "Ce courriel n'est pas valide.";
    default:
      return "Une erreur est survenue. Réessaie.";
  }
}
