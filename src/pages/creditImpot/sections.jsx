import { Link } from "react-router-dom";
import VersionFooter from "../../components/VersionFooter";
import { CREDIT_MAD as C, LIENS_REVENU_QUEBEC, VERSION_PAGE_CREDIT, dollars, pourcent } from "../../config/creditImpot";
import { mesurer } from "../../lib/mesure";
import { FAQ } from "./contenu";
import { BoutonDeneigeur, LienExterne, Texte } from "./elements";

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
    <section className="ci-section" id="comment" aria-labelledby="ci-comment-titre">
      <div className="ci-contenant">
        <h2 id="ci-comment-titre">Trois étapes, et l'hiver est réglé</h2>
        <p className="ci-intro">Pas de paperasse compliquée. Snowro s'occupe des documents, vous profitez du crédit.</p>
        <ol className="ci-etapes">
          {etapes.map((e, i) => (
            <li key={e.titre} className="ci-etape">
              <span className="ci-numero" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{e.titre}</h3>
              <p>
                <Texte>{e.texte}</Texte>
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Ligne({ oui, children }) {
  return (
    <li className={oui ? "" : "ci-estompe"}>
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
    <section className="ci-section ci-comparo" aria-labelledby="ci-comparo-titre">
      <div className="ci-contenant">
        <h2 id="ci-comparo-titre">Le prix d'un voisin. Le reçu en plus.</h2>
        <p className="ci-intro">
          Payer comptant quelqu'un du coin, c'est abordable, mais sans facture, pas de crédit d'impôt. Une compagnie
          émet une facture, mais à prix commercial. Snowro combine les deux avantages.
        </p>
        <div className="ci-cartes-comparo">
          {options.map((o) => (
            <div key={o.titre} className={`ci-carte-option ${o.vedette ? "ci-carte-option--vedette" : ""}`}>
              {o.vedette && <span className="ci-ruban">Snowro</span>}
              <h3>{o.titre}</h3>
              <p className="ci-prix-ligne">{o.prix}</p>
              <ul>
                {o.lignes.map(([oui, texte]) => (
                  <Ligne key={texte} oui={oui}>
                    {texte}
                  </Ligne>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BlocAidants() {
  return (
    <section className="ci-section" aria-labelledby="ci-aidants-titre">
      <div className="ci-contenant">
        <div className="ci-aidants">
          <h2 id="ci-aidants-titre">Vous organisez le déneigement d'un parent?</h2>
          <p>
            Votre mère ou votre père veut rester dans sa maison, et c'est vous qui vous occupez de la logistique. Créez
            son profil Snowro, choisissez le déneigeur avec lui ou elle, et suivez chaque passage à distance. Vous avez
            l'esprit tranquille, votre parent garde son autonomie.
          </p>
          <p className="ci-precision">
            Bon à savoir&nbsp;: pour que le crédit s'applique, les dépenses doivent être payées par la personne de 70
            ans ou plus (ou son conjoint). Snowro vous permet de gérer le compte de votre parent tout en gardant son
            mode de paiement à son nom.
          </p>
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
    <section className="ci-section" aria-labelledby="ci-admissibilite-titre">
      <div className="ci-contenant">
        <h2 id="ci-admissibilite-titre">L'admissibilité en bref</h2>
        <p className="ci-intro">
          Les grandes conditions du crédit d'impôt pour maintien à domicile des aînés, telles que décrites par Revenu
          Québec.
        </p>
        <ul className="ci-criteres">
          {criteres.map((c) => (
            <li key={c} className="ci-critere">
              <span className="ci-coche" aria-hidden="true">
                ✓
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// details/summary natifs : clavier (Entrée, Espace) et lecteurs d'écran sans
// code supplémentaire.
export function FaqCredit() {
  return (
    <section className="ci-section ci-faq" id="faq" aria-labelledby="ci-faq-titre">
      <div className="ci-contenant">
        <h2 id="ci-faq-titre">Vos questions sur le crédit</h2>
        <p className="ci-intro">
          Les réponses ci-dessous résument l'information publiée par Revenu Québec. Pour votre situation personnelle,
          consultez Revenu Québec ou un professionnel.
        </p>
        {FAQ.map(({ q, r }, i) => (
          <details
            key={q}
            onToggle={(e) => e.currentTarget.open && mesurer("credit_faq_ouverture", { question: i + 1 })}
          >
            <summary>{q}</summary>
            <div className="ci-reponse">
              {r.map((p) => (
                <p key={p}>
                  <Texte>{p}</Texte>
                </p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export function CtaFinal() {
  return (
    <section className="ci-section ci-final-cta" aria-labelledby="ci-final-titre">
      <div className="ci-contenant">
        <h2 id="ci-final-titre">L'hiver s'en vient. Votre remboursement aussi.</h2>
        <p className="ci-intro">
          Trouvez votre déneigeur maintenant, demandez vos versements anticipés avant le{" "}
          <Texte>{C.dateLimiteVersementsAnticipes}</Texte>, et recevez votre crédit pendant l'hiver plutôt qu'au
          printemps.
        </p>
        <BoutonDeneigeur emplacement="final" />
      </div>
    </section>
  );
}

export function PiedCredit() {
  return (
    <footer className="ci-pied">
      <div className="ci-contenant">
        <p className="ci-avis">
          L'information présentée sur cette page est de nature générale et ne constitue pas un conseil fiscal. Les
          paramètres du crédit d'impôt pour maintien à domicile des aînés (taux de {TAUX} en {C.annee}, seuils et
          plafonds) proviennent de Revenu Québec et peuvent changer. Chaque situation est unique&nbsp;: vérifiez votre
          admissibilité auprès de Revenu Québec ou d'un professionnel.
        </p>
        <ul>
          <li>
            <LienExterne href={LIENS_REVENU_QUEBEC.credit}>Revenu Québec, crédit pour maintien à domicile</LienExterne>
          </li>
          <li>
            <LienExterne href={LIENS_REVENU_QUEBEC.demande}>Demander le crédit et les versements anticipés</LienExterne>
          </li>
          <li>
            <Link to="/">snowro.com</Link>
          </li>
          <li>
            <Link to="/confidentialite">Confidentialité</Link>
          </li>
          <li>
            <Link to="/conditions">Conditions</Link>
          </li>
        </ul>
        <p className="ci-version">© Snowro · Québec · {VERSION_PAGE_CREDIT}</p>
        <VersionFooter className="ci-version-site" />
      </div>
    </footer>
  );
}
