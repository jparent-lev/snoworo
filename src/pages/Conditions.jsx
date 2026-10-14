import { Link } from "react-router-dom";
import PageLegale from "../components/PageLegale";
import { INFOS_LEGALES } from "../lib/legal";

// Conditions d'utilisation — doivent rester cohérentes avec la FAQ
// (landing/FaqAccordion.jsx : premier qui accepte, paiement retenu, absence =
// remboursement) et avec les frais lus depuis config/frais (jamais de chiffre
// codé en dur ici, pour la même raison que FeeCalculator).
export default function Conditions() {
  const { nomLegal, miseAJour } = INFOS_LEGALES;

  return (
    <PageLegale surtitre="Légal" titre="Conditions d'utilisation" miseAJour={miseAJour}>
      <div className="page-legale__encadre">
        <p>
          <strong>Où en est Snowro :</strong> le service n'est pas encore ouvert. Pour l'instant, le site sert
          à rejoindre la liste d'attente et à nous écrire. Les sections sur les demandes et les paiements
          décrivent comment le service fonctionnera à son ouverture; nous vous demanderons de nouveau d'accepter ces
          conditions au moment de créer votre compte.
        </p>
      </div>

      <h2>1. Qui nous sommes</h2>
      <p>
        Snowro est une plateforme exploitée à Québec par la société {nomLegal} (« Snowro », « nous »). En utilisant
        le site ou l'application, vous acceptez ces conditions et notre{" "}
        <Link to="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>2. Ce que fait Snowro (et ce qu'il ne fait pas)</h2>
      <p>
        Snowro met en contact des personnes qui ont besoin de faire déneiger une entrée, un balcon ou un
        stationnement (les « clients ») avec des personnes de leur ville prêtes à le faire (les « déneigeurs de
        quartier »), et s'occupe du paiement entre les deux.
      </p>
      <p>
        Snowro n'est pas une entreprise de déneigement. Nous ne faisons pas le déneigement nous-mêmes, et les
        déneigeurs de quartier ne sont ni nos employés, ni nos sous-traitants, ni nos mandataires : chacun
        décide librement des demandes qu'il accepte, sans horaire imposé ni obligation de notre part. Il n'y a pas de
        contrat de saison : chaque demande est une entente ponctuelle entre le client et le déneigeur de quartier.
      </p>

      <h2>3. Votre compte</h2>
      <ul>
        <li>Vous devez avoir 18 ans ou plus pour créer un compte, publier une demande ou déneiger.</li>
        <li>Les renseignements que vous fournissez doivent être exacts et à jour, y compris l'adresse à déneiger.</li>
        <li>
          Votre compte est personnel. Vous êtes responsable de ce qui s'y fait; avisez-nous sans délai si vous croyez que
          quelqu'un d'autre y a accès.
        </li>
      </ul>

      <h2>4. Pour les clients</h2>
      <ul>
        <li>
          Vous publiez votre demande avec l'adresse, le montant que vous offrez et le moment qui vous convient. Vous pouvez
          augmenter votre offre en tout temps tant que personne ne l'a acceptée.
        </li>
        <li>
          La demande est montrée aux déneigeurs de quartier disponibles dans votre ville. Le premier qui l'accepte
          la prend.
        </li>
        <li>
          Vous enregistrez une carte en publiant votre demande; rien n'est prélevé à ce moment-là. Le montant
          offert est prélevé quand un déneigeur de quartier accepte, puis retenu par Snowro jusqu'à ce que la
          demande soit confirmée faite. Il est alors versé au déneigeur de quartier. Vous recevez un reçu par
          courriel au moment du prélèvement.
        </li>
        <li>
          Si le déneigeur de quartier ne se présente pas, vous êtes remboursé en totalité.
        </li>
        <li>
          Vous pouvez annuler une demande sans frais tant que personne ne l'a acceptée. Une fois qu'elle est
          acceptée, elle ne peut plus être annulée, ni par vous ni par le déneigeur de quartier. En cas de
          problème (absence, travail incomplet), utilisez « Signaler un problème » : le paiement reste retenu
          et nous tranchons selon les faits.
        </li>
        <li>
          Vous vous engagez à rendre l'endroit accessible et à signaler tout ce qui pourrait être dangereux ou
          fragile (marches glacées, objets cachés sous la neige, voiture à ne pas accrocher, etc.).
        </li>
      </ul>

      <h2>5. Pour les déneigeurs de quartier</h2>
      <ul>
        <li>
          Avant d'accepter une première demande, vous devez créer votre compte de paiement auprès de Stripe, qui
          vérifie votre identité.
        </li>
        <li>
          En acceptant une demande, vous vous engagez à faire la demande décrite, au moment convenu, avec soin et de
          façon sécuritaire, en utilisant votre propre équipement.
        </li>
        <li>
          Avant de marquer une demande faite, vous prenez sur place de 1 à 3 photos du travail terminé. Elles ne
          montrent que l'endroit déneigé : jamais de personne ni de plaque d'immatriculation reconnaissable.
        </li>
        <li>
          Vous recevez le montant offert, moins les frais de service de Snowro, dans votre compte bancaire après la
          demande. Les frais sont toujours affichés avant que vous acceptiez (voir aussi la section{" "}
          <a href="/#frais">Frais</a>).
        </li>
        <li>
          Si vous ne vous présentez pas, vous ne recevez rien pour cette demande, vous en perdez l'accès, et des absences
          répétées peuvent mener à la suspension de votre compte.
        </li>
        <li>
          Vous travaillez à votre compte : il vous incombe de déclarer vos revenus et, s'il y a lieu, de percevoir et
          de remettre les taxes applicables. Snowro ne vous fournit ni assurance ni équipement.
        </li>
      </ul>

      <h2>6. Frais</h2>
      <p>
        Publier une demande et s'inscrire comme déneigeur de quartier sont gratuits. Snowro se rémunère par des
        frais de service retenus sur le montant versé au déneigeur de quartier, selon le barème affiché sur le
        site et dans l'application au moment du jumelage. Si le barème change, le nouveau s'applique seulement
        aux demandes publiées après le changement.
      </p>

      <h2>7. Appréciations</h2>
      <p>
        Après chaque demande, le client peut laisser une appréciation. Elle doit être honnête et porter sur la demande
        elle-même. Nous pouvons retirer une appréciation fausse, injurieuse ou sans lien avec la demande.
      </p>

      <h2>8. Ce qui n'est pas permis</h2>
      <ul>
        <li>Fournir de faux renseignements ou vous faire passer pour quelqu'un d'autre.</li>
        <li>
          Contourner la plateforme pour le paiement d'une demande trouvée sur Snowro, ou utiliser les coordonnées
          d'un autre utilisateur pour autre chose que cette demande.
        </li>
        <li>Harceler, menacer ou discriminer un autre utilisateur.</li>
        <li>
          Nuire au fonctionnement du site, en extraire les données de façon automatisée ou tenter d'accéder à
          des renseignements qui ne vous concernent pas.
        </li>
      </ul>
      <p>
        Nous pouvons suspendre ou fermer un compte qui ne respecte pas ces conditions. Sauf urgence ou situation
        grave, nous vous avisons d'abord et vous donnons la possibilité de vous expliquer.
      </p>

      <h2>9. Dommages et litiges entre utilisateurs</h2>
      <p>
        Le déneigeur de quartier est responsable de la demande qu'il fait et des dommages qu'il cause en la
        faisant. Si un problème survient (demande mal faite, bris, désaccord sur ce qui était prévu), écrivez-nous :
        nous pouvons retenir le paiement le temps d'examiner la situation, et rembourser le client en tout ou en
        partie selon les faits.
      </p>

      <h2>10. Notre responsabilité</h2>
      <p>
        Nous faisons de notre mieux pour que Snowro fonctionne bien, en tout temps, mais nous ne pouvons pas garantir
        qu'un déneigeur de quartier sera disponible pour chaque demande, surtout lors d'une grosse tempête.
        Dans la mesure permise par la loi, Snowro n'est pas responsable des dommages causés par un utilisateur
        à un autre. Rien dans ces conditions ne limite les droits que vous reconnaît la Loi sur la protection du
        consommateur, ni notre responsabilité pour notre propre faute.
      </p>

      <h2>11. Changements à ces conditions</h2>
      <p>
        Nous pouvons modifier ces conditions. La nouvelle version est publiée ici avec sa date de mise à jour et,
        pour un changement important, nous vous avisons par courriel ou dans l'application au moins 30 jours avant
        qu'il s'applique. Vous pouvez alors fermer votre compte sans frais si vous n'êtes pas d'accord.
      </p>

      <h2>12. Loi applicable</h2>
      <p>
        Ces conditions sont régies par les lois du Québec et les lois du Canada qui s'y appliquent. Vous conservez
        tous les recours que la loi vous reconnaît, y compris devant les tribunaux de votre lieu de résidence.
      </p>

      <h2>13. Nous joindre</h2>
      <p>
        Une question sur ces conditions ? Écrivez-nous par la page <Link to="/nous-ecrire">Nous écrire</Link>.
      </p>
    </PageLegale>
  );
}
