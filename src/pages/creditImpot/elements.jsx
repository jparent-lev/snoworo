import { Link } from "react-router-dom";
import { mesurer } from "../../lib/mesure";

// « 1er » en exposant (1<sup>er</sup>), comme dans le texte de référence.
export function Texte({ children }) {
  return String(children)
    .split(/(1er)/)
    .map((bout, i) =>
      bout === "1er" ? (
        <span key={i}>
          1<sup>er</sup>
        </span>
      ) : (
        bout
      ),
    );
}

// Tous les boutons « Trouver mon déneigeur » mènent à l'inscription.
export function BoutonDeneigeur({ emplacement }) {
  return (
    <Link className="ci-bouton" to="/inscription" onClick={() => mesurer("credit_cta_clic", { emplacement })}>
      Trouver mon déneigeur
    </Link>
  );
}

export function LienExterne({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  );
}
