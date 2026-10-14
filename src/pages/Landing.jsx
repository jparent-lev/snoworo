import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SnowroSymbol from "../components/brand/SnowroSymbol";
import PiedDePage from "../components/PiedDePage";
import FeeCalculator from "./landing/FeeCalculator";
import FaqAccordion from "./landing/FaqAccordion";
import WaitlistForm from "./landing/WaitlistForm";
import HeroIllustration from "./landing/HeroIllustration";
import TableauParallaxe from "./landing/TableauParallaxe";
import {
  CapNeige,
  CarteVilles,
  BancDeNeige,
  ChuteDeNeige,
  FloconsFiligrane,
  Icone,
  IllustrationEtape,
} from "./landing/Decors";
import "./Landing.css";

// Site vitrine de pré-lancement — collecte de liste d'attente uniquement,
// aucun compte ni paiement réel déclenché ici. Copie et structure figées par
// design_handoff_snowro_site/README.md (à reprendre telle quelle) ; le menu
// hamburger mobile est un ajout hors maquette (le prototype ne couvrait pas
// ce cas — le nav en flex-wrap se cassait en plusieurs lignes désordonnées
// sous ~900px).
export default function Landing() {
  const { user, loading } = useAuth();
  const [menuOuvert, setMenuOuvert] = useState(false);
  // Barre minimaliste (logo + « Rejoindre la liste ») dès que la page défile.
  const [compact, setCompact] = useState(false);
  // Rôle du formulaire de liste d'attente (client ou déneigeur), présélectionné
  // par les boutons de l'accueil. Le rôle « pro » existe toujours dans le
  // formulaire et les functions, mais l'offre Snowro Pro est retirée du site
  // jusqu'à la V2 (section, lien du menu, bouton « Être averti pour Pro »).
  const [roleListe, setRoleListe] = useState("client");

  // Arrivée depuis une autre page par un lien "/#section" (pied de page des
  // pages légales) : le navigateur tente de défiler avant que React ait rendu
  // la section, donc on le refait une fois la page montée.
  useEffect(() => {
    if (!window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [loading]);

  useEffect(() => {
    const maj = () => {
      const bas = window.scrollY > 80;
      setCompact(bas);
      if (bas) setMenuOuvert(false);
    };
    maj();
    window.addEventListener("scroll", maj, { passive: true });
    return () => window.removeEventListener("scroll", maj);
  }, []);

  if (!loading && user) return <Navigate to="/tableau-de-bord" replace />;

  const fermerMenu = () => setMenuOuvert(false);

  return (
    <div className="landing">
      <header className={`landing__entete${compact ? " landing__entete--compact" : ""}`}>
        <div className="landing__entete-inner">
          <a href="#haut" className="landing__logo" onClick={fermerMenu}>
            <SnowroSymbol variant="x" neige surTuile size={compact ? 32 : 44} />
            <span className="landing__logo-texte">snowro</span>
          </a>
          <nav id="landing-nav" className={`landing__nav ${menuOuvert ? "landing__nav--ouvert" : ""}`}>
            <a href="#comment" onClick={fermerMenu}>Comment ça marche</a>
            <a href="#tableau-de-bord" onClick={fermerMenu}>Tableau de bord</a>
            <a href="#frais" onClick={fermerMenu}>Frais</a>
            <a href="#deneigeur" onClick={fermerMenu}>Déneiger</a>
          </nav>
          <a href="#liste" className="landing__nav-cta landing__bouton-neige landing__bouton-neige--a" onClick={fermerMenu}>
            Rejoindre la liste
          </a>
          <button
            type="button"
            className="landing__menu-bouton"
            aria-expanded={menuOuvert}
            aria-controls="landing-nav"
            aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMenuOuvert((v) => !v)}
          >
            <span className={`landing__menu-icone ${menuOuvert ? "landing__menu-icone--ouvert" : ""}`} />
          </button>
        </div>
      </header>

      {/* 1. Héros */}
      <div className="landing__hero-bande">
        <ChuteDeNeige className="decor-chute--ciel" />
      <section id="haut" className="landing__hero">
        <div className="landing__hero-texte">
          <h1 className="landing__hero-titre">Trouvez un déneigeur de quartier en quelques minutes.</h1>
          <p className="landing__hero-chapeau">
            Un escalier glacé, l'accès au cabanon bloqué ou une entrée à souffler après la tempête ? Publiez
            votre besoin, votre quartier et le montant proposé : un voisin équipé d'une pelle ou d'une
            souffleuse prend la tâche et s'en occupe. Simple, rapide, sans engagement.
          </p>
          <div className="landing__hero-cta">
            <a
              href="#liste"
              className="landing__bouton-primaire landing__bouton-neige landing__bouton-neige--b"
              onClick={() => setRoleListe("client")}
            >
              Je veux faire déneiger
            </a>
            <a href="#deneigeur" className="landing__bouton-fantome">
              Je veux déneiger
            </a>
          </div>
          <p className="landing__hero-mention">
            Pas encore lancé. Nous ouvrons quartier par quartier : la liste d'attente détermine l'ordre.
          </p>
        </div>

        <div className="landing__hero-phone-wrap">
          <HeroIllustration />
        </div>
      </section>
        <BancDeNeige />
      </div>

      {/* 2. Comment ça marche */}
      <section id="comment" className="landing__section">
        <h2 className="landing__h2">Trois étapes simples, de la demande au travail terminé</h2>
        <p className="landing__chapeau">Publiez votre demande, un déneigeur de quartier l'accepte, et vous confirmez le travail : simple, rapide, sans engagement.</p>
        <div className="landing__etapes-grille">
          {[
            {
              titre: "Vous publiez",
              texte: "Votre adresse, ce qu'il y a à pelleter, les outils fournis ou non, le moment souhaité et le montant offert. Deux minutes suffisent.",
            },
            {
              titre: "Le quartier reçoit l'appel",
              texte: "Tous les déneigeurs de quartier disponibles dans votre secteur sont avertis en même temps. Le premier qui accepte prend la demande : aucune comparaison à faire.",
            },
            {
              titre: "C'est pelleté, c'est payé",
              texte: "Nous retenons votre paiement le temps que la demande soit réalisée, puis nous le versons au déneigeur de quartier. Un reçu est transmis automatiquement aux deux parties.",
            },
          ].map((etape, i) => (
            <div key={etape.titre} className="landing__etape-carte">
              <IllustrationEtape etape={i + 1} />
              <h3 className="landing__h3">{etape.titre}</h3>
              <p className="landing__p">{etape.texte}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Ce qui protège la relation (fiabilité, entente claire, paiement) */}
      <section className="landing__section">
        <div className="landing__bloc-paiement">
          <FloconsFiligrane />
          <div>
            <span className="eyebrow landing__bloc-paiement-eyebrow">Ce qui vous protège</span>
            <h2 className="landing__h2 landing__h2--sur-ardoise">Vous savez avec qui vous traitez et à quoi vous attendre</h2>
            <p className="landing__p landing__p--sur-ardoise">
              Aller vite, c'est bien, mais Snowro ajoute trois garanties que le groupe Facebook du quartier
              ne vous offre pas : une note publique sur chaque déneigeur de quartier, une entente écrite avant
              le début du travail, et un paiement qui reste sécurisé jusqu'à ce que la demande soit faite.
            </p>
          </div>
          <div className="landing__bloc-paiement-cartes">
            {[
              { icone: "note", titre: "Des déneigeurs de quartier notés", texte: "Chaque demande donne lieu à une appréciation. Un travail bâclé se sait, et cela ferme des portes." },
              { icone: "entente", titre: "Une entente claire dès le départ", texte: "Prix, heure souhaitée, outils fournis ou non : tout est écrit avant que quelqu'un accepte." },
              { icone: "cadenas", titre: "Paiement sécurisé", texte: "Traité par Stripe, retenu jusqu'à ce que la demande soit confirmée faite." },
            ].map((c) => (
              <div key={c.titre} className="landing__mini-carte">
                <Icone nom={c.icone} />
                <div className="landing__mini-carte-corps">
                  <span className="landing__mini-carte-titre">{c.titre}</span>
                  <span className="landing__mini-carte-texte">{c.texte}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 bis. Dans le tableau de bord : aperçu (Client / Déneigeur) et éléments de confiance */}
      <section id="tableau-de-bord" className="landing__section">
        <span className="eyebrow">Une gestion simple</span>
        <h2 className="landing__h2">Tout se passe dans votre tableau de bord</h2>
        <p className="landing__chapeau">
          Un seul compte, deux modes : Client pour faire déneiger, Déneigeur pour prendre des demandes. Chaque
          demande suit les mêmes étapes, du début à la fin, sous vos yeux.
        </p>
        <TableauParallaxe />
      </section>

      {/* 4. Frais */}
      <section id="frais" className="landing__section">
        <div className="landing__deux-colonnes">
          <div>
            <h2 className="landing__h2">Nos frais, en toutes lettres</h2>
            <p className="landing__chapeau">
              Un montant fixe plus un pourcentage du contrat, prélevé une seule fois, au moment où la demande
              est confirmée. Rien d'autre : pas d'abonnement, pas de frais d'affichage, pas de frais si
              personne accepte.
            </p>
            <p className="landing__p">Bougez le montant pour voir le résultat.</p>
          </div>
          <FeeCalculator />
        </div>
      </section>

      {/* 5. Objection Facebook (comparatif visuel) + villes émergentes */}
      <section className="landing__section">
        <div className="landing__compare">
          <div className="landing__compare-intro">
            <h3 className="landing__h3-carte">« Pourquoi pas juste le groupe Facebook du quartier ? »</h3>
            <p className="landing__p">
              Pour un coup de pelle entre voisins qui se connaissent, le groupe fait très bien l'affaire.
              Snowro sert quand vous ne connaissez personne et que le temps presse.
            </p>
          </div>
          <div className="landing__compare-table" role="table" aria-label="Groupe du quartier ou Snowro">
            <div className="landing__compare-ligne landing__compare-ligne--tete" role="row">
              <span role="columnheader" />
              <span role="columnheader" className="landing__compare-col">Groupe du quartier</span>
              <span role="columnheader" className="landing__compare-col landing__compare-col--snowro">Snowro</span>
            </div>
            {[
              { icone: "horloge", sujet: "La réponse", groupe: "À attendre, un commentaire à la fois", snowro: "Tous les déneigeurs du secteur avertis en même temps" },
              { icone: "note", sujet: "La confiance", groupe: "Un profil anonyme", snowro: "Une note publique, demande après demande" },
              { icone: "entente", sujet: "L'entente", groupe: "À discuter sur le perron", snowro: "Prix, heure et outils écrits d'avance" },
            ].map((l) => (
              <div key={l.sujet} className="landing__compare-ligne" role="row">
                <span role="rowheader" className="landing__compare-sujet">
                  <Icone nom={l.icone} />
                  {l.sujet}
                </span>
                <span role="cell" className="landing__compare-case">{l.groupe}</span>
                <span role="cell" className="landing__compare-case landing__compare-case--snowro">
                  <span className="landing__compare-coche" aria-hidden="true">✓</span>
                  {l.snowro}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="landing__villes">
          <div className="landing__villes-texte">
            <h3 className="landing__h3-carte">Les villes se dessinent toutes seules</h3>
            <p className="landing__p">
              Votre ville apparaît dans Snowro dès que des personnes s'y inscrivent. Votre demande est toujours
              montrée aux déneigeurs de quartier de votre ville.
            </p>
            <div className="landing__jetons">
              <span className="landing__jeton">Québec</span>
              <span className="landing__jeton">Montréal</span>
              <span className="landing__jeton">Trois-Rivières</span>
              <a href="#liste" className="landing__jeton landing__jeton--tienne">
                + La vôtre ?
              </a>
            </div>
            <p className="landing__p landing__p--legende">
              Nous ouvrons une ville lorsqu'elle compte assez de déneigeurs de quartier : c'est pourquoi la
              liste d'attente compte.
            </p>
          </div>
          <CarteVilles />
        </div>
      </section>

      {/* 6. Devenir déneigeur de quartier */}
      <section id="deneigeur" className="landing__section-pleine-largeur landing__section-terre">
        <CapNeige plat className="landing__cap-terre" />
        <ChuteDeNeige />
        <div className="landing__deux-colonnes landing__conteneur">
          <div>
            <span className="eyebrow landing__eyebrow-sur-terre">Vous avez une pelle et du temps</span>
            <h2 className="landing__h2 landing__h2--sur-terre">Gagnez de l'argent avec la tempête</h2>
            <p className="landing__chapeau landing__chapeau--sur-terre">
              Vous choisissez les demandes qui vous conviennent : chaque demande indique l'heure souhaitée, et vous
              acceptez seulement celles qui entrent dans votre journée. Vous êtes libre de votre horaire, sans
              quota ni contrat de saison, et vous êtes payé dans les jours qui suivent, directement dans votre compte.
            </p>
            <div className="landing__profils">
              <span>
                <Icone nom="etudiant" className="decor-icone--ocre" />
                Étudiant qui souhaite arrondir ses fins de mois entre deux sessions
              </span>
              <span>
                <Icone nom="souffleuse" className="decor-icone--ocre" />
                Résident du quartier dont la souffleuse dort dans le garage
              </span>
              <span>
                <Icone nom="camion" className="decor-icone--ocre" />
                Un professionnel du déneigement qui souhaite combler les temps libres de sa tournée
              </span>
            </div>
            <a
              href="#liste"
              className="landing__bouton-ocre landing__bouton-neige landing__bouton-neige--d"
              onClick={() => setRoleListe("deneigeur")}
            >
              M'inscrire comme déneigeur de quartier
            </a>
          </div>
          <div className="landing__carte-revenus-wrap">
            <div className="landing__carte-revenus">
              <span className="eyebrow landing__carte-revenus-eyebrow">Votre semaine, en bref</span>
              <div className="landing__revenus-lignes">
                <div className="landing__revenu-ligne">
                  <span>Mardi : 3 entrées</span>
                  <span className="landing__revenu-montant">110 $</span>
                </div>
                <div className="landing__revenu-ligne">
                  <span>Jeudi : 1 stationnement</span>
                  <span className="landing__revenu-montant">55 $</span>
                </div>
                <div className="landing__revenu-ligne landing__revenu-ligne--dernier">
                  <span>Samedi : 4 entrées</span>
                  <span className="landing__revenu-montant">145 $</span>
                </div>
              </div>
              <div className="landing__revenu-total">
                <span>Dans votre compte</span>
                <span className="landing__revenu-total-montant">282 $</span>
              </div>
              <span className="landing__revenu-note">Exemple d'une semaine de tempête à Limoilou, frais déjà déduits.</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Snowro Pro : section retirée temporairement (V2). Les styles
          landing__pro-* restent dans Landing.css et ApercuZonesPro dans Decors.jsx. */}

      {/* Témoignages retirés en attendant de vrais verbatims — voir Landing.css
          pour les styles landing__temoignage* laissés en place pour ce retour. */}

      {/* 9. Liste d'attente */}
      <section id="liste" className="landing__section">
        <div className="landing__bloc-liste">
          <CapNeige className="landing__cap-liste" />
          <div>
            <h2 className="landing__h2 landing__h2--sur-argile">Nous ouvrons là où il y a du monde</h2>
            <p className="landing__p landing__p--sur-argile-clair">
              Laissez-nous votre courriel et votre code postal. Nous vous écrirons lorsque Snowro sera offert dans
              votre secteur, et votre inscription fera avancer votre ville dans la file.
            </p>
          </div>
          <WaitlistForm role={roleListe} onRole={setRoleListe} />
        </div>
      </section>

      {/* 10. FAQ */}
      <section className="landing__section">
        <h2 className="landing__h2">Les questions qui reviennent</h2>
        <FaqAccordion />
      </section>

      {/* 11. À propos */}
      <section className="landing__section">
        <div className="landing__bloc-apropos">
          <div>
            <span className="eyebrow landing__eyebrow-ardoise">D'où vient le nom</span>
            <h2 className="landing__h2 landing__h2--petit">Snow + snoreau</h2>
            <p className="landing__p-sur-lin">
              Un snoreau, chez nous, c'est un petit vaurien sympathique, celui qui vous joue un tour et qui
              vient vous donner un coup de main dix minutes après. C'est assez bien l'esprit que nous cherchons.
            </p>
            <p className="landing__p-sur-lin">
              Snowro est né d'une entrée bloquée à Limoilou et d'une soirée passée à écrire à des voisins. Nous le
              bâtissons ici, pour l'hiver d'ici.
            </p>
          </div>
          <div className="landing__apropos-symbole">
            <SnowroSymbol variant="x" neige size={180} />
          </div>
        </div>
      </section>

      <PiedDePage />
    </div>
  );
}
