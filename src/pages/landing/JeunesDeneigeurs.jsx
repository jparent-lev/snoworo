import { Link } from "react-router-dom";
import "./JeunesDeneigeurs.css";

// Accueil, projet pilote des jeunes déneigeurs (14 à 17 ans), affiché
// seulement quand VITE_JEUNES_PILOTE=1 (test.snowro.com). S'adresse au parent :
// c'est lui qui ouvre le compte, invite son jeune et fixe les règles
// (docs/jeunes.md). Rien ici ne promet plus que ce que l'app fait vraiment.
const MECANISMES = [
  {
    titre: "Vous l'invitez",
    texte:
      "Depuis vos paramètres, vous inscrivez son prénom, son année de naissance et son courriel. Il reçoit un lien pour créer son propre accès, rattaché à votre compte.",
  },
  {
    titre: "Vous fixez ses règles",
    texte:
      "Heures permises, distance maximale de la maison et nombre de demandes par jour. Il ne voit que les demandes qui les respectent, et vous les modifiez en tout temps.",
  },
  {
    titre: "Vous êtes avisé",
    texte:
      "Un courriel et un texto à chaque demande qu'il accepte. Si quelque chose ne vous convient pas, vous l'annulez tant que le travail n'est pas fait : le client est remboursé.",
  },
  {
    titre: "Vous gardez la main",
    texte:
      "Les paiements arrivent dans votre compte de versement. En cas de signalement, vous recevez l'avis et les messages échangés. Une pause ou un retrait se fait en un clic.",
  },
];

export default function JeunesDeneigeurs() {
  return (
    <section id="jeunes" className="landing__section jeunes-accueil">
      <div className="landing__deux-colonnes">
        <div>
          <span className="eyebrow">Projet pilote · 14 à 17 ans</span>
          <h2 className="landing__h2">Votre ado veut déneiger ? Vous gardez la main.</h2>
          <p className="landing__chapeau">
            Un premier petit emploi, près de la maison, avec votre accord. Vous créez votre compte, vous invitez votre
            jeune et vous fixez ses règles une seule fois. Il choisit ses demandes, vous êtes avisé de chacune, et les
            paiements arrivent chez vous.
          </p>
          <div className="jeunes-accueil__cta">
            <Link to="/inscription" data-mesure="section_jeunes" className="landing__bouton-primaire landing__bouton-neige landing__bouton-neige--b">
              Inscrire mon jeune
            </Link>
            <span className="jeunes-accueil__note">
              Déjà inscrit ? <Link to="/parametres#jeunes">Paramètres, section Jeune déneigeur</Link>.
            </span>
          </div>
        </div>

        {/* Aperçu de ce que le parent voit : règles et avis. Exemple fictif. */}
        <div className="jeunes-accueil__apercu" aria-hidden="true">
          <div className="jeunes-accueil__fiche">
            <div className="jeunes-accueil__fiche-entete">
              <span className="jeunes-accueil__avatar">L</span>
              <div>
                <strong>Léo, 15 ans</strong>
                <span className="jeunes-accueil__actif">Actif</span>
              </div>
            </div>
            <div className="jeunes-accueil__regles">
              <span>🕖 7 h à 20 h</span>
              <span>📍 1 km de la maison</span>
              <span>✋ 2 demandes par jour</span>
            </div>
            <span className="jeunes-accueil__lien">Modifier les règles</span>
          </div>
          <div className="jeunes-accueil__avis">
            <span className="jeunes-accueil__avis-titre">Léo a accepté une demande</span>
            <span>Entrée simple, rue des Érables · demain 16 h · 30 $</span>
            <span className="jeunes-accueil__avis-actions">
              <span>Tout est beau</span>
              <span className="jeunes-accueil__avis-annuler">Annuler la demande</span>
            </span>
          </div>
          <span className="jeunes-accueil__exemple">Exemple</span>
        </div>
      </div>

      <div className="jeunes-accueil__grille">
        {MECANISMES.map((m, i) => (
          <div key={m.titre} className="jeunes-accueil__carte">
            <span className="jeunes-accueil__numero">{i + 1}</span>
            <h3 className="jeunes-accueil__carte-titre">{m.titre}</h3>
            <p className="landing__p">{m.texte}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
