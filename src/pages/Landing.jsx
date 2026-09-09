import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SnowroLockup from "../components/brand/SnowroLockup";
import DemandeCard from "../components/DemandeCard";
import "./Landing.css";

const ETAPES = [
  {
    titre: "Tu publies",
    texte: "Ton adresse, quand tu veux que ce soit fait, et combien tu offres. Ça prend deux minutes.",
  },
  {
    titre: "Un voisin accepte",
    texte: "Le premier déneigeur disponible près de chez toi prend la job. Pas d'attente, pas d'enchère.",
  },
  {
    titre: "Tu payes après",
    texte: "3 $ de mise en relation, seulement si ça se conclut. Le reste, tu le donnes directement à ton déneigeur.",
  },
];

export default function Landing() {
  const { user, loading } = useAuth();

  if (!loading && user) return <Navigate to="/demandes" replace />;

  return (
    <div className="landing">
      <header className="landing__entete">
        <SnowroLockup qualifiant="X" size={32} />
        <nav className="landing__nav">
          <a href="#comment-ca-marche">Comment ça marche</a>
          <Link to="/connexion">Se connecter</Link>
        </nav>
      </header>

      <section className="landing__hero">
        <h1>Un voisin pour pelleter, pas une flotte de camions.</h1>
        <p className="landing__hero-texte">
          Publie ta demande de déneigement, un déneigeur proche de chez toi l'accepte, et tu payes le
          service directement avec lui — carte, Interac, comptant. Snowro ne charge qu'un petit frais de
          mise en relation, et seulement si ça se conclut.
        </p>
        <div className="landing__cta">
          <Link to="/inscription" className="landing__bouton-primaire">
            Publier une demande
          </Link>
          <Link to="/inscription" className="landing__bouton-secondaire">
            Devenir déneigeur
          </Link>
        </div>
      </section>

      <section className="landing__apercu">
        <p className="eyebrow landing__apercu-titre">Ça ressemble à ça</p>
        <DemandeCard
          apercu
          demande={{
            id: "apercu",
            statut: "ouverte",
            distanceM: 400,
            quartier: "Limoilou",
            titre: "Entrée double + balcon",
            description: "Avant 8 h demain matin. Pelle fournie si tu en as pas.",
            montant: 45,
            donneurPrenom: "Mireille G.",
          }}
        />
      </section>

      <section id="comment-ca-marche" className="landing__etapes">
        <h2>Comment ça marche</h2>
        <div className="landing__etapes-grille">
          {ETAPES.map((etape, i) => (
            <div key={etape.titre} className="landing__etape">
              <span className="landing__etape-numero">{i + 1}</span>
              <h3>{etape.titre}</h3>
              <p>{etape.texte}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing__pro">
        <h2>Tu déneiges pour gagner ta vie ?</h2>
        <p>
          Snowro Pro arrive bientôt : statistiques de zone et offres directes aux clients qui ont accepté
          d'être contactés. En attendant, inscris-toi comme déneigeur pour répondre aux demandes près de
          chez toi.
        </p>
      </section>

      <footer className="landing__pied">
        <SnowroLockup qualifiant="X" size={22} />
        <p>Déneigement de voisinage, Québec.</p>
      </footer>
    </div>
  );
}
