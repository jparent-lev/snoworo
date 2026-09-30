import { Link } from "react-router-dom";
import PageLegale from "../components/PageLegale";
import { INFOS_LEGALES } from "../lib/legal";

// Politique de confidentialité — exigée par la Loi 25 (Loi sur la protection
// des renseignements personnels dans le secteur privé, art. 3.2 et 8.2) avant
// toute collecte, y compris la liste d'attente. Doit rester fidèle à ce que le
// code collecte réellement (docs/data-model.md) : un nouveau champ, un
// nouveau fournisseur ou un nouveau type de consentement se reflète ici, avec
// une nouvelle date dans INFOS_LEGALES.miseAJour.
export default function Confidentialite() {
  const { nomLegal, responsableRenseignements, miseAJour } = INFOS_LEGALES;
  // Toute demande passe par le formulaire, sujet présélectionné : elle arrive
  // dans messagesContact avec la date, ce qui aide à respecter le délai de 30 jours.
  const lienFormulaire = <Link to="/nous-ecrire?sujet=renseignements">formulaire Nous écrire</Link>;

  return (
    <PageLegale surtitre="Légal" titre="Politique de confidentialité" miseAJour={miseAJour}>
      <div className="page-legale__encadre">
        <p>
          <strong>En bref :</strong> on collecte le minimum pour te mettre en contact avec un déneigeur de
          quartier (ou avec des clients), te payer ou encaisser ton paiement de façon sécuritaire, et savoir
          quelles villes ouvrir. On ne vend jamais tes renseignements. Tout ce qui est optionnel se retire en
          un clic, et tu peux nous demander en tout temps de voir, corriger ou effacer ce qu'on a sur toi.
        </p>
      </div>

      <h2>Qui est responsable de tes renseignements</h2>
      <p>
        Snowro est exploité à Québec par la société {nomLegal}. La personne responsable de la protection des
        renseignements personnels est {responsableRenseignements}. Pour toute question ou demande liée à
        tes renseignements, écris-lui par le {lienFormulaire} (sujet « Mes renseignements personnels »).
      </p>

      <h2>Ce qu'on collecte, et pourquoi</h2>

      <h3>Liste d'attente</h3>
      <p>
        Ton courriel, ton code postal et ton rôle (client ou déneigeur de quartier). À partir du code postal,
        on déduit ta ville. Ça sert à savoir quelles villes ouvrir en premier et à t'écrire quand Snowro ouvre
        dans ton secteur. Rien d'autre.
      </p>

      <h3>Formulaire « Nous écrire »</h3>
      <p>
        Ton nom (si tu le donnes), ton courriel, le sujet et ton message, pour te répondre et assurer le suivi
        de ta demande.
      </p>

      <h3>Compte Snowro</h3>
      <ul>
        <li>
          <strong>Identité et contact :</strong> ton nom ou prénom d'affichage, ton courriel et, si tu le
          fournis, ton numéro de téléphone.
        </li>
        <li>
          <strong>Localisation :</strong> la position de l'adresse à déneiger (pour une demande) ou de ton
          adresse de service (pour un déneigeur de quartier), enregistrée sous forme de zone approximative, le
          début de ton code postal et la ville qu'on en déduit. On s'en sert uniquement pour montrer une demande
          aux déneigeurs de quartier de la même ville. On n'utilise ta position que lorsque tu la partages
          toi-même, au moment de publier une demande ou d'enregistrer ton adresse; jamais en arrière-plan.
        </li>
        <li>
          <strong>Demandes et jobs :</strong> le montant offert, le quartier indiqué, le statut de la demande,
          les messages échangés avec l'autre personne une fois le match confirmé, et les appréciations
          laissées après une job.
        </li>
        <li>
          <strong>Paiement :</strong> le paiement est traité par Stripe. Snowro ne voit ni ne conserve jamais
          ton numéro de carte. Pour un déneigeur de quartier, c'est aussi Stripe qui vérifie ton identité et
          conserve tes informations bancaires; on garde seulement l'identifiant de ton compte Stripe, son
          statut et le détail de chaque paiement (montant, frais, versement).
        </li>
        <li>
          <strong>Tes consentements :</strong> pour chaque consentement optionnel, s'il est accordé ou retiré,
          la date et la version du texte que tu as accepté.
        </li>
      </ul>

      <h3>Utilisations optionnelles, avec ton consentement</h3>
      <p>
        Par défaut, elles sont toutes désactivées. Tu les actives ou les retires une à une, en tout temps, dans
        les paramètres de ton compte. Refuser n'empêche pas d'utiliser Snowro.
      </p>
      <ul>
        <li>
          <strong>Statistiques de zone (Snowro Pro) :</strong> inclure tes demandes, de façon anonyme et
          agrégée, dans les statistiques par secteur vues par les entreprises de déneigement abonnées. Ces
          statistiques ne contiennent ni ton nom, ni ton adresse, ni aucun identifiant qui permette de remonter
          jusqu'à toi.
        </li>
        <li>
          <strong>Offres ciblées :</strong> permettre à une entreprise de déneigement abonnée à Snowro Pro de te
          faire une offre directement.
        </li>
        <li>
          <strong>Notifications SMS :</strong> recevoir un texto quand une demande ouvre près de toi ou quand
          ton match est confirmé.
        </li>
      </ul>

      <h2>Ce qu'on ne fait pas</h2>
      <ul>
        <li>On ne vend pas, ne loue pas et n'échange pas tes renseignements personnels.</li>
        <li>On n'utilise pas de témoins (cookies) publicitaires ni d'outils de pistage publicitaire.</li>
        <li>
          On ne prend aucune décision fondée exclusivement sur un traitement automatisé qui te concerne sans
          te le dire. La mise en contact avec un déneigeur de quartier se fait selon la ville et l'ordre
          d'acceptation, pas selon un profil.
        </li>
      </ul>

      <h2>Témoins et stockage dans ton navigateur</h2>
      <p>
        Snowro utilise le stockage de ton navigateur uniquement pour ce qui est nécessaire au fonctionnement
        du site, par exemple garder ta session ouverte une fois connecté. Aucun témoin de mesure d'audience ou
        de publicité n'est utilisé.
      </p>

      <h2>Qui d'autre y a accès</h2>
      <p>
        Seules les personnes de Snowro qui en ont besoin pour faire fonctionner le service ont accès à tes
        renseignements. On fait aussi affaire avec des fournisseurs qui les traitent pour nous, selon nos
        instructions et pour ces seules fins :
      </p>
      <ul>
        <li>
          <strong>Google (Firebase et Google Maps Platform) :</strong> hébergement de la base de données,
          authentification, fonctions serveur et conversion d'un code postal ou d'une position en nom de ville.
        </li>
        <li>
          <strong>Stripe :</strong> traitement des paiements et vérification d'identité des déneigeurs de
          quartier.
        </li>
        <li>
          <strong>Netlify :</strong> hébergement du site web.
        </li>
        <li>
          <strong>Resend :</strong> envoi des courriels de Snowro (confirmation d'inscription, avis liés à tes
          demandes).
        </li>
      </ul>
      <p>
        Entre utilisateurs : une fois un match confirmé, le client et le déneigeur de quartier voient ce qu'il
        faut pour faire la job (prénom, adresse à déneiger, messages échangés). Avant un match, une demande
        ouverte est montrée aux déneigeurs de quartier de la même ville avec ton prénom, le quartier, la
        description de la job, le montant offert et la distance approximative. Ta note, elle, est visible des
        autres utilisateurs.
      </p>
      <p>
        On peut aussi devoir communiquer des renseignements lorsque la loi l'exige, par exemple à la suite
        d'une ordonnance d'un tribunal.
      </p>

      <h2>Renseignements conservés à l'extérieur du Québec</h2>
      <p>
        Nos fonctions serveur roulent à Montréal. Certains de nos fournisseurs (Google, Stripe, Netlify, Resend)
        peuvent toutefois conserver ou traiter des renseignements ailleurs au Canada et aux États-Unis. Avant de
        le faire, on a évalué que la protection offerte par ces fournisseurs est adéquate, notamment par leurs
        engagements contractuels de confidentialité et de sécurité, comme l'exige la Loi 25.
      </p>

      <h2>Combien de temps on les garde</h2>
      <ul>
        <li>
          <strong>Liste d'attente :</strong> jusqu'à ce que tu nous demandes de t'en retirer, ou au plus 24 mois après ton
          inscription si Snowro n'a pas ouvert dans ta ville d'ici là.
        </li>
        <li>
          <strong>Messages envoyés par « Nous écrire » :</strong> 24 mois après le dernier échange.
        </li>
        <li>
          <strong>Compte :</strong> tant que ton compte est actif. Si tu le fermes, on efface ou on rend anonymes
          tes renseignements dans les 30 jours, sauf ce que la loi nous oblige à garder plus longtemps (par
          exemple les registres de transactions, conservés 6 ans pour des raisons fiscales).
        </li>
      </ul>

      <h2>Comment on les protège</h2>
      <p>
        Les échanges avec le site sont chiffrés (HTTPS). L'accès à la base de données est réservé aux
        utilisateurs connectés et encadré par des règles de sécurité : les renseignements sensibles (ville,
        consentements, statut de paiement) ne peuvent être modifiés que par nos fonctions serveur, jamais
        directement depuis ton appareil, et la liste d'attente comme les messages « Nous écrire » ne sont
        accessibles à aucun utilisateur. Si un incident de confidentialité présentant un risque sérieux de
        préjudice survenait, on t'aviserait, ainsi que la Commission d'accès à l'information, comme le prévoit
        la loi.
      </p>

      <h2>Tes droits</h2>
      <p>Tu peux en tout temps :</p>
      <ul>
        <li>savoir quels renseignements on détient sur toi et en obtenir une copie;</li>
        <li>les faire corriger s'ils sont inexacts, incomplets ou équivoques;</li>
        <li>retirer un consentement (directement dans les paramètres de ton compte, ou en nous écrivant);</li>
        <li>demander qu'on cesse de diffuser tes renseignements ou qu'on les efface;</li>
        <li>
          obtenir les renseignements que tu nous as fournis dans un format technologique structuré et couramment
          utilisé.
        </li>
      </ul>
      <p>
        Pour exercer ces droits, écris-nous par le {lienFormulaire} (sujet « Mes renseignements personnels »). On te répond dans un délai de 30 jours. Si tu n'es pas
        satisfait de notre réponse, tu peux porter plainte auprès de la{" "}
        <a href="https://www.cai.gouv.qc.ca/" target="_blank" rel="noreferrer">
          Commission d'accès à l'information du Québec
        </a>
        .
      </p>

      <h2>Âge minimum</h2>
      <p>
        Snowro s'adresse aux personnes de 14 ans et plus pour la liste d'attente, et de 18 ans et plus pour
        créer un compte, publier une demande ou déneiger. On ne collecte pas sciemment de renseignements sur
        des enfants de moins de 14 ans.
      </p>

      <h2>Changements à cette politique</h2>
      <p>
        Si on modifie cette politique, la nouvelle version est publiée ici avec sa date de mise à jour. Pour un
        changement important (un nouvel usage de tes renseignements, par exemple), on t'avise par courriel ou
        dans l'application avant qu'il s'applique, et on te demande ton consentement lorsque la loi l'exige.
      </p>
    </PageLegale>
  );
}
