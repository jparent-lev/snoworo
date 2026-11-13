import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { FieldValue } from "firebase-admin/firestore";
import geohash from "ngeohash";
import { db } from "./admin.js";
import { RESEND_API_KEY, echapperHtml, envoyerCourriel, gabaritCourriel } from "./courriels.js";
import { URL_SITE } from "./paiements.js";
import { calculerPaiement, lireFrais } from "./cycleDemande.js";
import { SECRETS_SMS, envoyerTexto, peutRecevoirTextos } from "./sms.js";

// Avertit par courriel (et par texto, voir plus bas) les déneigeurs de quartier de la même ville dès
// qu'une demande est publiée (« Les déneigeurs de quartier disponibles dans
// votre secteur sont avertis tout de suite », accueil).
// - Destinataires : rôle déneigeur, même villeGeoId (jamais une autre ville),
//   courriel connu, avertissements non désactivés dans Paramètres
//   (alertesDemandesCourriel: false), sauf la personne qui publie.
// - Pas de rafale : au plus un courriel par déneigeur toutes les 20 minutes
//   (derniereAlerteDemandeAt) ; pendant une tempête, il voit les autres
//   demandes en ouvrant son tableau de bord.
// - Texto aussi (même règle de 20 minutes) pour ceux qui ont accordé le
//   consentement « notificationsSMS » et vérifié leur numéro (sms.js).
// - Rien d'identifiant dans le courriel : quartier, distance approximative,
//   type de travail, moment souhaité et montant ; jamais l'adresse.
export const ROLE_DENEIGEUR = "deneigeur_x";
export const DELAI_ENTRE_ALERTES_MS = 20 * 60 * 1000;

const formatMoment = new Intl.DateTimeFormat("fr-CA", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Toronto",
});
const formatArgent = (n) => `${n.toLocaleString("fr-CA", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} $`;

export function distanceKm(hashA, hashB) {
  if (!hashA || !hashB) return null;
  const a = geohash.decode(hashA);
  const b = geohash.decode(hashB);
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function composerAlerte({ prenom, demande, montantDeneigeur, km, lien, ville }) {
  const ou = demande.quartier || demande.ville || ville || "votre ville";
  const distance = km == null ? null : km < 1 ? "à moins de 1 km de chez vous" : `à ${km.toFixed(1).replace(".", ",")} km de chez vous`;
  const moment = demande.dateHeureSouhaitee?.toDate ? formatMoment.format(demande.dateHeureSouhaitee.toDate()) : null;
  const titre = `Nouvelle demande à ${ou}`;
  const details = [
    `« ${demande.titre} »${distance ? `, ${distance}` : ""}.`,
    moment ? `Souhaitée : ${moment}.` : null,
    `Pour vous : ${formatArgent(montantDeneigeur)}, frais déjà déduits${demande.outilsFournis ? " (pelle ou grattoir sur place)" : ""}.`,
  ].filter(Boolean);
  const intro = `${prenom ? `Bonjour ${prenom}, une` : "Une"} demande vient d'être publiée près de chez vous. Le premier déneigeur qui accepte s'en occupe.`;
  const pied =
    `Vous recevez ce courriel parce que vous êtes déneigeur de quartier sur Snowro${ville ? ` à ${ville}` : ""}. ` +
    "Pour ne plus recevoir ces avis, désactivez-les dans vos paramètres.";
  return {
    sujet: `Nouvelle demande à ${ou} : ${formatArgent(montantDeneigeur)} pour vous`,
    html: gabaritCourriel({
      titre: echapperHtml(titre),
      paragraphes: [
        echapperHtml(intro),
        ...details.map(echapperHtml),
        `<a href="${echapperHtml(lien)}" style="display:inline-block;padding:12px 20px;background:#9E4E23;color:#FFFDF8;border-radius:999px;font-weight:700;text-decoration:none;">Voir la demande</a>`,
      ],
      piedDePage: echapperHtml(pied),
    }),
    texte: [titre, "", intro, "", ...details, "", `Voir la demande : ${lien}`, "", pied].join("\n"),
  };
}

export const avertirDeneigeursNouvelleDemande = onDocumentCreated(
  { document: "demandes/{demandeId}", region: "northamerica-northeast1", secrets: [RESEND_API_KEY, ...SECRETS_SMS] },
  async (event) => {
    const demande = event.data?.data();
    if (!demande || demande.statut !== "ouverte" || !demande.villeGeoId) return;
    const { demandeId } = event.params;

    const candidats = await db
      .collection("users")
      .where("villeGeoId", "==", demande.villeGeoId)
      .where("role", "array-contains", ROLE_DENEIGEUR)
      .limit(500)
      .get();
    const { montantDeneigeur } = calculerPaiement(demande.remunerationOfferte, await lireFrais());
    const lien = `${URL_SITE.value()}/tableau-de-bord?mode=deneigeur`;
    const maintenant = Date.now();

    let envoyes = 0;
    for (const doc of candidats.docs) {
      const u = doc.data();
      if (doc.id === demande.donneurOuvrageId) continue;
      const parCourriel = Boolean(u.email) && u.alertesDemandesCourriel !== false;
      const parTexto = peutRecevoirTextos(u);
      if (!parCourriel && !parTexto) continue;
      if (maintenant - (u.derniereAlerteDemandeAt?.toMillis?.() ?? 0) < DELAI_ENTRE_ALERTES_MS) continue;
      const km = distanceKm(u.addressGeohash, demande.adresseGeohash);
      let averti = false;
      if (parCourriel) {
        const { sujet, html, texte } = composerAlerte({
          prenom: (u.displayName ?? "").split(" ")[0],
          demande,
          montantDeneigeur,
          km,
          lien,
          ville: u.ville,
        });
        try {
          await envoyerCourriel({
            a: u.email,
            sujet,
            html,
            texte,
            cleIdempotence: `alerte-${demandeId}-${doc.id}`,
            type: "nouvelle_demande",
          });
          averti = true;
        } catch (err) {
          logger.error(`Avis de nouvelle demande ${demandeId} non envoyé à ${doc.id} : ${err.message}`);
        }
      }
      if (parTexto) {
        const ou = demande.quartier || demande.ville || u.ville || "votre ville";
        const corps = `Snowro : nouvelle demande à ${ou}${km == null ? "" : km < 1 ? " (moins de 1 km)" : ` (${km.toFixed(1).replace(".", ",")} km)`}, ${formatArgent(montantDeneigeur)} pour vous. ${lien}`;
        if (await envoyerTexto(u, corps, { contexte: `nouvelle demande ${demandeId}` })) averti = true;
      }
      if (averti) {
        await doc.ref.update({ derniereAlerteDemandeAt: FieldValue.serverTimestamp() });
        envoyes += 1;
      }
    }
    await event.data.ref.update({ alerte: { envoyes, at: FieldValue.serverTimestamp() } });
    logger.info(`Demande ${demandeId} : ${envoyes} déneigeur(s) averti(s) par courriel.`);
  },
);
