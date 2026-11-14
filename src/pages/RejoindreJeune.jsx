import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { accepterInvitationJeune, lireInvitationJeune, resumeRegles } from "../lib/jeunes";
import { messageServeur } from "../lib/erreurs";
import VersionFooter from "../components/VersionFooter";
import "./AuthForm.css";

// /jeune/rejoindre?i=…&j=… : lien d'invitation envoyé par le parent.
const MESSAGES = {
  "invitation-invalide": "Ce lien ne fonctionne pas. Demande à ton parent de t'envoyer une nouvelle invitation.",
  "invitation-utilisee": "Cette invitation a déjà servi. Connecte-toi avec ton adresse.",
  "invitation-expiree": "Cette invitation a expiré. Demande à ton parent de t'en envoyer une nouvelle.",
};

export default function RejoindreJeune() {
  const [params] = useSearchParams();
  const i = params.get("i") ?? "";
  const j = params.get("j") ?? "";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [info, setInfo] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [motDePasse, setMotDePasse] = useState("");
  const [dejaCompte, setDejaCompte] = useState(false);
  const [consentement, setConsentement] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    lireInvitationJeune({ i, j })
      .then(setInfo)
      .catch((err) => setErreur(MESSAGES[messageServeur(err)] ?? messageServeur(err) ?? "Ce lien ne fonctionne pas."));
  }, [i, j]);

  async function rejoindre(e) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      if (!user || (user.email ?? "").toLowerCase() !== info.courriel) {
        if (dejaCompte) await signInWithEmailAndPassword(auth, info.courriel, motDePasse);
        else {
          const { user: nouveau } = await createUserWithEmailAndPassword(auth, info.courriel, motDePasse);
          await updateProfile(nouveau, { displayName: info.prenom });
        }
      }
      await accepterInvitationJeune({ i, j, consentement });
      await auth.currentUser?.reload();
      await auth.currentUser?.getIdToken(true);
      navigate("/tableau-de-bord", { replace: true });
    } catch (err) {
      setErreur(
        err.code === "auth/email-already-in-use"
          ? "Un compte existe déjà avec cette adresse : coche « J'ai déjà un compte »."
          : err.code === "auth/weak-password"
            ? "Le mot de passe doit contenir au moins 6 caractères."
            : err.code?.startsWith("auth/")
              ? "Courriel ou mot de passe incorrect."
              : (MESSAGES[messageServeur(err)] ?? messageServeur(err) ?? "Une erreur est survenue."),
      );
      setEnCours(false);
    }
  }

  return (
    <div className="auth-form__page">
      <form className="auth-form__carte" onSubmit={rejoindre}>
        <h1 className="auth-form__titre">{info ? `Bienvenue ${info.prenom}!` : "Jeune déneigeur"}</h1>
        {!info && !erreur && <p>Un instant…</p>}
        {!info && erreur && <p className="message-erreur" role="alert">{erreur}</p>}
        {info && (
          <>
            <p className="auth-form__aide">
              {info.prenomParent ?? "Ton parent"} t'invite à déneiger avec Snowro. Tu pourras accepter des demandes {resumeRegles(info.regles)}.
              {" "}{info.prenomParent ?? "Ton parent"} sera avisé à chaque demande, et les paiements arrivent dans son compte.
            </p>
            <label className="auth-form__champ">
              Courriel
              <input type="email" value={info.courriel} readOnly />
            </label>
            {!(user && (user.email ?? "").toLowerCase() === info.courriel) && (
              <>
                <label className="auth-form__champ">
                  {dejaCompte ? "Ton mot de passe" : "Choisis un mot de passe"}
                  <input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} minLength={6} required autoComplete={dejaCompte ? "current-password" : "new-password"} />
                </label>
                <label className="auth-form__case">
                  <input type="checkbox" checked={dejaCompte} onChange={(e) => setDejaCompte(e.target.checked)} />
                  J'ai déjà un compte Snowro avec cette adresse
                </label>
              </>
            )}
            <div className="auth-form__aide jeunes__securite">
              <strong>Tes règles de sécurité</strong>
              <ul>
                <li>Préviens toujours {info.prenomParent ?? "ton parent"} avant de partir.</li>
                <li>N'entre jamais dans la maison d'un client.</li>
                <li>Utilise une pelle ou un grattoir seulement : jamais de souffleuse.</li>
                <li>Prends en photo seulement l'endroit déneigé.</li>
                <li>Un malaise, un problème? Pars et utilise « Signaler un problème ».</li>
              </ul>
            </div>
            <label className="auth-form__case auth-form__case--haut">
              <input type="checkbox" checked={consentement} onChange={(e) => setConsentement(e.target.checked)} />
              <span>J'accepte ces règles et les conditions d'utilisation de Snowro.</span>
            </label>
            {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
            <button type="submit" className="auth-form__bouton" disabled={enCours || !consentement}>
              {enCours ? "Un instant…" : "Créer mon accès"}
            </button>
          </>
        )}
      </form>
      <Link to="/" className="auth-form__retour">
        ← Retour à l'accueil
      </Link>
      <VersionFooter className="auth-form__version" />
    </div>
  );
}
