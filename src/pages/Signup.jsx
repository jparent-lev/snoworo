import { useEffect, useRef, useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import VersionFooter from "../components/VersionFooter";
import "./AuthForm.css";
import { mesurer } from "../lib/mesure";
import { envoyerConfirmationCourriel } from "../lib/courriel";
import { JEUNES_PILOTE } from "../lib/jeunes";

const DELAI_MINIMAL_MS = 2500;

export default function Signup() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);
  // Anti-robot : un champ invisible qu'un humain laisse vide, et un délai
  // minimal entre l'affichage du formulaire et l'envoi (un humain met
  // plusieurs secondes à remplir nom, courriel et mot de passe).
  const [siteWeb, setSiteWeb] = useState("");
  const afficheA = useRef(0);
  useEffect(() => {
    afficheA.current = Date.now();
  }, []);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setErreur(null);
    if (siteWeb || Date.now() - afficheA.current < DELAI_MINIMAL_MS) {
      // Robot probable : aucun compte créé, aucune piste donnée.
      navigate("/");
      return;
    }
    setEnCours(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) await updateProfile(user, { displayName });
      // Inscription simple : le choix Client / Déneigeur (ou les deux) se fait
      // à la première visite du tableau de bord (PremierChoix, TableauDeBord).
      // merge : onUserCreate (Cloud Function) complète la fiche de son côté,
      // sans jamais toucher aux rôles (voir functions/src/onUserCreate.js).
      await setDoc(doc(db, "users", user.uid), { displayName }, { merge: true });
      mesurer("sign_up", { method: "courriel" });
      // Lien de confirmation du courriel : un échec n'empêche pas l'inscription
      // (le bandeau du tableau de bord permet de le renvoyer).
      envoyerConfirmationCourriel().catch(() => {});
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
        {/* Champ piège : invisible, seul un robot le remplit. */}
        <label className="auth-form__piege" aria-hidden="true">
          Site web
          <input type="text" name="siteWeb" tabIndex={-1} autoComplete="off" value={siteWeb} onChange={(e) => setSiteWeb(e.target.value)} />
        </label>
        {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
        <p className="auth-form__mention">
          En créant un compte, vous confirmez avoir 18 ans ou plus et acceptez les{" "}
          <Link to="/conditions">conditions d'utilisation</Link>. Nous traitons vos renseignements selon notre{" "}
          <Link to="/confidentialite">politique de confidentialité</Link>.
          {JEUNES_PILOTE && " Les jeunes de 14 à 17 ans ne s'inscrivent pas ici : un parent les invite depuis son compte."}
        </p>
        <button type="submit" className="auth-form__bouton" disabled={enCours}>
          {enCours ? "Création…" : "Créer mon compte"}
        </button>
        <p className="auth-form__lien">
          Déjà un compte ? <Link to="/connexion">Se connecter</Link>
        </p>
      </form>
      <Link to="/" className="auth-form__retour">
        ← Retour à l'accueil
      </Link>
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
      return "Une erreur est survenue. Veuillez réessayer.";
  }
}
