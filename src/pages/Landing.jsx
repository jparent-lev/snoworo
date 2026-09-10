import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SnowroSymbol from "../components/brand/SnowroSymbol";
import VersionFooter from "../components/VersionFooter";
import FeeCalculator from "./landing/FeeCalculator";
import FaqAccordion from "./landing/FaqAccordion";
import WaitlistForm from "./landing/WaitlistForm";
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

  if (!loading && user) return <Navigate to="/demandes" replace />;

  const fermerMenu = () => setMenuOuvert(false);

  return (
    <div className="landing">
      <header className="landing__entete">
        <div className="landing__entete-inner">
          <a href="#haut" className="landing__logo" onClick={fermerMenu}>
            <SnowroSymbol variant="x" size={34} />
            <span className="landing__logo-texte">snowro</span>
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
          <nav id="landing-nav" className={`landing__nav ${menuOuvert ? "landing__nav--ouvert" : ""}`}>
            <a href="#comment" onClick={fermerMenu}>Comment ça marche</a>
            <a href="#frais" onClick={fermerMenu}>Frais</a>
            <a href="#deneigeur" onClick={fermerMenu}>Déneiger</a>
            <a href="#pro" onClick={fermerMenu}>Pro</a>
            <a href="#liste" className="landing__nav-cta" onClick={fermerMenu}>
              Rejoindre la liste
            </a>
          </nav>
        </div>
      </header>

      {/* 1. Héros */}
      <section id="haut" className="landing__hero">
        <div className="landing__hero-texte">
          <span className="eyebrow landing__hero-eyebrow">Déneigement à la demande · Québec</span>
          <h1 className="landing__hero-titre">Un voisin qui vient pelleter chez un autre voisin.</h1>
          <p className="landing__hero-chapeau">
            Tu publies ta demande, tu offres un montant. Le premier déneigeur du coin qui accepte s'en
            occupe. Le paiement passe par nous, alors personne ne se fait planter.
          </p>
          <div className="landing__hero-cta">
            <a href="#liste" className="landing__bouton-primaire">
              Je veux faire déneiger
            </a>
            <a href="#deneigeur" className="landing__bouton-fantome">
              Je veux déneiger
            </a>
          </div>
          <p className="landing__hero-mention">
            Pas encore lancé. On ouvre quartier par quartier — la liste d'attente décide de l'ordre.
          </p>
        </div>

        <div className="landing__hero-phone-wrap" aria-hidden="true">
          <div className="landing__hero-phone">
            <div className="landing__hero-phone-ecran">
              <div className="landing__hero-phone-entete">
                <div className="landing__hero-phone-logo">
                  <SnowroSymbol variant="x" size={26} />
                  <span>snowro</span>
                </div>
                <span className="landing__hero-phone-x">X</span>
              </div>
              <div className="landing__hero-phone-corps">
                <div className="landing__hero-phone-carte">
                  <span className="landing__hero-phone-surtitre">À 400 M — LIMOILOU</span>
                  <span className="landing__hero-phone-titre">Entrée double + balcon</span>
                  <span className="landing__hero-phone-desc">Avant 8 h demain matin. Pelle fournie si tu en as pas.</span>
                  <div className="landing__hero-phone-prix-ligne">
                    <span className="landing__hero-phone-prix">45 $</span>
                    <span className="landing__hero-phone-par">offert par Mireille G.</span>
                  </div>
                </div>
                <div className="landing__hero-phone-carte landing__hero-phone-carte--sourdine">
                  <span className="landing__hero-phone-surtitre">À 1,1 KM — VIEUX-LIMOILOU</span>
                  <span className="landing__hero-phone-titre">Petit stationnement</span>
                  <span className="landing__hero-phone-prix landing__hero-phone-prix--petit">30 $</span>
                </div>
                <button type="button" className="landing__hero-phone-bouton" tabIndex={-1}>
                  Je prends la job
                </button>
                <span className="landing__hero-phone-note">Paiement gardé par Snowro jusqu'à ce que ce soit fait.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Comment ça marche */}
      <section id="comment" className="landing__section">
        <h2 className="landing__h2">Trois étapes, pas douze</h2>
        <p className="landing__chapeau">Pas de soumission, pas de contrat de saison, pas d'attente au téléphone.</p>
        <div className="landing__etapes-grille">
          {[
            {
              titre: "Tu publies",
              texte: "Ton adresse, ce qu'il y a à pelleter, quand tu le veux, combien tu offres. Deux minutes sur le bord de la fenêtre.",
            },
            {
              titre: "Le quartier reçoit l'appel",
              texte: "Les déneigeurs de ta ville, les plus proches en premier, sont notifiés. Le premier qui accepte, c'est le tien.",
            },
            {
              titre: "C'est pelleté, c'est payé",
              texte: "On garde ton paiement le temps que la job se fasse, puis on le verse au déneigeur. Reçu automatique des deux bords.",
            },
          ].map((etape, i) => (
            <div key={etape.titre} className="landing__etape-carte">
              <span className="landing__etape-pastille">{i + 1}</span>
              <h3 className="landing__h3">{etape.titre}</h3>
              <p className="landing__p">{etape.texte}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Bloc paiement Stripe Connect */}
      <section className="landing__section">
        <div className="landing__bloc-paiement">
          <div>
            <span className="eyebrow landing__bloc-paiement-eyebrow">L'argent passe par nous</span>
            <h2 className="landing__h2 landing__h2--sur-ardoise">Personne se fait planter</h2>
            <p className="landing__p landing__p--sur-ardoise">
              Ton paiement est retenu quand tu réserves, pas quand tu espères. Le déneigeur sait qu'il va
              être payé, toi tu sais que ton argent revient s'il se présente pas.
            </p>
          </div>
          <div className="landing__bloc-paiement-cartes">
            {[
              { titre: "Paiement retenu jusqu'à la fin", texte: "Traité par Stripe. Snowro touche jamais à ta carte." },
              { titre: "Il vient pas ? Tu es remboursé", texte: "Pas de chicane, pas de virement Interac à courir après." },
              { titre: "Reçu automatique", texte: "Pratique pour les impôts si tu déneiges régulièrement." },
            ].map((c) => (
              <div key={c.titre} className="landing__mini-carte">
                <span className="landing__mini-carte-titre">{c.titre}</span>
                <span className="landing__mini-carte-texte">{c.texte}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Frais */}
      <section id="frais" className="landing__section">
        <div className="landing__deux-colonnes">
          <div>
            <h2 className="landing__h2">Nos frais, en toutes lettres</h2>
            <p className="landing__chapeau">
              Un montant fixe plus un pourcentage du contrat, prélevé une seule fois, au moment où la job
              est confirmée. Rien d'autre : pas d'abonnement, pas de frais d'affichage, pas de frais si
              personne accepte.
            </p>
            <p className="landing__p">Bouge le montant pour voir ce que ça donne.</p>
          </div>
          <FeeCalculator />
        </div>
      </section>

      {/* 5. Objection Facebook + villes émergentes */}
      <section className="landing__section">
        <div className="landing__deux-cartes">
          <div className="landing__carte-lin">
            <h3 className="landing__h3-carte">« Pourquoi pas juste le groupe Facebook du quartier ? »</h3>
            <p className="landing__p-sur-lin">
              Bonne question, et honnêtement : pour un coup de pelle entre voisins qui se connaissent, le
              groupe fait la job. Snowro sert quand tu connais personne, qu'il est 6 h du matin et que ton
              entrée est bloquée.
            </p>
            <div className="landing__arguments">
              <span className="landing__p-sur-lin">
                <strong>Tu attends pas après une réponse.</strong> Ta demande sonne chez tous les déneigeurs
                disponibles en même temps.
              </span>
              <span className="landing__p-sur-lin">
                <strong>L'argent est sécurisé.</strong> Pas de « je te paye demain » qui devient jamais.
              </span>
              <span className="landing__p-sur-lin">
                <strong>Le déneigeur est vérifié.</strong> Identité confirmée par Stripe avant qu'il puisse
                accepter quoi que ce soit.
              </span>
            </div>
          </div>
          <div className="landing__carte-claire">
            <h3 className="landing__h3-carte">Les villes se dessinent toutes seules</h3>
            <p className="landing__p">
              On a pas de liste de villes desservies à te faire lire. Ta ville apparaît dans Snowro dès
              qu'il y a du monde qui s'inscrit — et une demande est toujours montrée aux déneigeurs de ta
              ville, jamais à quelqu'un à trois autoroutes de là.
            </p>
            <div className="landing__jetons">
              <span className="landing__jeton">Québec</span>
              <span className="landing__jeton">Lévis</span>
              <span className="landing__jeton">Beauport</span>
              <span className="landing__jeton-texte">et la tienne, si tu t'inscris</span>
            </div>
            <p className="landing__p landing__p--legende">
              On ouvre une ville quand il y a assez de déneigeurs dedans pour que ça vaille la peine. C'est
              pour ça que la liste d'attente compte.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Devenir déneigeur */}
      <section id="deneigeur" className="landing__section-pleine-largeur landing__section-terre">
        <div className="landing__deux-colonnes landing__conteneur">
          <div>
            <span className="eyebrow landing__eyebrow-sur-terre">Tu as une pelle et du temps</span>
            <h2 className="landing__h2 landing__h2--sur-terre">Fais de l'argent avec la tempête</h2>
            <p className="landing__chapeau landing__chapeau--sur-terre">
              Tu choisis les jobs que tu prends, quand ça fait ton affaire. Pas de quota, pas d'horaire, pas
              de contrat de saison. Tu es payé dans les jours qui suivent, directement dans ton compte.
            </p>
            <div className="landing__profils">
              <span>Étudiant qui veut arrondir ses fins de mois entre deux sessions</span>
              <span>Gars du coin avec une souffleuse qui dort dans le garage</span>
              <span>Déneigeur pro qui veut remplir les trous dans sa tournée</span>
            </div>
            <a href="#liste" className="landing__bouton-ocre">
              M'inscrire comme déneigeur
            </a>
          </div>
          <div className="landing__carte-revenus-wrap">
            <div className="landing__carte-revenus">
              <span className="eyebrow landing__carte-revenus-eyebrow">Ta semaine, en gros</span>
              <div className="landing__revenus-lignes">
                <div className="landing__revenu-ligne">
                  <span>Mardi — 3 entrées</span>
                  <span className="landing__revenu-montant">110 $</span>
                </div>
                <div className="landing__revenu-ligne">
                  <span>Jeudi — 1 stationnement</span>
                  <span className="landing__revenu-montant">55 $</span>
                </div>
                <div className="landing__revenu-ligne landing__revenu-ligne--dernier">
                  <span>Samedi — 4 entrées</span>
                  <span className="landing__revenu-montant">145 $</span>
                </div>
              </div>
              <div className="landing__revenu-total">
                <span>Dans ton compte</span>
                <span className="landing__revenu-total-montant">282 $</span>
              </div>
              <span className="landing__revenu-note">Exemple d'une semaine de tempête à Limoilou, frais déjà déduits.</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Snowro Pro */}
      <section id="pro" className="landing__section">
        <div className="landing__pro-entete">
          <SnowroSymbol variant="pro" size={40} />
          <div className="landing__pro-lockup-texte">
            <span className="landing__pro-lockup-nom">snowro</span>
            <span className="eyebrow landing__pro-lockup-qualifiant">PRO</span>
          </div>
        </div>
        <div className="landing__deux-colonnes">
          <div>
            <h2 className="landing__h2">Pour ceux qui déneigent pour vivre</h2>
            <p className="landing__chapeau">
              Un abonnement mensuel qui te montre où la demande se trouve dans tes villes : quels secteurs
              appellent, à quelle heure, pour quels montants. Des chiffres agrégés et anonymes — jamais
              l'adresse de quelqu'un.
            </p>
            <div className="landing__arguments landing__arguments--espace">
              <span className="landing__p">
                <strong>Carte de la demande</strong> — par secteur et par ville, mise à jour après chaque
                bordée.
              </span>
              <span className="landing__p">
                <strong>Offres ciblées</strong> — écris aux clients qui ont déjà fait affaire avec toi,
                seulement s'ils ont dit oui.
              </span>
              <span className="landing__p">
                <strong>Plusieurs villes</strong> — tes stats suivent ta tournée, pas juste ton code postal.
              </span>
            </div>
            <a href="#liste" className="landing__bouton-ardoise">
              Être averti pour Pro
            </a>
          </div>
          <div className="landing__dashboard" role="img" aria-label="Aperçu d'un tableau de bord Snowro Pro affichant le nombre de demandes des sept derniers jours par secteur de Québec (Limoilou 64, Saint-Sauveur 41, Sainte-Foy 28, Beauport 17), l'heure la plus demandée (6 h à 9 h) et le montant offert médian (42 $). Données d'illustration.">
            <div className="landing__dashboard-entete">
              <span className="eyebrow landing__dashboard-eyebrow">Demande — 7 derniers jours</span>
              <span className="landing__dashboard-ville">Québec</span>
            </div>
            <div className="landing__dashboard-barres">
              {[
                { secteur: "Limoilou", n: 64, pct: 88, couleur: "argile" },
                { secteur: "Saint-Sauveur", n: 41, pct: 57, couleur: "argile" },
                { secteur: "Sainte-Foy", n: 28, pct: 39, couleur: "ocre" },
                { secteur: "Beauport", n: 17, pct: 24, couleur: "ocre" },
              ].map((b) => (
                <div key={b.secteur} className="landing__dashboard-barre-ligne">
                  <div className="landing__dashboard-barre-legende">
                    <span>{b.secteur}</span>
                    <span className="landing__dashboard-barre-n">{b.n} demandes</span>
                  </div>
                  <div className="landing__dashboard-piste">
                    <div
                      className={`landing__dashboard-remplissage landing__dashboard-remplissage--${b.couleur}`}
                      style={{ width: `${b.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="landing__dashboard-stats">
              <div>
                <span className="landing__dashboard-stat-valeur">6 h – 9 h</span>
                <span className="landing__dashboard-stat-label">heure la plus demandée</span>
              </div>
              <div className="landing__dashboard-stat--droite">
                <span className="landing__dashboard-stat-valeur">42 $</span>
                <span className="landing__dashboard-stat-label">montant offert médian</span>
              </div>
            </div>
            <span className="landing__dashboard-mention">
              Données d'illustration — le tableau de bord réel sera alimenté par les vraies demandes.
            </span>
          </div>
        </div>
      </section>

      {/* 8. Témoignages */}
      <section className="landing__section">
        <h2 className="landing__h2">Ce qu'on entend dans le quartier</h2>
        <p className="landing__chapeau">
          Snowro est pas encore lancé, alors pas de faux témoignages ici. Voici plutôt ce que le monde nous
          a dit pendant qu'on cognait aux portes à Limoilou.
        </p>
        <div className="landing__temoignages">
          {[
            { citation: "Mon déneigeur m'a lâchée en janvier. J'ai passé trois jours à texter du monde sur Facebook.", auteur: "Mireille, 61 ans — Vieux-Limoilou" },
            { citation: "Je fais déjà des entrées le matin avant l'école. Mon problème c'est de me faire payer, pas de trouver du monde.", auteur: "Anthony, 19 ans — Saint-Roch" },
            { citation: "Une tempête, j'ai douze clients de contrat pis dix appels que je peux pas prendre. J'aimerais savoir où va le monde.", auteur: "Yannick — Déneigement Bergeron" },
          ].map((t) => (
            <blockquote key={t.auteur} className="landing__temoignage">
              <p className="landing__temoignage-citation">« {t.citation} »</p>
              <footer className="landing__temoignage-auteur">{t.auteur}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      {/* 9. Liste d'attente */}
      <section id="liste" className="landing__section">
        <div className="landing__bloc-liste">
          <div>
            <h2 className="landing__h2 landing__h2--sur-argile">On ouvre où il y a du monde</h2>
            <p className="landing__p landing__p--sur-argile-clair">
              Laisse-nous ton courriel et ton code postal. On te fait signe quand Snowro débarque dans ton
              coin — et ton inscription fait avancer ta ville dans la file.
            </p>
          </div>
          <WaitlistForm />
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
              Un snoreau, chez nous, c'est un petit vaurien sympathique — celui qui te joue un tour pis qui
              vient te donner un coup de main dix minutes après. C'est pas mal l'esprit qu'on cherche.
            </p>
            <p className="landing__p-sur-lin">
              Snowro est parti d'une entrée bloquée à Limoilou et d'une soirée à texter du monde. On bâtit
              ça d'ici, pour l'hiver d'ici.
            </p>
          </div>
          <div className="landing__apropos-symbole">
            <SnowroSymbol variant="x" size={180} />
          </div>
        </div>
      </section>

      <footer className="landing__pied">
        <div className="landing__pied-colonnes">
          <div className="landing__pied-colonne">
            <div className="landing__pied-logo">
              <SnowroSymbol variant="reversed" size={32} />
              <span className="landing__pied-logo-texte">snowro</span>
            </div>
            <span className="landing__pied-slogan">Déneigement à la demande, fait à Québec.</span>
          </div>
          <div className="landing__pied-colonne">
            <span className="eyebrow landing__pied-titre">Snowro X</span>
            <a href="#comment">Comment ça marche</a>
            <a href="#frais">Frais</a>
            <a href="#deneigeur">Devenir déneigeur</a>
          </div>
          <div className="landing__pied-colonne">
            <span className="eyebrow landing__pied-titre">Snowro Pro</span>
            <a href="#pro">Données de zones</a>
            <a href="#liste">Liste d'attente</a>
          </div>
          <div className="landing__pied-colonne">
            <span className="eyebrow landing__pied-titre">Légal</span>
            {/* Pages à créer, obligatoires avant la mise en ligne (collecte de courriels). */}
            <a href="#">Confidentialité</a>
            <a href="#">Conditions</a>
            <a href="#">Nous écrire</a>
          </div>
        </div>
        <div className="landing__pied-barre">
          <span>© 2026 Snowro. Québec, QC.</span>
          <span>Paiements traités par Stripe.</span>
        </div>
        <div className="landing__pied-version">
          <VersionFooter />
        </div>
      </footer>
    </div>
  );
}
