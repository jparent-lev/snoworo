import { ID_MESURE, ouvrirPreferencesMesure } from "../lib/mesure";

// Lien de pied de page « Témoins » : rouvre le bandeau de consentement pour
// accepter ou retirer la mesure d'audience. Absent si la mesure est inactive.
export default function LienTemoins({ className = "" }) {
  if (!ID_MESURE) return null;
  return (
    <button type="button" className={`lien-temoins ${className}`} onClick={ouvrirPreferencesMesure}>
      Témoins
    </button>
  );
}
