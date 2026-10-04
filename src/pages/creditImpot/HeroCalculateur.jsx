import { useRef, useState } from "react";
import { CREDIT_MAD as C, CURSEUR, creditPour, dollars, pourcent } from "../../config/creditImpot";
import { mesurer } from "../../lib/mesure";
import { BoutonDeneigeur, Texte } from "./elements";

// Neige décorative : quelques flocons placés au hasard une seule fois. Rien
// n'est créé si l'utilisateur préfère réduire les animations (le CSS les
// masque aussi).
function flocons() {
  const reduit = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduit) return [];
  return Array.from({ length: 14 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    fontSize: `${10 + Math.random() * 14}px`,
    opacity: (0.25 + Math.random() * 0.4).toFixed(2),
    animationDuration: `${9 + Math.random() * 10}s`,
    animationDelay: `${-Math.random() * 18}s`,
  }));
}

export default function HeroCalculateur() {
  const [montant, setMontant] = useState(CURSEUR.defaut);
  const [neige] = useState(flocons);
  const premiereInteraction = useRef(true);
  const credit = creditPour(montant);
  const pct = ((montant - CURSEUR.min) / (CURSEUR.max - CURSEUR.min)) * 100;
  const taux = pourcent(C.taux);

  function changer(e) {
    setMontant(Number(e.target.value));
    if (premiereInteraction.current) {
      premiereInteraction.current = false;
      mesurer("credit_curseur_premiere_interaction");
    }
  }

  return (
    <div className="ci-hero">
      <div className="ci-neige" aria-hidden="true">
        {neige.map(({ id, ...style }) => (
          <span key={id} className="ci-flocon" style={style}>
            ❄
          </span>
        ))}
      </div>
      <div className="ci-contenant">
        <h1>
          Québec vous rembourse <strong>{taux}</strong> de votre déneigement.
        </h1>
        <p className="ci-sous-titre">
          Si vous avez 70 ans ou plus, le crédit d'impôt pour maintien à domicile des aînés couvre {taux} du coût de
          votre déneigement en {C.annee}. Snowro vous jumelle avec un déneigeur fiable de votre quartier et vous remet
          les factures qu'il faut pour le réclamer.
        </p>

        <div className="ci-calculateur" id="calculateur">
          <p className="ci-question" id="ci-question">
            Combien payez-vous pour votre déneigement cet hiver?
          </p>
          <p className="ci-indice">
            Glissez le curseur pour ajuster le montant de votre contrat ou de vos paiements pour la saison.
          </p>

          <div className="ci-ligne-curseur">
            <input
              type="range"
              min={CURSEUR.min}
              max={CURSEUR.max}
              step={CURSEUR.pas}
              value={montant}
              onChange={changer}
              aria-label="Coût annuel de votre déneigement en dollars"
              aria-valuetext={`${montant} dollars`}
              style={{ "--pct": `${pct}%` }}
            />
            <span className="ci-montant-contrat" aria-hidden="true">
              {dollars(montant)}
            </span>
          </div>

          <div className="ci-resultats">
            <div className="ci-resultat">
              <p className="ci-etiquette">Crédit d'impôt de {taux}</p>
              <p className="ci-valeur">{dollars(credit)}</p>
            </div>
            <div className="ci-resultat ci-resultat--final">
              <p className="ci-etiquette">Ce que votre déneigement vous coûte réellement</p>
              <p className="ci-valeur">{dollars(montant - credit)}</p>
            </div>
          </div>

          <p className="ci-note">
            Estimation basée sur le taux de {taux} en vigueur en {C.annee}. Le crédit peut être réduit si le revenu
            familial dépasse environ {dollars(C.seuilReductionRevenu)}. Information générale et non un conseil
            fiscal&nbsp;: les conditions complètes sont sur le site de Revenu Québec.
          </p>

          <div className="ci-cta-rangee">
            <BoutonDeneigeur emplacement="calculateur" />
            <span className="ci-badge-date">
              <span className="ci-point" aria-hidden="true" />
              <span>
                Versements anticipés&nbsp;: demandez avant le <Texte>{C.dateLimiteVersementsAnticipes}</Texte>
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
