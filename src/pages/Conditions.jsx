import { Link } from "react-router-dom";
import PageLegale from "../components/PageLegale";
import { INFOS_LEGALES } from "../lib/legal";

// Conditions d'utilisation — doivent rester cohérentes avec la FAQ
// (landing/FaqAccordion.jsx : premier qui accepte, paiement retenu, absence =
// remboursement) et avec les frais lus depuis config/frais (jamais de chiffre
// codé en dur ici, pour la même raison que FeeCalculator).
export default function Conditions() {
  const { nomLegal, courriel, miseAJour } = INFOS_LEGALES;
  const lienCourriel = <a href={`mailto:${courriel}`}>{courriel}</a>;

  return (
    <PageLegale surtitre="Légal" titre="Conditions d'utilisation" miseAJour={miseAJour}>
      <div className="page-legale__encadre">
        <p>
          <strong>Où en est Snowro :</strong> le service n'est pas encore ouvert. Pour l'instant, le site sert
          à rejoindre la liste d'attente et à nous écrire. Les sections sur les demandes et les paiements
          décrivent comment le service fonctionnera à son ouverture; on te redemandera d'accepter ces
          conditions au moment de créer ton compte.
        </p>
      </div>

      <h2>1. Qui on est</h2>
      <p>
        Snowro est une plateforme exploitée à Québec par la société {nomLegal} (« Snowro », « on », « nous »). En utilisant
        le site ou l'application, tu acceptes ces conditions et notre{" "}
        <Link to="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>2. Ce que fait Snowro (et ce qu'il ne fait pas)</h2>
      <p>
        Snowro met en contact des personnes qui ont besoin de faire déneiger une entrée, un balcon ou un
        stationnement (les « clients ») avec des personnes de leur ville prêtes à le faire (les « déneigeurs de
        quartier »), et s'occupe du paiement entre les deux.
      </p>
      <p>
        Snowro n'est pas une entreprise de déneigement. On ne fait pas le déneigement nous-mêmes, et les
        déneigeurs de quartier ne sont ni nos employés, ni nos sous-traitants, ni nos mandataires : chacun
        décide librement des demandes qu'il accepte, sans horaire ni obligation de notre part. Il n'y a pas de
        contrat de saison : chaque job est une entente ponctuelle entre le client et le déneigeur de quartier.
      </p>

      <h2>3. Ton compte</h2>
      <ul>
        <li>Tu dois avoir 18 ans ou plus pour créer un compte, publier une demande ou déneiger.</li>
        <li>Les renseignements que tu fournis doivent être exacts et à jour, y compris l'adresse à déneiger.</li>
        <li>
          Ton compte est personnel. Tu es responsable de ce qui s'y fait; avise-nous sans délai si tu crois que
          quelqu'un d'autre y a accès.
        </li>
      </ul>

      <h2>4. Pour les clients</h2>
      <ul>
        <li>
          Tu publies ta demande avec l'adresse, le montant que tu offres et le moment qui te convient. Tu peux
          augmenter ton offre en tout temps tant que personne ne l'a acceptée.
        </li>
        <li>
          La demande est montrée aux déneigeurs de quartier disponibles dans ta ville. Le premier qui l'accepte
          la prend.
        </li>
        <li>
          Tu paies le montant offert par carte au moment du match. Il est retenu jusqu'à ce que la job soit
          confirmée faite. Il est alors versé au déneigeur de quartier. Tu reçois un reçu
          automatiquement.
        </li>
        <li>
          Si le déneigeur de quartier ne se présente pas, tu es remboursé au complet.
        </li>
        <li>
          Tu peux annuler une demande sans frais tant que personne ne l'a acceptée. Une fois qu'elle est
          acceptée, l'annulation se fait par entente avec le déneigeur de quartier; en cas de désaccord,
          écris-nous et on tranche selon les faits.
        </li>
        <li>
          Tu t'engages à rendre l'endroit accessible et à signaler tout ce qui pourrait être dangereux ou
          fragile (marches glacées, objets cachés sous la neige, voiture à ne pas accrocher, etc.).
        </li>
      </ul>

      <h2>5. Pour les déneigeurs de quartier</h2>
      <ul>
        <li>
          Avant d'accepter une première demande, tu dois créer ton compte de paiement auprès de Stripe, qui
          vérifie ton identité.
        </li>
        <li>
          En acceptant une demande, tu t'engages à faire la job décrite, au moment convenu, avec soin et de
          façon sécuritaire, en utilisant ton propre équipement.
        </li>
        <li>
          Tu reçois le montant offert, moins les frais de service de Snowro, dans ton compte de banque après la
          job. Les frais sont toujours affichés avant que tu acceptes (voir aussi la section{" "}
          <a href="/#frais">Frais</a>).
        </li>
        <li>
          Si tu ne te présentes pas, tu ne reçois rien pour cette demande, tu en perds l'accès, et des absences
          répétées peuvent mener à la suspension de ton compte.
        </li>
        <li>
          Tu travailles à ton compte : c'est à toi de déclarer tes revenus et, s'il y a lieu, de percevoir et
          remettre les taxes applicables. Snowro ne te fournit ni assurance ni équipement.
        </li>
      </ul>

      <h2>6. Frais</h2>
      <p>
        Publier une demande et s'inscrire comme déneigeur de quartier sont gratuits. Snowro se rémunère par des
        frais de service retenus sur le montant versé au déneigeur de quartier, selon le barème affiché sur le
        site et dans l'application au moment du match. Si le barème change, le nouveau s'applique seulement
        aux demandes publiées après le changement.
      </p>

      <h2>7. Appréciations</h2>
      <p>
        Après chaque job, le client peut laisser une appréciation. Elle doit être honnête et porter sur la job
        elle-même. On peut retirer une appréciation fausse, injurieuse ou sans lien avec la job.
      </p>

      <h2>8. Ce qui n'est pas permis</h2>
      <ul>
        <li>Fournir de faux renseignements ou te faire passer pour quelqu'un d'autre.</li>
        <li>
          Contourner la plateforme pour le paiement d'une job trouvée sur Snowro, ou utiliser les coordonnées
          d'un autre utilisateur pour autre chose que cette job.
        </li>
        <li>Harceler, menacer ou discriminer un autre utilisateur.</li>
        <li>
          Nuire au fonctionnement du site, en extraire les données de façon automatisée ou tenter d'accéder à
          des renseignements qui ne te concernent pas.
        </li>
      </ul>
      <p>
        On peut suspendre ou fermer un compte qui ne respecte pas ces conditions. Sauf urgence ou situation
        grave, on t'avise d'abord et on te donne la chance de t'expliquer.
      </p>

      <h2>9. Dommages et litiges entre utilisateurs</h2>
      <p>
        Le déneigeur de quartier est responsable de la job qu'il fait et des dommages qu'il cause en la
        faisant. Si un problème survient (job mal faite, bris, désaccord sur ce qui était prévu), écris-nous :
        on peut retenir le paiement le temps d'examiner la situation, et rembourser le client en tout ou en
        partie selon les faits.
      </p>

      <h2>10. Notre responsabilité</h2>
      <p>
        On fait de notre mieux pour que Snowro fonctionne bien, en tout temps, mais on ne peut pas garantir
        qu'un déneigeur de quartier sera disponible pour chaque demande, surtout lors d'une grosse tempête.
        Dans la mesure permise par la loi, Snowro n'est pas responsable des dommages causés par un utilisateur
        à un autre. Rien dans ces conditions ne limite les droits que te reconnaît la Loi sur la protection du
        consommateur, ni notre responsabilité pour notre propre faute.
      </p>

      <h2>11. Snowro Pro</h2>
      <p>
        L'abonnement Snowro Pro, destiné aux entreprises de déneigement, sera encadré par des conditions
        distinctes, présentées au moment de s'abonner.
      </p>

      <h2>12. Changements à ces conditions</h2>
      <p>
        On peut modifier ces conditions. La nouvelle version est publiée ici avec sa date de mise à jour et,
        pour un changement important, on t'avise par courriel ou dans l'application au moins 30 jours avant
        qu'il s'applique. Tu peux alors fermer ton compte sans frais si tu n'es pas d'accord.
      </p>

      <h2>13. Loi applicable</h2>
      <p>
        Ces conditions sont régies par les lois du Québec et les lois du Canada qui s'y appliquent. Tu conserves
        tous les recours que la loi te reconnaît, y compris devant les tribunaux de ton lieu de résidence.
      </p>

      <h2>14. Nous joindre</h2>
      <p>
        Une question sur ces conditions ? Écris à {lienCourriel} ou passe par la page{" "}
        <Link to="/nous-ecrire">Nous écrire</Link>.
      </p>
    </PageLegale>
  );
}
