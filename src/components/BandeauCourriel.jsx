import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { envoyerConfirmationCourriel, rafraichirCompte } from "../lib/courriel";
import { messageServeur } from "../lib/erreurs";
import "./BandeauCourriel.css";

// Rappel tant que le courriel du compte n'est pas confirmé : il faut l'être
// pour publier ou accepter une demande (exigé par le serveur).
export default function BandeauCourriel() {
  const { user, profile, courrielConfirme, signalerChangementCompte } = useAuth();
  const [etat, setEtat] = useState(null); // null | "envoi" | "envoye" | "verif" | message d'erreur
  if (!user || courrielConfirme) return null;

  async function renvoyer() {
    setEtat("envoi");
    try {
      const r = await envoyerConfirmationCourriel();
      if (r?.dejaConfirme) {
        await rafraichirCompte();
        signalerChangementCompte();
      } else setEtat("envoye");
    } catch (err) {
      setEtat(messageServeur(err) || "Le lien n'a pas pu partir. Réessayez dans un moment.");
    }
  }

  async function jaiConfirme() {
    setEtat("verif");
    try {
      if (await rafraichirCompte()) signalerChangementCompte();
      else setEtat("Votre adresse n'est pas encore confirmée. Cliquez sur le lien du courriel, puis réessayez.");
    } catch {
      setEtat("Impossible de vérifier pour l'instant. Réessayez dans un moment.");
    }
  }

  // Comptes créés avant la confirmation : aucun lien n'est encore parti.
  const dejaEnvoye = Boolean(profile?.confirmationCourriel?.envoyeAt) || etat === "envoye";
  const erreur = etat && !["envoi", "envoye", "verif"].includes(etat) ? etat : null;
  return (
    <div className="bandeau-courriel" role="status">
      <p>
        <strong>Confirmez votre adresse courriel.</strong>{" "}
        {dejaEnvoye ? `Nous avons envoyé un lien à ${user.email}.` : `Recevez un lien à ${user.email} pour la confirmer.`} C'est
        nécessaire pour publier ou accepter une demande.
      </p>
      <div className="bandeau-courriel__actions">
        <button type="button" className="btn btn--fantome" onClick={renvoyer} disabled={etat === "envoi"}>
          {etat === "envoi" ? "Envoi…" : etat === "envoye" ? "Lien envoyé" : dejaEnvoye ? "Renvoyer le lien" : "Envoyer le lien"}
        </button>
        <button type="button" className="btn btn--lien" onClick={jaiConfirme} disabled={etat === "verif"}>
          J'ai confirmé
        </button>
      </div>
      {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
    </div>
  );
}
