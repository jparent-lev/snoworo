import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { confirmPasswordReset, signInWithEmailAndPassword, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../lib/firebase";
import VersionFooter from "../components/VersionFooter";
import "./AuthForm.css";

// /mot-de-passe?code=… : lien du courriel « mot de passe oublié ». Après le
// changement, la personne est connectée directement.
export default function NouveauMotDePasse() {
  const [params] = useSearchParams();
  const code = params.get("code") ?? "";
  const navigate = useNavigate();
  const [courriel, setCourriel] = useState(null);
  const [etat, setEtat] = useState(code ? "verif" : "invalide"); // verif | pret | invalide | expire
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!code) return;
    verifyPasswordResetCode(auth, code)
      .then((c) => {
        setCourriel(c);
        setEtat("pret");
      })
      .catch((err) => setEtat(err.code === "auth/expired-action-code" ? "expire" : "invalide"));
  }, [code]);

  async function onSubmit(e) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await confirmPasswordReset(auth, code, motDePasse);
      await signInWithEmailAndPassword(auth, courriel, motDePasse);
      navigate("/tableau-de-bord", { replace: true });
    } catch (err) {
      setErreur(
        err.code === "auth/weak-password"
          ? "Le mot de passe doit contenir au moins 6 caractères."
          : err.code === "auth/expired-action-code" || err.code === "auth/invalid-action-code"
            ? "Ce lien n'est plus valide. Demandez-en un nouveau."
            : "Une erreur est survenue. Veuillez réessayer.",
      );
      setEnCours(false);
    }
  }

  return (
    <div className="auth-form__page">
      <form className="auth-form__carte" onSubmit={onSubmit}>
        <h1 className="auth-form__titre">
          {etat === "expire" ? "Ce lien a expiré" : etat === "invalide" ? "Ce lien ne fonctionne pas" : "Nouveau mot de passe"}
        </h1>
        {etat === "verif" && <p>Un instant…</p>}
        {(etat === "expire" || etat === "invalide") && (
          <>
            <p>
              {etat === "expire" ? "Le lien est valide une heure. " : "Le lien est incomplet, a déjà servi ou a été remplacé par un plus récent. "}
              Demandez-en un nouveau.
            </p>
            <Link className="auth-form__bouton" to="/mot-de-passe-oublie">
              Recevoir un nouveau lien
            </Link>
          </>
        )}
        {etat === "pret" && (
          <>
            <p className="auth-form__aide">Compte : {courriel}</p>
            <label className="auth-form__champ">
              Nouveau mot de passe
              <input
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <span className="auth-form__aide">Au moins 6 caractères.</span>
            </label>
            {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
            <button type="submit" className="auth-form__bouton" disabled={enCours}>
              {enCours ? "Enregistrement…" : "Enregistrer et me connecter"}
            </button>
          </>
        )}
      </form>
      <VersionFooter className="auth-form__version" />
    </div>
  );
}
