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
          <strong>En bref :</strong> nous collectons le minimum de renseignements pour vous mettre en contact avec un déneigeur de
          quartier (ou avec des clients), vous payer ou encaisser votre paiement de façon sécuritaire, et savoir
          quelles villes ouvrir. Nous ne vendons jamais vos renseignements. Tout ce qui est optionnel se retire en
          un clic, et vous pouvez nous demander en tout temps de consulter, de corriger ou d'effacer ce que nous détenons à votre sujet.
        </p>
      </div>

      <h2>Qui est responsable de vos renseignements</h2>
      <p>
        Snowro est exploité à Québec par la société {nomLegal}. La personne responsable de la protection des
        renseignements personnels est {responsableRenseignements}. Pour toute question ou demande liée à
        vos renseignements, écrivez-lui par le {lienFormulaire} (sujet « Mes renseignements personnels »).
      </p>

      <h2>Ce que nous collectons, et pourquoi</h2>

      <h3>Liste d'attente</h3>
      <p>
        Votre courriel, votre code postal et votre rôle (client ou déneigeur de quartier). À partir du code postal,
        nous déduisons votre ville. Ces renseignements servent à savoir quelles villes ouvrir en premier et à vous écrire lorsque Snowro ouvre
        dans votre secteur. Rien d'autre.
      </p>

      <h3>Formulaire « Nous écrire »</h3>
      <p>
        Votre nom (si vous le donnez), votre courriel, le sujet et votre message, pour vous répondre et assurer le suivi
        de votre demande.
      </p>

      <h3>Compte Snowro</h3>
      <ul>
        <li>
          <strong>Identité et contact :</strong> votre nom ou prénom d'affichage, votre courriel et, si vous le
          fournissez, votre numéro de téléphone.
        </li>
        <li>
          <strong>Adresses et localisation :</strong> l'adresse à déneiger d'une demande (avec le numéro
          d'appartement, si vous le donnez) et, pour un déneigeur de quartier, son adresse de service. Nous en
          déduisons la position, le début du code postal et la ville. L'adresse exacte d'une demande n'est montrée
          qu'au déneigeur de quartier qui l'accepte; avant, les autres ne voient qu'une zone approximative et la
          distance. L'adresse de service d'un déneigeur n'est montrée à personne : elle sert seulement à lui
          montrer les demandes de sa ville. Pendant que vous saisissez une adresse, le texte saisi est envoyé à Google
          pour vous proposer des adresses existantes. Si vous choisissez « Utiliser ma position », votre position n'est
          lue qu'à ce moment-là, jamais en arrière-plan.
        </li>
        <li>
          <strong>Demandes et demandes :</strong> le montant offert, le quartier indiqué, le statut de la demande,
          les messages échangés avec l'autre personne une fois le jumelage confirmé, les photos (de 1 à 3) prises
          par le déneigeur de quartier à la fin de la demande (visibles seulement par vous deux) et l'appréciation
          laissée par le client (des étoiles et, s'il le souhaite, un mot lu seulement par le déneigeur).
        </li>
        <li>
          <strong>Paiement :</strong> le paiement est traité par Stripe. Snowro ne voit ni ne conserve jamais
          votre numéro de carte. Pour un déneigeur de quartier, c'est aussi Stripe qui vérifie son identité et
          conserve ses renseignements bancaires; nous conservons seulement l'identifiant de son compte Stripe, son
          statut et le détail de chaque paiement (montant, frais, versement).
        </li>
        <li>
          <strong>Vos consentements :</strong> pour chaque consentement optionnel, s'il est accordé ou retiré,
          la date et la version du texte que vous avez accepté.
        </li>
      </ul>

      <h3>Utilisation optionnelle, avec votre consentement</h3>
      <p>
        Par défaut, elle est désactivée. Vous l'activez ou la retirez en tout temps, dans les paramètres de votre
        compte. Refuser n'empêche pas d'utiliser Snowro. Si nous ajoutons un jour une autre utilisation
        optionnelle, elle apparaîtra ici et dans vos paramètres, désactivée par défaut.
      </p>
      <ul>
        <li>
          <strong>Notifications SMS :</strong> recevoir un message texte lorsqu'une demande est publiée près de chez vous ou lorsque
          votre jumelage est confirmé.
        </li>
      </ul>

      <h2>Ce que nous ne faisons pas</h2>
      <ul>
        <li>Nous ne vendons pas, ne louons pas et n'échangeons pas vos renseignements personnels.</li>
        <li>Nous n'utilisons pas de témoins (cookies) publicitaires ni d'outils de pistage publicitaire.</li>
        <li>
          Nous ne prenons aucune décision fondée exclusivement sur un traitement automatisé qui vous concerne sans
          vous en informer. La mise en contact avec un déneigeur de quartier se fait selon la ville et l'ordre
          d'acceptation, pas selon un profil.
        </li>
      </ul>

      <h2>Témoins et stockage dans votre navigateur</h2>
      <p>
        Snowro utilise le stockage de votre navigateur uniquement pour ce qui est nécessaire au fonctionnement
        du site, par exemple garder votre session ouverte une fois connecté. Aucun témoin de mesure d'audience ou
        de publicité n'est utilisé.
      </p>

      <h2>Qui d'autre y a accès</h2>
      <p>
        Seules les personnes de Snowro qui en ont besoin pour faire fonctionner le service ont accès à vos
        renseignements. Nous faisons aussi affaire avec des fournisseurs qui les traitent pour nous, selon nos
        instructions et pour ces seules fins :
      </p>
      <ul>
        <li>
          <strong>Google (Firebase et Google Maps Platform) :</strong> hébergement du site web et de la base de données,
          authentification, fonctions serveur, suggestions d'adresses pendant la saisie et conversion d'une
          adresse, d'un code postal ou d'une position en nom de ville.
        </li>
        <li>
          <strong>Stripe :</strong> traitement des paiements et vérification d'identité des déneigeurs de
          quartier.
        </li>
        <li>
          <strong>Resend :</strong> envoi des courriels de Snowro (confirmation d'inscription, avis liés à vos
          demandes).
        </li>
      </ul>
      <p>
        Entre utilisateurs : une fois un jumelage confirmé, le client et le déneigeur de quartier voient ce qu'il
        faut pour faire la demande (prénom, adresse à déneiger, messages échangés). Avant un jumelage, une demande
        ouverte est montrée aux déneigeurs de quartier de la même ville avec votre prénom, le quartier, la
        description de la demande, le montant offert et la distance approximative. Votre note, elle, est visible des
        autres utilisateurs.
      </p>
      <p>
        Nous pouvons aussi devoir communiquer des renseignements lorsque la loi l'exige, par exemple à la suite
        d'une ordonnance d'un tribunal.
      </p>

      <h2>Renseignements conservés à l'extérieur du Québec</h2>
      <p>
        Nos fonctions serveur sont hébergées à Montréal. Certains de nos fournisseurs (Google, Stripe, Resend)
        peuvent toutefois conserver ou traiter des renseignements ailleurs au Canada et aux États-Unis. Avant de
        le faire, nous avons évalué que la protection offerte par ces fournisseurs est adéquate, notamment par leurs
        engagements contractuels de confidentialité et de sécurité, comme l'exige la Loi 25.
      </p>

      <h2>Combien de temps nous les conservons</h2>
      <ul>
        <li>
          <strong>Liste d'attente :</strong> jusqu'à ce que vous nous demandiez de vous en retirer, ou au plus 24 mois
          après votre inscription : elle est alors effacée automatiquement.
        </li>
        <li>
          <strong>Messages envoyés par « Nous écrire » :</strong> effacés automatiquement 24 mois après leur
          envoi.
        </li>
        <li>
          <strong>Photos de fin de demande et messages échangés :</strong> effacés automatiquement 30 jours après la
          demande, sauf si un problème a été signalé : nous les conservons alors jusqu'à ce qu'il soit réglé. Avant l'envoi,
          l'app retire des photos les informations cachées qu'ajoute le téléphone (dont la position GPS).
        </li>
        <li>
          <strong>Compte :</strong> tant que votre compte est actif. Vous pouvez le fermer vous-même en tout temps dans
          les paramètres (sauf pendant une demande en cours) : vos renseignements sont alors effacés ou rendus
          anonymes immédiatement, sauf ce que la loi nous oblige à conserver plus longtemps (le registre des
          paiements, conservé 6 ans pour des raisons fiscales). Stripe conserve de son côté les renseignements
          de paiement et de vérification d'identité selon ses propres obligations légales.
        </li>
      </ul>

      <h2>Comment nous les protégeons</h2>
      <p>
        Les échanges avec le site sont chiffrés (HTTPS). L'accès à la base de données est réservé aux
        utilisateurs connectés et encadré par des règles de sécurité : les renseignements sensibles (ville,
        consentements, statut de paiement) ne peuvent être modifiés que par nos fonctions serveur, jamais
        directement depuis votre appareil, et la liste d'attente comme les messages « Nous écrire » ne sont
        accessibles à aucun utilisateur. Si un incident de confidentialité présentant un risque sérieux de
        préjudice survenait, nous vous en aviserions, ainsi que la Commission d'accès à l'information, comme le prévoit
        la loi.
      </p>

      <h2>Vos droits</h2>
      <p>Vous pouvez en tout temps :</p>
      <ul>
        <li>savoir quels renseignements nous détenons à votre sujet et en obtenir une copie;</li>
        <li>les faire corriger s'ils sont inexacts, incomplets ou équivoques;</li>
        <li>retirer un consentement (directement dans les paramètres de votre compte, ou en nous écrivant);</li>
        <li>
          demander que nous cessions de diffuser vos renseignements ou que nous les effacions (vous pouvez aussi fermer votre
          compte vous-même dans les paramètres);
        </li>
        <li>
          obtenir les renseignements que vous nous avez fournis dans un format technologique structuré et couramment
          utilisé.
        </li>
      </ul>
      <p>
        Pour exercer ces droits, écrivez-nous par le {lienFormulaire} (sujet « Mes renseignements personnels »). Nous vous répondons dans un délai de 30 jours. Si vous n'êtes pas
        satisfait de notre réponse, vous pouvez porter plainte auprès de la{" "}
        <a href="https://www.cai.gouv.qc.ca/" target="_blank" rel="noreferrer">
          Commission d'accès à l'information du Québec
        </a>
        .
      </p>

      <h2>Âge minimum</h2>
      <p>
        Snowro s'adresse aux personnes de 14 ans et plus pour la liste d'attente, et de 18 ans et plus pour
        créer un compte, publier une demande ou déneiger. Nous ne collectons pas sciemment de renseignements sur
        des enfants de moins de 14 ans.
      </p>

      <h2>Changements à cette politique</h2>
      <p>
        Si nous modifions cette politique, la nouvelle version est publiée ici avec sa date de mise à jour. Pour un
        changement important (un nouvel usage de vos renseignements, par exemple), nous vous avisons par courriel ou
        dans l'application avant qu'il s'applique, et nous vous demandons votre consentement lorsque la loi l'exige.
      </p>
    </PageLegale>
  );
}
