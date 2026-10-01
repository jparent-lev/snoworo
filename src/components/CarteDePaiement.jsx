import { useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { chargerStripe, enregistrerCarte, preparerCarte } from "../lib/paiements";
import { messageErreur } from "../lib/cycleDemande";
import "./CarteDePaiement.css";

// Champ de carte de Stripe (Payment Element) : le numéro de carte ne passe
// jamais par Snowro. Enregistre la carte pour des prélèvements futurs
// (SetupIntent), puis appelle onEnregistree({ marque, derniers4 }).
const APPARENCE = {
  theme: "stripe",
  variables: {
    colorPrimary: "#C1652F",
    colorBackground: "#FAF5EA",
    colorText: "#3B2A1F",
    colorDanger: "#9E2B1F",
    fontFamily: "Karla, system-ui, sans-serif",
    borderRadius: "10px",
  },
};
const POLICES = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Karla:wght@400;500;700&display=swap" }];

export default function CarteDePaiement({ onEnregistree, libelle = "Enregistrer la carte" }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let actif = true;
    preparerCarte()
      .then((r) => actif && setClientSecret(r.clientSecret))
      .catch((err) => actif && setErreur(messageErreur(err)));
    return () => {
      actif = false;
    };
  }, []);

  if (erreur) return <p className="carte-paiement__erreur">{erreur}</p>;
  if (!clientSecret) return <p className="carte-paiement__aide">Chargement du formulaire sécurisé…</p>;
  return (
    <Elements stripe={chargerStripe()} options={{ clientSecret, appearance: APPARENCE, fonts: POLICES, locale: "fr-CA" }}>
      <Formulaire onEnregistree={onEnregistree} libelle={libelle} />
    </Elements>
  );
}

function Formulaire({ onEnregistree, libelle }) {
  const stripe = useStripe();
  const elements = useElements();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  // Pas de <form> : ce composant vit parfois dans un autre formulaire
  // (Publier une demande).
  async function enregistrer() {
    if (!stripe || !elements) return;
    setEnCours(true);
    setErreur(null);
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: window.location.href },
    });
    if (error) {
      setErreur(error.message);
      setEnCours(false);
      return;
    }
    try {
      const { carte } = await enregistrerCarte({ setupIntentId: setupIntent.id });
      onEnregistree(carte);
    } catch (err) {
      setErreur(messageErreur(err));
      setEnCours(false);
    }
  }

  return (
    <div className="carte-paiement">
      <PaymentElement options={{ layout: "tabs" }} />
      {erreur && <p className="carte-paiement__erreur">{erreur}</p>}
      <button type="button" className="btn btn--ardoise" disabled={!stripe || enCours} onClick={enregistrer}>
        {enCours ? "Vérification…" : libelle}
      </button>
      <p className="carte-paiement__aide">🔒 Carte gérée par Stripe. Snowro ne voit jamais ton numéro de carte.</p>
    </div>
  );
}
