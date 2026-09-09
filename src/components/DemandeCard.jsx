import { useState } from "react";
import SnowroLockup from "./brand/SnowroLockup";
import { accepterDemande } from "../lib/demandes";
import "./DemandeCard.css";

const formatMontant = (montant) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(montant);

// Écran X — carte de demande. Layout, copie et états figés dans
// design_handoff_snowro_brand/README.md (§ 2. Écran X — carte de demande).
export default function DemandeCard({ demande, deneigeurId, feeCents = 300 }) {
  const [statut, setStatut] = useState(demande.statut === "ouverte" ? "ouverte" : "deja_prise");

  async function accepter() {
    setStatut("en_cours_acceptation");
    try {
      await accepterDemande(demande.id, deneigeurId, demande.donneurOuvrageId);
      setStatut("match");
    } catch {
      // Rejeté par les Firestore rules : quelqu'un d'autre a déjà accepté.
      // Ton franc, jamais de blâme — pas de message d'erreur générique.
      setStatut("deja_prise");
    }
  }

  return (
    <div className="demande-card__cadre">
      <div className="demande-card__entete">
        <SnowroLockup qualifiant="X" size={30} />
      </div>

      {statut === "deja_prise" ? (
        <div className="demande-card__deja-prise">
          <p>Déjà prise — une autre job à 600 m</p>
        </div>
      ) : (
        <>
          <div className="demande-card__carte">
            <p className="eyebrow demande-card__surtitre">
              À {demande.distanceM} M — {demande.quartier?.toUpperCase()}
            </p>
            <h2 className="demande-card__titre">{demande.titre}</h2>
            <p className="demande-card__corps">{demande.description}</p>
            <div className="demande-card__prix-ligne">
              <span className="demande-card__prix">{formatMontant(demande.montant)}</span>
              <span className="demande-card__offert-par">offert par {demande.donneurPrenom}</span>
            </div>
          </div>

          <button
            type="button"
            className="demande-card__bouton"
            onClick={accepter}
            disabled={statut !== "ouverte"}
          >
            {statut === "en_cours_acceptation" ? "Confirmation…" : statut === "match" ? "Job confirmée" : "Je prends la job"}
          </button>

          <p className="demande-card__mention">
            Tu paies {(feeCents / 100).toFixed(0)} $ de mise en relation, seulement si ça se conclut.
          </p>
        </>
      )}
    </div>
  );
}
