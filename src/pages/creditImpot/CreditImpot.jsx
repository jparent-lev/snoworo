import { useEffect } from "react";
import { Link } from "react-router-dom";
import SnowroSymbol from "../../components/brand/SnowroSymbol";
import PiedDePage from "../../components/PiedDePage";
import { BancDeNeige, ChuteDeNeige } from "../landing/Decors";
import { META } from "./contenu";
import HeroCalculateur from "./HeroCalculateur";
import {
  AdmissibiliteBref,
  AvisCredit,
  BlocAidants,
  ComparaisonOptions,
  CtaFinal,
  EtapesCredit,
  FaqCredit,
} from "./sections";
import "../Landing.css";
import "./CreditImpot.css";

// Page d'atterrissage du crédit d'impôt pour maintien à domicile des aînés
// (/credit-impot), pour les 70 ans et plus et leurs proches aidants. Contenu
// et fonctionnement : snowro-credit-impot.html v1.0 ; design : celui de
// l'accueil (Landing.css, Decors). Les chiffres fiscaux viennent de
// src/config/creditImpot.js. Le titre, la description, l'aperçu de partage
// et le balisage FAQPage sont aussi écrits dans une copie statique
// (dist/credit-impot.html, vite.config.js) pour les robots qui n'exécutent
// pas JavaScript.
function useMeta() {
  useEffect(() => {
    const titrePrecedent = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const descriptionPrecedente = meta?.getAttribute("content");
    document.title = META.titre;
    meta?.setAttribute("content", META.description);
    window.scrollTo(0, 0);
    return () => {
      document.title = titrePrecedent;
      if (meta && descriptionPrecedente) meta.setAttribute("content", descriptionPrecedente);
    };
  }, []);
}

export default function CreditImpot() {
  useMeta();
  return (
    <div className="landing credit-impot">
      <a className="ci-evitement" href="#ci-contenu">
        Aller au contenu
      </a>
      <header className="landing__entete">
        <div className="ci-entete">
          <Link to="/" className="landing__logo" aria-label="Snowro, accueil">
            <SnowroSymbol variant="x" neige surTuile size={44} />
            <span className="landing__logo-texte">snowro</span>
          </Link>
          <nav className="ci-nav" aria-label="Navigation de la page">
            <a href="#comment">Comment ça marche</a>
            <a href="#faq">Questions</a>
            <a href="#calculateur" className="landing__bouton-fantome ci-nav__calcul">
              Calculer<span className="ci-nav__suite"> mon remboursement</span>
            </a>
          </nav>
        </div>
      </header>
      <main id="ci-contenu">
        <div className="landing__hero-bande">
          <ChuteDeNeige className="decor-chute--ciel" />
          <HeroCalculateur />
          <BancDeNeige />
        </div>
        <EtapesCredit />
        <ComparaisonOptions />
        <BlocAidants />
        <AdmissibiliteBref />
        <FaqCredit />
        <CtaFinal />
        <AvisCredit />
      </main>
      <PiedDePage />
    </div>
  );
}
