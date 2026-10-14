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
        r: "Nous ouvrons les villes une à une, selon le nombre de déneigeurs de quartier inscrits. Votre ville apparaît automatiquement dans le système dès que des personnes s'y inscrivent avec une adresse. C'est pourquoi la liste d'attente compte plus qu'on ne le croit.",
      },
      {
        q: "Est-ce que je peux faire déneiger et déneiger avec le même compte ?",
        r: "Oui. Un seul compte, deux modes : Client pour publier vos demandes, Déneigeur pour prendre des jobs. Vous passez de l'un à l'autre avec la bascule en haut de votre tableau de bord.",
      },
      {
        q: "Une job acceptée peut-elle être annulée ?",
        r: "Non, ni par le client ni par le déneigeur de quartier : accepter, c'est s'engager. Personne ne laisse tomber votre job pour une plus payante. Si un problème survient (absence, travail inachevé, accès impossible), on utilise « Signaler un problème » : le paiement reste retenu et nous tranchons selon les faits.",
      },
      {
        q: "Qu'est-ce que l'autre personne voit de moi ?",
        r: "Avant qu'une job soit acceptée, les déneigeurs voient seulement le quartier, la distance et votre prénom. L'adresse exacte n'est montrée qu'à celui qui accepte. Vous vous écrivez ensuite dans la messagerie de Snowro, sans échanger vos numéros. Vos messages et les photos de fin de job ne sont vus que par vous deux, et ils sont effacés 30 jours après la job.",
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
        r: "Vous enregistrez votre carte en publiant, mais rien n'est prélevé à ce moment-là. Le montant est prélevé lorsqu'un déneigeur de quartier accepte votre demande, puis Snowro le conserve jusqu'à ce que la job soit confirmée. Vous recevez un reçu par courriel. Tant que personne n'a accepté, vous pouvez annuler sans frais.",
      },
      {
        q: "Comment savoir que le travail est vraiment fait ?",
        r: "Avant de partir, le déneigeur de quartier prend de 1 à 3 photos du travail fini : impossible de marquer la job comme faite sans cela. Vous les voyez tout de suite dans votre tableau de bord. Vous avez ensuite 12 heures pour confirmer ou signaler un problème ; sans réponse de votre part, la job est confirmée automatiquement.",
      },
      {
        q: "Et si le déneigeur de quartier ne se présente pas ?",
        r: "Votre paiement est retenu tant que la job n'est pas confirmée. S'il ne se présente pas, signalez-le : vous êtes remboursé au complet et il perd l'accès à la demande. Rien à réclamer, rien à négocier.",
      },
      {
        q: "Puis-je choisir mon déneigeur de quartier ?",
        r: "Pas dans la première version : le premier qui accepte prend la job, pour que tout aille vite lorsqu'il tombe 30 cm. Nous laissons aussi à chaque déneigeur de quartier le temps de réaliser quelques jobs et de bâtir sa note avant d'ajouter des façons de choisir selon la réputation. Cette option s'en vient.",
      },
    ],
  },
  {
    cle: "deneigeur",
    libelle: "Je déneige",
    questions: [
      {
        q: "Comment suis-je payé ?",
        r: "Vous créez votre compte de versement une seule fois, avec Stripe (identité et compte bancaire). Aucune entreprise n'est requise : vous vous inscrivez comme particulier. Ensuite, l'argent arrive directement dans votre compte bancaire après chaque job, sans facture à envoyer ni virement à réclamer.",
      },
      {
        // Délais : confirmation automatique de 12 h (décision produit) et
        // délais Stripe au Canada (premier versement d'un nouveau compte
        // autour de 7 jours). À revalider avec les premiers vrais versements.
        q: "Une fois la job faite, après combien de temps suis-je payé ?",
        r: "Lorsque vous marquez la job comme faite, le client dispose de 12 heures pour confirmer ou signaler un problème. S'il ne fait rien, la job est confirmée automatiquement. Dès la confirmation, nous déclenchons votre versement : l'argent arrive dans votre compte bancaire en général en 2 à 4 jours ouvrables. Votre tout premier versement prend un peu plus de temps, environ 7 jours : il s'agit d'une vérification standard de Stripe pour les nouveaux comptes.",
      },
      {
        q: "Combien est-ce que je conserve sur une job ?",
        r: "Chaque demande affiche votre montant, frais Snowro déjà déduits, avant même que vous l'acceptiez. Aucune surprise : ce que vous voyez est ce que vous recevez. Le calcul des frais est présenté dans la section Frais plus haut.",
      },
      {
        q: "Pourquoi des photos à la fin de chaque job ?",
        r: "Elles sont votre preuve que le travail est fait, et elles rassurent le client. Avant de partir, vous prenez de 1 à 3 photos du travail terminé, sur place, directement dans l'application. Montrez seulement l'endroit déneigé : jamais de personne ni de plaque d'immatriculation.",
      },
      {
        q: "Et si j'ai un imprévu sérieux après avoir accepté une job ?",
        r: "Une job acceptée ne s'annule pas : le client compte sur vous. Si un imprévu sérieux vous empêche d'y aller, écrivez immédiatement au client dans la messagerie et utilisez « Signaler un problème » : nous examinerons la situation avec vous deux. Pour éviter cela, n'acceptez que les jobs que vous êtes certain de pouvoir faire à l'heure.",
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
