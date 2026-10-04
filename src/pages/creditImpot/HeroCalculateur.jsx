import { useRef, useState } from "react";
import { CREDIT_MAD as C, CURSEUR, creditPour, dollars, pourcent } from "../../config/creditImpot";
import { mesurer } from "../../lib/mesure";
import { BoutonDeneigeur } from "./elements";

// Héros dans la bande de ciel de l'accueil : texte à gauche, calculateur à
// droite (même carte que le calculateur de frais de l'accueil).
export default function HeroCalculateur() {
  const [montant, setMontant] = useState(CURSEUR.defaut);
  const premiereInteraction = useRef(true);
  const credit = creditPour(montant);
  const taux = pourcent(C.taux);

  function changer(e) {
    setMontant(Number(e.target.value));
    if (premiereInteraction.current) {
      premiereInteraction.current = false;
      mesurer("credit_curseur_premiere_interaction");
    }
  }

  return (
    <section className="landing__hero">
      <div className="landing__hero-texte">
        <span className="eyebrow">Crédit d'impôt, 70 ans et plus</span>
        <h1 className="landing__hero-titre">
          Québec vous rembourse <span className="ci-accent">{taux}</span> de votre déneigement.
        </h1>
        <p className="landing__hero-chapeau">
          Si vous avez 70 ans ou plus, le crédit d'impôt pour maintien à domicile des aînés couvre {taux} du coût de
          votre déneigement en {C.annee}. Snowro vous jumelle avec un déneigeur fiable de votre quartier et vous remet
          les factures qu'il faut pour le réclamer.
        </p>
        <div className="landing__hero-cta">
          <BoutonDeneigeur emplacement="hero" />
        </div>
        <p className="ci-badge-date">
          <span>Relevé de fin d'année fourni, prêt pour votre déclaration de revenus</span>
        </p>
      </div>

      <div className="ci-calc" id="calculateur">
        <p className="ci-calc__question">Combien payez-vous pour votre déneigement cet hiver?</p>
        <p className="ci-calc__indice">
          Glissez le curseur pour ajuster le total de vos déneigements pour la saison.
        </p>
        <div className="ci-calc__ligne-haut">
          <span className="eyebrow ci-calc__eyebrow">Vous payez</span>
          <span className="ci-calc__montant" aria-hidden="true">
            {dollars(montant)}
          </span>
        </div>
        <input
          type="range"
          className="ci-calc__curseur"
          min={CURSEUR.min}
          max={CURSEUR.max}
          step={CURSEUR.pas}
          value={montant}
          onChange={changer}
          aria-label="Coût annuel de votre déneigement en dollars"
          aria-valuetext={`${montant} dollars`}
        />
        <div className="ci-calc__detail">
          <div className="ci-calc__rangee">
            <span>Crédit d'impôt de {taux}</span>
            <span className="ci-calc__valeur">{dollars(credit)}</span>
          </div>
          <div className="ci-calc__rangee ci-calc__rangee--final">
            <span>Ce que votre déneigement vous coûte réellement</span>
            <span className="ci-calc__valeur ci-calc__valeur--net">{dollars(montant - credit)}</span>
          </div>
        </div>
        <p className="ci-calc__note">
          Estimation basée sur le taux de {taux} en vigueur en {C.annee}. Le crédit peut être réduit si le revenu
          familial dépasse environ {dollars(C.seuilReductionRevenu)}. Information générale et non un conseil
          fiscal&nbsp;: les conditions complètes sont sur le site de Revenu Québec.
        </p>
      </div>
    </section>
  );
}
