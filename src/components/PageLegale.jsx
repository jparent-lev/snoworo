import { useEffect } from "react";
import { Link } from "react-router-dom";
import SnowroSymbol from "./brand/SnowroSymbol";
import PiedDePage from "./PiedDePage";
import "./PageLegale.css";

// Gabarit des pages de texte du site vitrine (Confidentialité, Conditions,
// Nous écrire) : en-tête simple qui ramène à l'accueil, une colonne de
// lecture, et le même pied de page que l'accueil. Accessible connecté ou
// non, contrairement à l'accueil qui redirige vers /demandes.
export default function PageLegale({ surtitre, titre, miseAJour, children }) {
  useEffect(() => {
    document.title = `${titre} · Snowro`;
    window.scrollTo(0, 0);
  }, [titre]);

  return (
    <div className="page-legale">
      <header className="page-legale__entete">
        <div className="page-legale__entete-inner">
          <Link to="/" className="page-legale__logo">
            <SnowroSymbol variant="x" neige surTuile size={40} />
            <span className="page-legale__logo-texte">snowro</span>
          </Link>
          <Link to="/" className="page-legale__retour">← Retour à l'accueil</Link>
        </div>
      </header>

      <main className="page-legale__contenu">
        {surtitre && <span className="eyebrow page-legale__surtitre">{surtitre}</span>}
        <h1 className="page-legale__titre">{titre}</h1>
        {miseAJour && <p className="page-legale__maj">Dernière mise à jour : {miseAJour}</p>}
        <div className="page-legale__texte">{children}</div>
      </main>

      <PiedDePage />
    </div>
  );
}
