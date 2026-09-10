import { useState } from "react";
import "./FaqAccordion.css";

// Copie définitive — voir design_handoff_snowro_site/Snowro - Site.dc.html (faqData).
const QUESTIONS = [
  {
    q: "C'est quoi le montant que je devrais offrir ?",
    r: "À toi de voir. Autour de Québec, une entrée simple part souvent autour de 25-35 $, une entrée double avec balcon autour de 45-60 $. Si personne prend ta demande, tu peux monter ton offre en tout temps.",
  },
  {
    q: "Et si le déneigeur se présente pas ?",
    r: "Ton paiement est retenu tant que la job est pas confirmée faite. S'il se présente pas, tu es remboursé au complet et il perd l'accès à la demande. Rien à réclamer, rien à négocier.",
  },
  {
    q: "Est-ce que je peux choisir mon déneigeur ?",
    r: "Pas dans la première version : c'est le premier qui accepte qui prend la job, pour que ça aille vite quand il tombe 30 cm. Par contre, tu peux marquer quelqu'un comme favori après coup, et il pourra t'offrir ses services directement — seulement si tu as dit oui.",
  },
  {
    q: "Ça fonctionne dans ma ville ?",
    r: "On ouvre les villes une à une, selon le nombre de déneigeurs inscrits. Ta ville apparaît toute seule dans le système dès qu'il y a du monde qui s'inscrit avec une adresse là — c'est pour ça que la liste d'attente compte plus que tu penses.",
  },
  {
    q: "Je suis déneigeur : comment je me fais payer ?",
    r: "Tu crées ton compte de paiement en quelques minutes (identité vérifiée par Stripe), et l'argent arrive directement dans ton compte de banque après la job. Pas de facture à envoyer, pas de chèque à courir après.",
  },
  {
    q: "C'est quoi la différence avec Snowro Pro ?",
    r: "Snowro X, c'est le service : publier ou prendre des jobs, gratuit à installer. Snowro Pro est une offre en préparation pour les entreprises de déneigement — les détails s'en viennent.",
  },
];

// Une seule entrée ouverte à la fois ; recliquer sur l'entrée ouverte la referme.
export default function FaqAccordion() {
  const [ouvert, setOuvert] = useState(0);

  return (
    <div className="faq">
      {QUESTIONS.map((item, i) => {
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
  );
}
