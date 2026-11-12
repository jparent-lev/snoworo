import { PAIEMENT_REEL, profilStripe } from "./paiements";
import { ROLE_DENEIGEUR } from "./mode";

const TEXTOS = import.meta.env.VITE_TEXTOS === "1";

// Étapes de démarrage du déneigeur, affichées tant qu'une étape obligatoire
// manque (tableau de bord) et signalées sur le lien « Paramètres » de
// l'en-tête. Chaque étape mène à sa section des paramètres (ancre).
// Le client n'a aucune étape obligatoire : sa carte est demandée à la
// publication de sa première demande.
export function etapesDemarrage(profile) {
  if (!(profile?.role ?? []).includes(ROLE_DENEIGEUR)) return [];
  const statut = profilStripe(profile)?.connectStatus ?? "non_demarre";
  return [
    {
      cle: "adresse",
      titre: "Ajouter votre adresse de service",
      detail: "Elle détermine votre ville : vous ne voyez que les demandes de votre ville.",
      fait: Boolean(profile.villeGeoId),
      requis: true,
      lien: "/parametres#adresse",
      action: "Ajouter mon adresse",
    },
    PAIEMENT_REEL && {
      cle: "versement",
      titre: "Configurer votre compte de versement",
      detail:
        statut === "non_demarre"
          ? "Stripe vérifie votre identité et votre compte bancaire, une seule fois. L'argent de vos demandes y est versé."
          : "Commencé : terminez l'inscription chez Stripe (identité, compte bancaire).",
      fait: statut === "actif",
      requis: true,
      lien: "/parametres#paiement",
      action: statut === "non_demarre" ? "Configurer" : "Terminer",
    },
    TEXTOS && {
      cle: "cellulaire",
      titre: "Vérifier votre cellulaire",
      detail: "Facultatif : pour recevoir un texto dès qu'une demande est publiée près de chez vous.",
      fait: Boolean(profile.telephoneVerifie),
      requis: false,
      lien: "/parametres#cellulaire",
      action: "Ajouter mon cellulaire",
    },
  ].filter(Boolean);
}

export const etapesRequisesManquantes = (profile) => etapesDemarrage(profile).filter((e) => e.requis && !e.fait).length;
