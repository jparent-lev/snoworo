import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageLegale from "../components/PageLegale";
import { useAuth } from "../context/AuthContext";
import { confirmerCourriel } from "../lib/courriel";

// Page du lien de confirmation du courriel du compte
// (/courriel/confirmer?code=…, envoyé par envoyerConfirmationCourriel).
// Fonctionne aussi sans être connecté sur cet appareil.
export default function ConfirmerCourriel() {
  const [params] = useSearchParams();
  const code = params.get("code") ?? "";
  const { user, signalerChangementCompte } = useAuth();
  const [etat, setEtat] = useState(code ? "en_cours" : "invalide");

  useEffect(() => {
    if (!code) return;
    let annule = false;
    confirmerCourriel(code)
      .then(() => {
        if (annule) return;
        setEtat("confirme");
        signalerChangementCompte();
      })
      .catch((err) => !annule && setEtat(err.code === "auth/expired-action-code" ? "expire" : "invalide"));
    return () => {
      annule = true;
    };
    // signalerChangementCompte change à chaque rendu : le code suffit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (etat === "en_cours") {
    return (
      <PageLegale surtitre="Votre compte" titre="Confirmation en cours">
        <p>Un instant…</p>
      </PageLegale>
    );
  }
  if (etat === "confirme") {
    return (
      <PageLegale surtitre="Votre compte" titre="Adresse confirmée">
        <p>Merci, votre adresse courriel est confirmée. Vous pouvez maintenant publier ou accepter des demandes.</p>
        <p>
          <Link to={user ? "/tableau-de-bord" : "/connexion"}>{user ? "Aller au tableau de bord" : "Se connecter"}</Link>
        </p>
      </PageLegale>
    );
  }
  return (
    <PageLegale surtitre="Votre compte" titre={etat === "expire" ? "Ce lien a expiré" : "Ce lien ne fonctionne pas"}>
      <p>
        {etat === "expire" ? "Le lien de confirmation est valide 3 jours. " : "Le lien est incomplet, a déjà servi ou a été remplacé par un plus récent. "}
        Si votre adresse n'est pas encore confirmée, connectez-vous : le bandeau en haut du tableau de bord permet d'en recevoir un
        nouveau.
      </p>
      <p>
        <Link to={user ? "/tableau-de-bord" : "/connexion"}>{user ? "Aller au tableau de bord" : "Se connecter"}</Link>
      </p>
    </PageLegale>
  );
}
