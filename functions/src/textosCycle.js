import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { db } from "./admin.js";
import { URL_SITE } from "./paiements.js";
import { SECRETS_SMS, envoyerTexto } from "./sms.js";

// Textos au client quand sa demande change d'étape (consentement
// « notificationsSMS » et numéro vérifiés, voir sms.js) :
// - acceptée (matchee) : qui s'en occupe ;
// - faite : 12 heures pour confirmer ou signaler un problème.
// Jamais l'adresse ni le contenu des messages.
export function texteEtape({ statut, demande, lien }) {
  const qui = demande.deneigeurPrenom || "Un déneigeur de quartier";
  if (statut === "matchee") return `Snowro : ${qui} s'occupe de votre demande « ${demande.titre} ». ${lien}`;
  if (statut === "faite") {
    return `Snowro : ${qui} a terminé « ${demande.titre} ». Vous avez 12 h pour confirmer ou signaler un problème : ${lien}`;
  }
  return null;
}

export const textosCycleDemande = onDocumentUpdated(
  { document: "demandes/{demandeId}", region: "northamerica-northeast1", secrets: SECRETS_SMS },
  async (event) => {
    const avant = event.data?.before?.data();
    const apres = event.data?.after?.data();
    if (!avant || !apres || avant.statut === apres.statut) return;
    const corps = texteEtape({ statut: apres.statut, demande: apres, lien: `${URL_SITE.value()}/tableau-de-bord?mode=client` });
    if (!corps || !apres.donneurOuvrageId) return;
    const client = (await db.doc(`users/${apres.donneurOuvrageId}`).get()).data();
    await envoyerTexto(client, corps, { contexte: `demande ${event.params.demandeId}, ${apres.statut}` });
  },
);
