import { Link } from "react-router-dom";
import SnowroSymbol from "./brand/SnowroSymbol";
import VersionFooter from "./VersionFooter";
import { SilhouetteToits } from "../pages/landing/Decors";
import "./PiedDePage.css";

// Pied de page du site vitrine, partagé entre l'accueil et les pages légales.
// Les liens vers les sections de l'accueil passent par "/#…" pour marcher
// aussi depuis une autre page (Landing fait défiler jusqu'à l'ancre au
// chargement).
export default function PiedDePage() {
  return (
    <footer className="pied">
      <SilhouetteToits />
      <div className="pied__colonnes">
        <div className="pied__colonne">
          <div className="pied__logo">
            <SnowroSymbol variant="reversed" neige size={32} />
            <span className="pied__logo-texte">snowro</span>
          </div>
          <span className="pied__slogan">Déneigement à la demande, fait à Québec.</span>
        </div>
        <div className="pied__colonne">
          <span className="eyebrow pied__titre">Snowro</span>
          <a href="/#comment">Comment ça marche</a>
          <a href="/#frais">Frais</a>
          <a href="/#deneigeur">Devenir déneigeur de quartier</a>
        </div>
        <div className="pied__colonne">
          <span className="eyebrow pied__titre">Snowro Pro</span>
          <a href="/#pro">Données de zones</a>
          <a href="/#liste">Liste d'attente</a>
        </div>
        <div className="pied__colonne">
          <span className="eyebrow pied__titre">Légal</span>
          <Link to="/confidentialite">Confidentialité</Link>
          <Link to="/conditions">Conditions</Link>
          <Link to="/nous-ecrire">Nous écrire</Link>
        </div>
      </div>
      <div className="pied__barre">
        <span>© 2026 Snowro. Québec, QC.</span>
        <span>Paiements traités par Stripe.</span>
      </div>
      <div className="pied__version">
        <VersionFooter />
      </div>
    </footer>
  );
}
