import { useEffect, useState } from "react";
import { ecouterConfigFrais } from "../../lib/config";
import { formatArgent } from "../../lib/formatArgent";
import "./FeeCalculator.css";

// design_handoff_snowro_site/README.md § 4. fraisFixe/fraisPct ne sont jamais
// codés en dur ici — lus depuis config/frais, la même source que la Cloud
// Function de paiement, pour que le site et l'app affichent toujours le même
// chiffre. Recalcul immédiat sur input/change, sans debounce (calcul trivial).
export default function FeeCalculator() {
  const [{ fraisFixe, fraisPct }, setFrais] = useState({ fraisFixe: 2, fraisPct: 8 });
  const [montant, setMontant] = useState(45);

  useEffect(() => ecouterConfigFrais(setFrais), []);

  const frais = fraisFixe + (montant * fraisPct) / 100;
  const net = montant - frais;

  return (
    <div className="fee-calc">
      <div className="fee-calc__ligne-haut">
        <span className="eyebrow fee-calc__eyebrow">Tu offres</span>
        <span className="fee-calc__montant">{montant} $</span>
      </div>
      <input
        type="range"
        min="20"
        max="200"
        step="5"
        value={montant}
        onChange={(e) => setMontant(Number(e.target.value))}
        className="fee-calc__curseur"
        aria-label="Montant offert"
      />
      <div className="fee-calc__detail">
        <div className="fee-calc__rangee">
          <span>
            Frais Snowro <span>({formatArgent(fraisFixe)} + {fraisPct} %)</span>
          </span>
          <span className="fee-calc__valeur">{formatArgent(frais)}</span>
        </div>
        <div className="fee-calc__rangee">
          <span>Le déneigeur reçoit</span>
          <span className="fee-calc__valeur fee-calc__valeur--net">{formatArgent(net)}</span>
        </div>
      </div>
      <p className="fee-calc__mention">
        Exemple à titre indicatif — la structure finale sera affichée avant le lancement, et elle sera
        celle-là ou plus basse.
      </p>
    </div>
  );
}
