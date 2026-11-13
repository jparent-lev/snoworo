import { useState } from "react";
import "./FaqAccordion.css";

// FAQ par thème : Général (les deux rôles), Je fais déneiger (clients), Je
// déneige (déneigeurs de quartier). Les réponses suivent les règles réelles
// de l'app : pas d'annulation après acceptation, photos obligatoires,
// confirmation automatique après 12 h, carte prélevée à l'acceptation.
const THEMES = [
  {
    cle: "general",
    libelle: "Général",
    questions: [
      {
        q: "Est-ce que le service est offert dans ma ville ?",
        r: "Oui, partout au Québec : votre ville apparaît automatiquement dans Snowro dès qu'une personne s'y inscrit avec son adresse. Votre demande est montrée aux déneigeurs de quartier de votre ville ; s'il y en a encore peu, parlez de Snowro à vos voisins, c'est ce qui la fait trouver preneur plus vite.",
      },
      {
        q: "Est-ce que je peux faire déneiger et déneiger avec le même compte ?",
        r: "Oui. Un seul compte, deux modes : Client pour publier vos demandes, Déneigeur pour prendre des demandes. Vous passez de l'un à l'autre avec la bascule en haut de votre tableau de bord.",
      },
      {
        q: "Pourquoi pas simplement le groupe Facebook du quartier ?",
        r: "Pour un coup de pelle entre voisins qui se connaissent, un groupe fait très bien l'affaire. Snowro est utile quand vous ne connaissez personne, que c'est la veille d'une bonne bordée ou que vous partez tôt demain matin. Votre demande est envoyée à tous les déneigeurs de quartier disponibles du secteur en même temps, sans attendre une réponse dans un fil de commentaires. Chaque déneigeur de quartier a une note publique bâtie demande après demande, plutôt qu'un profil anonyme. Et l'entente (prix, heure, pelle laissée sur place ou non) est écrite d'avance, sans négociation sur le perron.",
      },
      {
        q: "Une demande acceptée peut-elle être annulée ?",
        r: "Non, ni par le client ni par le déneigeur de quartier : accepter, c'est s'engager. Personne ne laisse tomber votre demande pour une plus payante. Si un problème survient (absence, travail inachevé, accès impossible), on utilise « Signaler un problème » : le paiement reste retenu et nous tranchons selon les faits.",
      },
      {
        // Aligné sur les Conditions (sections 4, 5, 9 et 10) : ne rien promettre
        // de plus qu'elles (aucune assurance fournie par Snowro).
        q: "Et s'il y a un bris ou un accident ?",
        r: "Le déneigeur de quartier travaille à son compte : il est responsable de son travail et des dommages qu'il cause en le faisant. Si quelque chose est abîmé, signalez-le avec « Signaler un problème » : le paiement reste retenu pendant que nous examinons la situation, photos de fin de travail et messages à l'appui, et le client peut être remboursé en tout ou en partie. Snowro ne fournit pas d'assurance : chacun vérifie sa propre protection (assurance habitation pour le client, protection personnelle pour le déneigeur). Pour éviter les mauvaises surprises, le client signale d'avance ce qui pourrait être dangereux ou fragile, comme des marches glacées ou une voiture garée près de l'entrée, et le déneigeur travaille de façon sécuritaire avec son propre équipement. Le client peut laisser une pelle ou un grattoir à sa disposition, en bon état, mais jamais de souffleuse ni d'autre appareil motorisé.",
      },
      {
        q: "Qu'est-ce que l'autre personne voit de moi ?",
        r: "Avant qu'une demande soit acceptée, les déneigeurs voient seulement le quartier, la distance et votre prénom. L'adresse exacte n'est montrée qu'à celui qui accepte. Vous vous écrivez ensuite dans la messagerie de Snowro, sans échanger vos numéros. Vos messages et les photos de fin de demande ne sont vus que par vous deux, et ils sont effacés 30 jours après la demande.",
      },
    ],
  },
  {
    cle: "client",
    libelle: "Je fais déneiger",
    questions: [
      {
        q: "Quel montant devrais-je offrir ?",
        r: "C'est à vous de décider. Autour de Québec, une entrée simple se négocie souvent autour de 25 à 35 $, une entrée double avec balcon autour de 45 à 60 $. Si personne n'accepte votre demande, vous pouvez augmenter votre offre en tout temps.",
      },
      {
        q: "Quand ma carte est-elle débitée ?",
        r: "Vous enregistrez votre carte en publiant, mais rien n'est prélevé à ce moment-là. Le montant est prélevé lorsqu'un déneigeur de quartier accepte votre demande, puis Snowro le conserve jusqu'à ce que la demande soit confirmée. Vous recevez un reçu par courriel. Tant que personne n'a accepté, vous pouvez annuler sans frais.",
      },
      {
        q: "Comment savoir que le travail est vraiment fait ?",
        r: "Avant de partir, le déneigeur de quartier prend de 1 à 3 photos du travail fini : impossible de marquer la demande comme faite sans cela. Vous les voyez tout de suite dans votre tableau de bord. Vous avez ensuite 12 heures pour confirmer ou signaler un problème ; sans réponse de votre part, la demande est confirmée automatiquement.",
      },
      {
        q: "Et si le déneigeur de quartier ne se présente pas ?",
        r: "Votre paiement est retenu tant que la demande n'est pas confirmée. S'il ne se présente pas, signalez-le : vous êtes remboursé au complet et il perd l'accès à la demande. Rien à réclamer, rien à négocier.",
      },
      {
        q: "Puis-je choisir mon déneigeur de quartier ?",
        r: "Pas dans la première version : le premier qui accepte prend la demande, pour que tout aille vite lorsqu'il tombe 30 cm. Nous laissons aussi à chaque déneigeur de quartier le temps de réaliser quelques demandes et de bâtir sa note avant d'ajouter des façons de choisir selon la réputation. Cette option s'en vient.",
      },
    ],
  },
  {
    cle: "deneigeur",
    libelle: "Je déneige",
    questions: [
      {
        q: "Comment suis-je payé ?",
        r: "Vous créez votre compte de versement une seule fois, avec Stripe (identité et compte bancaire). Aucune entreprise n'est requise : vous vous inscrivez comme particulier. Ensuite, l'argent arrive directement dans votre compte bancaire après chaque demande, sans facture à envoyer ni virement à réclamer.",
      },
      {
        // Délais : confirmation automatique de 12 h (décision produit) et
        // délais Stripe au Canada (premier versement d'un nouveau compte
        // autour de 7 jours). À revalider avec les premiers vrais versements.
        q: "Une fois la demande faite, après combien de temps suis-je payé ?",
        r: "Lorsque vous marquez la demande comme faite, le client dispose de 12 heures pour confirmer ou signaler un problème. S'il ne fait rien, la demande est confirmée automatiquement. Dès la confirmation, nous déclenchons votre versement : l'argent arrive dans votre compte bancaire en général en 2 à 4 jours ouvrables. Votre tout premier versement prend un peu plus de temps, environ 7 jours : il s'agit d'une vérification standard de Stripe pour les nouveaux comptes.",
      },
      {
        q: "Combien est-ce que je conserve sur une demande ?",
        r: "Chaque demande affiche votre montant, frais Snowro déjà déduits, avant même que vous l'acceptiez. Aucune surprise : ce que vous voyez est ce que vous recevez. Le calcul des frais est présenté dans la section Frais plus haut.",
      },
      {
        q: "Pourquoi des photos à la fin de chaque demande ?",
        r: "Elles sont votre preuve que le travail est fait, et elles rassurent le client. Avant de partir, vous prenez de 1 à 3 photos du travail terminé, sur place, directement dans l'application. Montrez seulement l'endroit déneigé : jamais de personne ni de plaque d'immatriculation.",
      },
      {
        q: "Et si j'ai un imprévu sérieux après avoir accepté une demande ?",
        r: "Une demande acceptée ne s'annule pas : le client compte sur vous. Si un imprévu sérieux vous empêche d'y aller, écrivez immédiatement au client dans la messagerie et utilisez « Signaler un problème » : nous examinerons la situation avec vous deux. Pour éviter cela, n'acceptez que les demandes que vous êtes certain de pouvoir faire à l'heure.",
      },
    ],
  },
];

