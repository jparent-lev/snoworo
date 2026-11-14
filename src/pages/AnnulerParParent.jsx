import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { annulerParParent } from "../lib/jeunes";
import { messageServeur } from "../lib/erreurs";
import "./AuthForm.css";

// /jeune/annuler?d=… : lien de l'avis envoyé au parent. Connexion exigée
// (RequireAuth) ; le serveur vérifie que la demande est celle de son jeune.
export default function AnnulerParParent() {
  const [params] = useSearchParams();
  const demandeId = params.get("d") ?? "";
  const [etat, setEtat] = useState(null); // null | "en_cours" | "fait" | message
  async function annuler() {
    setEtat("en_cours");
    try {
      await annulerParParent({ demandeId });
      setEtat("fait");
    } catch (err) {
      setEtat(messageServeur(err) || "Une erreur est survenue.");
    }
  }
  return (
    <div className="auth-form__page">
      <div className="auth-form__carte">
        <h1 className="auth-form__titre">{etat === "fait" ? "Demande annulée" : "Annuler la demande de votre jeune?"}</h1>
        {etat === "fait" ? (
          <p>C'est fait. Le client est remboursé et sa demande redevient visible pour les autres déneigeurs.</p>
        ) : (
          <>
            <p>Le client sera remboursé et sa demande redeviendra visible pour les autres déneigeurs. Possible tant que le travail n'est pas fait.</p>
            {etat && etat !== "en_cours" && <p className="message-erreur" role="alert">{etat}</p>}
            <button type="button" className="auth-form__bouton" onClick={annuler} disabled={etat === "en_cours"}>
              {etat === "en_cours" ? "Annulation…" : "Annuler la demande"}
            </button>
          </>
        )}
        <p className="auth-form__lien">
          <Link to="/tableau-de-bord">Retour au tableau de bord</Link>
        </p>
      </div>
    </div>
  );
}
