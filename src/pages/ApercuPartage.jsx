import SnowroSymbol from "../components/brand/SnowroSymbol";
import HeroIllustration from "./landing/HeroIllustration";
import { BancDeNeige, ChuteDeNeige } from "./landing/Decors";
import "./Landing.css";
import "./ApercuPartage.css";

// Gabarit de l'image d'aperçu partagée (Open Graph / Twitter), 1200 x 630.
// Page de développement seulement : la route /apercu-partage n'existe qu'en
// `vite dev` (voir App.jsx). Elle reprend tel quel le héros de la page
// d'accueil (ciel, chute de neige, banc de neige, illustration, titre) pour que
// l'aperçu reste raccord avec ce que la personne verra en cliquant.
// Pour régénérer public/og-snowro.png : `npm run og` (voir
// scripts/generer-apercu-partage.mjs). La capture se fait avec
// prefers-reduced-motion pour figer l'illustration sur l'écran « Je prends la
// demande » et l'amas de neige intact.

export default function ApercuPartage() {
  return (
    <div className="apercu-partage landing__hero-bande">
      <ChuteDeNeige className="decor-chute--ciel" />
      <div className="apercu-partage__contenu">
        <div className="apercu-partage__texte">
          <div className="apercu-partage__marque">
            <SnowroSymbol variant="x" neige surTuile size={52} />
            <span className="landing__logo-texte">snowro</span>
          </div>
          <h1 className="landing__hero-titre apercu-partage__titre">
            Trouvez un déneigeur de quartier en quelques minutes.
          </h1>
          <p className="apercu-partage__chapeau">
            Publiez votre besoin et le montant proposé : un voisin équipé s'en occupe. Simple, rapide,
            sans engagement.
          </p>
          <span className="apercu-partage__url">snowro.com</span>
        </div>
        <div className="apercu-partage__illustration">
          <HeroIllustration />
        </div>
      </div>
      <BancDeNeige />
    </div>
  );
}