// Un thème à la fois ; dans un thème, une seule question ouverte (recliquer
// la referme). Changer de thème ouvre sa première question.
export default function FaqAccordion() {
  const [theme, setTheme] = useState(THEMES[0].cle);
  const [ouvert, setOuvert] = useState(0);
  const actif = THEMES.find((t) => t.cle === theme);

  return (
    <div className="faq">
      <div className="faq__themes" role="tablist" aria-label="Thèmes de la FAQ">
        {THEMES.map((t) => (
          <button
            key={t.cle}
            type="button"
            role="tab"
            id={`faq-onglet-${t.cle}`}
            aria-selected={theme === t.cle}
            aria-controls="faq-questions"
            className={`faq__theme ${theme === t.cle ? "faq__theme--actif" : ""}`}
            onClick={() => {
              setTheme(t.cle);
              setOuvert(0);
            }}
          >
            {t.libelle}
          </button>
        ))}
      </div>
      <div id="faq-questions" role="tabpanel" aria-labelledby={`faq-onglet-${theme}`} className="faq__liste">
        {actif.questions.map((item, i) => {
          const estOuvert = ouvert === i;
          return (
            <div key={item.q} className="faq__item">
              <button
                type="button"
                className="faq__question"
                onClick={() => setOuvert(estOuvert ? -1 : i)}
                aria-expanded={estOuvert}
              >
                <span className="faq__question-texte">{item.q}</span>
                <span className="faq__signe">{estOuvert ? "–" : "+"}</span>
              </button>
              {estOuvert && <p className="faq__reponse">{item.r}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
