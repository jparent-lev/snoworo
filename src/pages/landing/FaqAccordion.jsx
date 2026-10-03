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
        q: "Ça fonctionne dans ma ville ?",
        r: "On ouvre les villes une à une, selon le nombre de déneigeurs de quartier inscrits. Ta ville apparaît toute seule dans le système dès qu'il y a du monde qui s'inscrit avec une adresse là. C'est pour ça que la liste d'attente compte plus que tu penses.",
      },
      {
        q: "Est-ce que je peux faire déneiger et déneiger avec le même compte ?",
        r: "Oui. Un seul compte, deux modes : Client pour publier tes demandes, Déneigeur pour prendre des jobs. Tu passes de l'un à l'autre avec la bascule en haut de ton tableau de bord.",
      },
      {
        q: "Une job acceptée peut-elle être annulée ?",
        r: "Non, ni par le client ni par le déneigeur de quartier : accepter, c'est s'engager. Personne ne laisse tomber ta job pour une plus payante. Si quelque chose cloche (absence, travail pas fini, accès impossible), on utilise « Signaler un problème » : le paiement reste retenu et on tranche selon les faits.",
      },
      {
        q: "Qu'est-ce que l'autre personne voit de moi ?",
        r: "Avant qu'une job soit acceptée, les déneigeurs voient seulement le quartier, la distance et ton prénom. L'adresse exacte n'est montrée qu'à celui qui accepte. Vous vous écrivez ensuite dans la messagerie de Snowro, sans échanger vos numéros. Vos messages et les photos de fin de job ne sont vus que par vous deux, et ils sont effacés 30 jours après la job.",
      },
      {
        q: "C'est quoi la différence avec Snowro Pro ?",
        r: "Snowro, c'est le service entre déneigeurs de quartier : publier ou prendre des jobs, gratuit à installer. Snowro Pro s'adresse aux déneigeurs professionnels : les entreprises de déneigement qui veulent voir où la demande se trouve. Les détails s'en viennent.",
      },
    ],
  },
  {
    cle: "client",
    libelle: "Je fais déneiger",
    questions: [
      {
        q: "C'est quoi le montant que je devrais offrir ?",
        r: "À toi de voir. Autour de Québec, une entrée simple part souvent autour de 25-35 $, une entrée double avec balcon autour de 45-60 $. Si personne prend ta demande, tu peux monter ton offre en tout temps.",
      },
      {
        q: "Quand est-ce que ma carte est débitée ?",
        r: "Tu enregistres ta carte en publiant, mais rien n'est prélevé à ce moment-là. Le montant est prélevé quand un déneigeur de quartier accepte ta demande, puis Snowro le garde jusqu'à ce que la job soit confirmée. Tu reçois un reçu par courriel. Tant que personne n'a accepté, tu peux annuler sans frais.",
      },
      {
        q: "Comment je sais que c'est vraiment fait ?",
        r: "Avant de partir, le déneigeur de quartier prend de 1 à 3 photos du travail fini : impossible de marquer la job faite sans ça. Tu les vois tout de suite dans ton tableau de bord. Tu as ensuite 12 heures pour confirmer ou signaler un problème ; sans réponse, c'est confirmé tout seul.",
      },
      {
        q: "Et si le déneigeur de quartier se présente pas ?",
        r: "Ton paiement est retenu tant que la job est pas confirmée faite. S'il se présente pas, signale-le : tu es remboursé au complet et il perd l'accès à la demande. Rien à réclamer, rien à négocier.",
      },
      {
        q: "Est-ce que je peux choisir mon déneigeur de quartier ?",
        r: "Pas dans la première version : c'est le premier qui accepte qui prend la job, pour que ça aille vite quand il tombe 30 cm. On laisse aussi la chance à chaque déneigeur de quartier de faire quelques jobs et de bâtir sa note avant d'ouvrir des façons de choisir selon la réputation. Ça s'en vient.",
      },
    ],
  },
  {
    cle: "deneigeur",
    libelle: "Je déneige",
    questions: [
      {
        q: "Comment je me fais payer ?",
        r: "Tu crées ton compte de versement une seule fois, avec Stripe (identité et compte bancaire). Pas besoin d'avoir une entreprise : tu t'inscris comme particulier. Ensuite, l'argent arrive directement dans ton compte de banque après chaque job. Pas de facture à envoyer, pas de virement à courir après.",
      },
      {
        // Délais : confirmation automatique de 12 h (décision produit) et
        // délais Stripe au Canada (premier versement d'un nouveau compte
        // autour de 7 jours). À revalider avec les premiers vrais versements.
        q: "Une fois la job faite, ça prend combien de temps avant que je sois payé ?",
        r: "Quand tu marques la job faite, le client a 12 heures pour confirmer ou signaler un problème. S'il fait rien, c'est confirmé tout seul. Dès que c'est confirmé, on déclenche ton versement : l'argent arrive dans ton compte de banque en général en 2 à 4 jours ouvrables. Ton tout premier versement prend un peu plus de temps, autour de 7 jours : c'est une vérification standard de Stripe pour les nouveaux comptes.",
      },
      {
        q: "Combien je garde sur une job ?",
        r: "Chaque demande affiche le montant pour toi, frais Snowro déjà déduits, avant même que tu l'acceptes. Pas de surprise : ce que tu vois, c'est ce que tu reçois. Le calcul des frais est dans la section Frais plus haut.",
      },
      {
        q: "Pourquoi des photos à la fin de chaque job ?",
        r: "C'est ta preuve que le travail est fait, et ce qui rassure le client. Avant de partir, tu prends de 1 à 3 photos du travail terminé, sur place, directement dans l'app. Montre seulement l'endroit déneigé : jamais de personne ni de plaque d'immatriculation.",
      },
      {
        q: "Et si j'ai un vrai imprévu après avoir accepté une job ?",
        r: "Une job acceptée ne s'annule pas : le client compte sur toi. Si un imprévu sérieux t'empêche d'y aller, écris tout de suite au client dans la messagerie et utilise « Signaler un problème » : on regarde la situation avec vous deux. Pour éviter ça, n'accepte que les jobs que tu es certain de faire à l'heure.",
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
