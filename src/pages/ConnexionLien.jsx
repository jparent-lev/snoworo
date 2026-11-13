import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { auth } from "../lib/firebase";
import VersionFooter from "../components/VersionFooter";
import { lireCourrielLien, oublierCourrielLien } from "../lib/liensCompte";
import { mesurer } from "../lib/mesure";
import "./AuthForm.css";

// /connexion/lien?mode=signIn&oobCode=… : lien de connexion reçu par
// courriel. Sur l'appareil qui l'a demandé, l'adresse est déjà connue ;
// ailleurs, on la redemande (exigence de Firebase, contre le vol du lien).
export default function ConnexionLien() {
  const navigate = useNavigate();
  const [lien] = useState(() => window.location.href);
  const valide = isSignInWithEmailLink(auth, lien);
  const [courriel, setCourriel] = useState(lireCourrielLien);
  const [demander, setDemander] = useState(!lireCourrielLien());
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  async function connecter(adresse) {
    setErreur(null);
    setEnCours(true);
    try {
      await signInWithEmailLink(auth, adresse.trim(), lien);
      oublierCourrielLien();
      mesurer("login", { method: "lien" });
      navigate("/tableau-de-bord", { replace: true });
    } catch (err) {
      setEnCours(false);
      setDemander(true);
      setErreur(
        err.code === "auth/invalid-email"
          ? "Cette adresse ne correspond pas au lien. Entrez celle à laquelle le lien a été envoyé."
          : "Ce lien n'est plus valide : il a déjà servi ou il a expiré. Demandez-en un nouveau.",
      );
    }
  }

  useEffect(() => {
    const retenue = lireCourrielLien();
    if (valide && retenue) connecter(retenue);
    // Une seule tentative automatique, au chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth-form__page">
      <form
        className="auth-form__carte"
        onSubmit={(e) => {
          e.preventDefault();
          connecter(courriel);
        }}
      >
        <h1 className="auth-form__titre">{valide ? "Connexion par lien" : "Ce lien ne fonctionne pas"}</h1>
        {!valide && <p>Le lien est incomplet. Demandez-en un nouveau depuis la page de connexion.</p>}
        {valide && !demander && <p>Connexion en cours…</p>}
        {valide && demander && (
          <>
            <p className="auth-form__aide">Pour terminer, confirmez l'adresse courriel à laquelle le lien a été envoyé.</p>
            <label className="auth-form__champ">
              Courriel
              <input type="email" value={courriel} onChange={(e) => setCourriel(e.target.value)} required autoComplete="email" />
            </label>
            {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
            <button type="submit" className="auth-form__bouton" disabled={enCours}>
              {enCours ? "Connexion…" : "Me connecter"}
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
