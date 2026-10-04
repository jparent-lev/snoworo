import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { CREDIT_MAD as C, LIENS_REVENU_QUEBEC, VERSION_PAGE_CREDIT, dollars, pourcent } from "../../config/creditImpot";
import { mesurer } from "../../lib/mesure";
import { CapNeige, FloconsFiligrane, Icone } from "../landing/Decors";
import { FAQ } from "./contenu";
import { BoutonDeneigeur, LienExterne, Texte } from "./elements";

// Sections de /credit-impot, avec les gabarits de l'accueil (Landing.css) :
// cartes d'étapes, cartes claires, bloc ardoise, FAQ du site, bande terre.
const TAUX = pourcent(C.taux);

export function EtapesCredit() {
  const etapes = [
    {
      titre: "Trouvez votre déneigeur",
      texte:
        "Snowro vous jumelle avec une personne fiable de votre quartier, au prix d'une entente entre voisins. Le paiement est sécurisé par la plateforme.",
    },
    {
      titre: "Recevez vos factures conformes",
      texte:
        "À chaque paiement, Snowro génère automatiquement une facture avec les renseignements exigés par Revenu Québec. En fin de saison, vous recevez votre fiche fiscale annuelle, prête pour votre déclaration.",
    },
    {
      titre: `Récupérez vos ${TAUX}`,
      texte: `Réclamez le crédit dans votre déclaration de revenus (annexe J), ou demandez des versements anticipés avant le ${C.dateLimiteVersementsAnticipes} pour être remboursé pendant l'hiver, par dépôt direct.`,
    },
  ];
  return (
    <section id="comment" className="landing__section">
      <h2 className="landing__h2">Trois étapes, et l'hiver est réglé</h2>
      <p className="landing__chapeau">Pas de paperasse compliquée. Snowro s'occupe des documents, vous profitez du crédit.</p>
      <ol className="landing__etapes-grille ci-liste">
        {etapes.map((e, i) => (
          <li key={e.titre} className="landing__etape-carte">
            <span className="ci-numero" aria-hidden="true">
              {i + 1}
            </span>
            <h3 className="landing__h3">{e.titre}</h3>
            <p className="landing__p">
              <Texte>{e.texte}</Texte>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Ligne({ oui, children }) {
  return (
    <li className={`ci-ligne ${oui ? "" : "ci-ligne--non"}`}>
      <span className={oui ? "ci-coche" : "ci-croix"} aria-hidden="true">
        {oui ? "✓" : "✗"}
      </span>
      <span>
        <span className="sr-only">{oui ? "Oui : " : "Non : "}</span>
        {children}
      </span>
    </li>
  );
}

export function ComparaisonOptions() {
  const options = [
    {
      titre: "Quelqu'un du coin, payé comptant",
      prix: "Prix abordable, entente informelle",
      lignes: [
        [true, "Prix de voisin"],
        [false, "Aucune facture conforme"],
        [false, `Pas de crédit d'impôt de ${TAUX}`],
        [false, "Aucun recours si la personne ne se présente pas"],
      ],
    },
    {
      titre: "Compagnie de déneigement",
      prix: "Service encadré, prix commercial",
      lignes: [
        [true, "Facture en bonne et due forme"],
        [true, `Crédit d'impôt de ${TAUX}`],
        [false, "Prix commercial, souvent plus élevé"],
        [false, "Listes d'attente dans plusieurs quartiers"],
      ],
    },
    {
      titre: "Un déneigeur de votre quartier, via Snowro",
      prix: "Prix communautaire, documents conformes",
      vedette: true,
      lignes: [
        [true, "Prix de voisin"],
        [true, "Facture conforme générée automatiquement"],
        [true, `Crédit d'impôt de ${TAUX}`],
        [true, "Paiement sécurisé et fiche fiscale annuelle"],
      ],
    },
  ];
  return (
    <section className="landing__section">
      <h2 className="landing__h2">Le prix d'un voisin. Le reçu en plus.</h2>
      <p className="landing__chapeau">
        Payer comptant quelqu'un du coin, c'est abordable, mais sans facture, pas de crédit d'impôt. Une compagnie
        émet une facture, mais à prix commercial. Snowro combine les deux avantages.
      </p>
      <div className="ci-cartes">
        {options.map((o) => (
          <div key={o.titre} className={o.vedette ? "landing__carte-lin ci-carte-vedette" : "landing__carte-claire"}>
            {o.vedette && <span className="eyebrow ci-ruban">Snowro</span>}
            <h3 className="landing__h3-carte">{o.titre}</h3>
            <p className={o.vedette ? "landing__p-sur-lin" : "landing__p"}>{o.prix}</p>
            <ul className="ci-liste ci-lignes">
              {o.lignes.map(([oui, texte]) => (
                <Ligne key={texte} oui={oui}>
                  {texte}
                </Ligne>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BlocAidants() {
  return (
    <section className="landing__section">
      <div className="landing__bloc-paiement">
        <FloconsFiligrane />
        <div>
          <span className="eyebrow landing__bloc-paiement-eyebrow">Proches aidants</span>
          <h2 className="landing__h2 landing__h2--sur-ardoise">Vous organisez le déneigement d'un parent?</h2>
          <p className="landing__p landing__p--sur-ardoise">
            Votre mère ou votre père veut rester dans sa maison, et c'est vous qui vous occupez de la logistique. Créez
            son profil Snowro, choisissez le déneigeur avec lui ou elle, et suivez chaque passage à distance. Vous avez
            l'esprit tranquille, votre parent garde son autonomie.
          </p>
        </div>
        <div className="landing__bloc-paiement-cartes">
          <div className="landing__mini-carte">
            <Icone nom="cadenas" />
            <div className="landing__mini-carte-corps">
              <span className="landing__mini-carte-titre">Bon à savoir</span>
              <span className="landing__mini-carte-texte">
                Pour que le crédit s'applique, les dépenses doivent être payées par la personne de 70 ans ou plus (ou
                son conjoint). Snowro vous permet de gérer le compte de votre parent tout en gardant son mode de
                paiement à son nom.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AdmissibiliteBref() {
  const criteres = [
    "Avoir 70 ans ou plus et résider au Québec au 31 décembre de l'année visée",
    "Le déneigement concerne votre résidence principale (maison, condo ou logement)",
    "Le service est rendu par un travailleur autonome ou une entreprise, avec facture à l'appui",
    "Le déneigeur n'est pas votre conjoint ni une personne à votre charge",
    "Seul le coût du service est admissible, pas les produits comme le sel ou l'abrasif",
    `Crédit complet sous environ ${dollars(C.seuilReductionRevenu)} de revenu familial, réduit graduellement au-delà`,
  ];
  return (
    <section className="landing__section">
      <h2 className="landing__h2">L'admissibilité en bref</h2>
      <p className="landing__chapeau">
        Les grandes conditions du crédit d'impôt pour maintien à domicile des aînés, telles que décrites par Revenu
        Québec.
      </p>
      <ul className="ci-liste ci-criteres">
        {criteres.map((c) => (
          <li key={c} className="ci-critere">
            <span className="ci-coche" aria-hidden="true">
              ✓
            </span>
            <span>{c}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Même accordéon que la FAQ de l'accueil : boutons avec aria-expanded et
// aria-controls, une question ouverte à la fois.
export function FaqCredit() {
  const [ouvert, setOuvert] = useState(-1);
  const base = useId();
  function basculer(i) {
    const ouvrir = ouvert !== i;
    setOuvert(ouvrir ? i : -1);
    if (ouvrir) mesurer("credit_faq_ouverture", { question: i + 1 });
  }
  return (
    <section id="faq" className="landing__section">
      <h2 className="landing__h2">Vos questions sur le crédit</h2>
      <p className="landing__chapeau">
        Les réponses ci-dessous résument l'information publiée par Revenu Québec. Pour votre situation personnelle,
        consultez Revenu Québec ou un professionnel.
      </p>
      <div className="faq">
        {FAQ.map(({ q, r }, i) => {
          const estOuvert = ouvert === i;
          const idReponse = `${base}-reponse-${i}`;
          return (
            <div key={q} className="faq__item">
              <button
                type="button"
                className="faq__question"
                aria-expanded={estOuvert}
                aria-controls={idReponse}
                onClick={() => basculer(i)}
              >
                <span className="faq__question-texte">{q}</span>
                <span className="faq__signe" aria-hidden="true">
                  {estOuvert ? "–" : "+"}
                </span>
              </button>
              <div id={idReponse} className="faq__reponse ci-reponse" hidden={!estOuvert}>
                {r.map((p) => (
                  <p key={p}>
                    <Texte>{p}</Texte>
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CtaFinal() {
  return (
    <section className="landing__section-pleine-largeur landing__section-terre ci-final">
      <CapNeige plat className="landing__cap-terre" />
      <div className="landing__conteneur ci-final__contenu">
        <h2 className="landing__h2 landing__h2--sur-terre">L'hiver s'en vient. Votre remboursement aussi.</h2>
        <p className="landing__chapeau landing__chapeau--sur-terre">
          Trouvez votre déneigeur maintenant, demandez vos versements anticipés avant le{" "}
          <Texte>{C.dateLimiteVersementsAnticipes}</Texte>, et recevez votre crédit pendant l'hiver plutôt qu'au
          printemps.
        </p>
        <BoutonDeneigeur emplacement="final" surTerre />
      </div>
    </section>
  );
}

// Avis fiscal, liens vers Revenu Québec et version de la page, juste avant le
// pied de page du site.
export function AvisCredit() {
  return (
    <section className="landing__conteneur ci-avis">
      <p>
        L'information présentée sur cette page est de nature générale et ne constitue pas un conseil fiscal. Les
        paramètres du crédit d'impôt pour maintien à domicile des aînés (taux de {TAUX} en {C.annee}, seuils et
        plafonds) proviennent de Revenu Québec et peuvent changer. Chaque situation est unique&nbsp;: vérifiez votre
        admissibilité auprès de Revenu Québec ou d'un professionnel.
      </p>
      <ul className="ci-liste ci-avis__liens">
        <li>
          <LienExterne href={LIENS_REVENU_QUEBEC.credit}>Revenu Québec, crédit pour maintien à domicile</LienExterne>
        </li>
        <li>
          <LienExterne href={LIENS_REVENU_QUEBEC.demande}>Demander le crédit et les versements anticipés</LienExterne>
        </li>
        <li>
          <Link to="/">snowro.com</Link>
        </li>
      </ul>
      <p className="ci-avis__version">© Snowro · Québec · {VERSION_PAGE_CREDIT}</p>
    </section>
  );
}
