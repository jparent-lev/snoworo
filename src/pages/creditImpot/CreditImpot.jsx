import { useEffect } from "react";
import { Link } from "react-router-dom";
import SnowroSymbol from "../../components/brand/SnowroSymbol";
import { META } from "./contenu";
import HeroCalculateur from "./HeroCalculateur";
import {
  AdmissibiliteBref,
  BlocAidants,
  ComparaisonOptions,
  CtaFinal,
  EtapesCredit,
  FaqCredit,
  PiedCredit,
} from "./sections";
import "./CreditImpot.css";

// Page d'atterrissage du crédit d'impôt pour maintien à domicile des aînés
// (/credit-impot), pour les 70 ans et plus et leurs proches aidants.
// Référence : snowro-credit-impot.html v1.0. Les chiffres fiscaux viennent de
// src/config/creditImpot.js. Le titre, la description, l'aperçu de partage
// et le balisage FAQPage sont aussi écrits dans une copie statique
// (dist/credit-impot.html, vite.config.js) pour les robots qui
// n'exécutent pas JavaScript.
function useMeta() {
  useEffect(() => {
    const titrePrecedent = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const descriptionPrecedente = meta?.getAttribute("content");
    document.title = META.titre;
    meta?.setAttribute("content", META.description);
    return () => {
      document.title = titrePrecedent;
      if (meta && descriptionPrecedente) meta.setAttribute("content", descriptionPrecedente);
    };
  }, []);
}

export default function CreditImpot() {
  useMeta();
  return (
    <div className="credit-impot">
      <a className="ci-evitement" href="#ci-contenu">
        Aller au contenu
      </a>
      <div className="ci-contenant">
        <header className="ci-entete">
          <Link className="ci-logo" to="/" aria-label="Snowro, accueil">
            <SnowroSymbol size={30} />
            <span>snowro</span>
          </Link>
          <nav className="ci-nav" aria-label="Navigation de la page">
            <a href="#comment">Comment ça marche</a>
            <a href="#faq">Questions</a>
            <a href="#calculateur">Calculer mon remboursement</a>
          </nav>
        </header>
      </div>
      <main id="ci-contenu">
        <HeroCalculateur />
        <EtapesCredit />
        <ComparaisonOptions />
        <BlocAidants />
        <AdmissibiliteBref />
        <FaqCredit />
        <CtaFinal />
      </main>
      <PiedCredit />
    </div>
  );
}
