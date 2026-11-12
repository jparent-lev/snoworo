import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { choixMesure, demarrerMesure, enregistrerChoix, mesurer, pageVue, surChangementChoix } from "../lib/mesure";
import "./BandeauMesure.css";

// Bandeau de consentement à la mesure d'audience (Loi 25) : « Accepter » et
// « Refuser » ont le même poids, rien n'est chargé avant le choix. Rouvert
// par le lien « Témoins » (ouvrirPreferencesMesure). Compte aussi les pages
// vues (application d'une seule page : une vue à chaque changement d'adresse).
export default function BandeauMesure() {
  const [ouvert, setOuvert] = useState(() => choixMesure() === "a-demander");
  const { pathname } = useLocation();

  useEffect(() => {
    demarrerMesure();
    // Appels à l'action marqués data-mesure="emplacement" : un seul écouteur.
    const clic = (e) => {
      const el = e.target.closest?.("[data-mesure]");
      if (el) mesurer("cta_clic", { emplacement: el.dataset.mesure, destination: el.getAttribute("href") || "" });
    };
    document.addEventListener("click", clic, true);
    const fin = surChangementChoix((c) => setOuvert(c === "ouvrir"));
    return () => {
      document.removeEventListener("click", clic, true);
      fin();
    };
  }, []);

  useEffect(() => {
    pageVue();
  }, [pathname]);

  if (!ouvert || choixMesure() === "inactif") return null;
  const choisir = (c) => {
    enregistrerChoix(c);
    setOuvert(false);
  };
  return (
    <section className="bandeau-mesure" role="region" aria-label="Mesure d'audience">
      <p>
        <strong>Nous aider à améliorer Snowro ?</strong> Avec votre accord, nous mesurons de façon agrégée
        l'utilisation du site avec Google Analytics (pages vues, étapes franchies). Aucune publicité, aucun nom ni
        adresse. <Link to="/confidentialite#temoins">En savoir plus</Link>
      </p>
      <div className="bandeau-mesure__boutons">
        <button type="button" className="bandeau-mesure__bouton" onClick={() => choisir("refuse")}>
          Refuser
        </button>
        <button type="button" className="bandeau-mesure__bouton" onClick={() => choisir("accepte")}>
          Accepter
        </button>
      </div>
    </section>
  );
}
