import { Icone } from "./Decors";
import "./ParcoursDemande.css";

// Section « Tout se passe dans votre tableau de bord » : le parcours d'une
// demande en quatre étapes (les mêmes que dans l'app), avec chaque garantie
// rattachée au moment où elle s'applique. Sur ordinateur : un panneau lin,
// la frise en haut et les cinq garanties sur une rangée de cartes de même
// hauteur, chacune sous son étape (l'étape à deux garanties occupe deux
// colonnes). Sur mobile : frise verticale. Aucune animation au défilement.
const ETAPES = [
  {
    nom: "Publiée",
    resume: "Vous décrivez la tâche, le moment et le montant proposé.",
    garanties: [
      {
        icone: "epingle",
        titre: "Votre adresse protégée",
        texte: "Seul le déneigeur qui accepte voit l'adresse exacte. Les autres voient le quartier et la distance.",
      },
    ],
  },
  {
    nom: "Acceptée",
    resume: "Un déneigeur de votre quartier prend la demande.",
    garanties: [
      {
        icone: "engagement",
        titre: "Une demande acceptée ne s'annule pas",
        texte: "Personne ne laisse tomber votre demande pour une plus payante : accepter, c'est s'engager.",
      },
      {
        icone: "message",
        titre: "Une messagerie privée",
        texte: "Vous vous écrivez dans Snowro. Inutile d'échanger vos numéros de téléphone.",
      },
    ],
  },
  {
    nom: "Faite",
    resume: "Le travail est terminé et documenté sur place.",
    garanties: [
      {
        icone: "photo",
        titre: "Des photos avant de partir",
        texte: "Le déneigeur prend de 1 à 3 photos du travail fini avant de marquer la demande faite. Vous les voyez tout de suite.",
      },
    ],
  },
  {
    nom: "Confirmée",
    resume: "Vous vérifiez, puis le paiement part au déneigeur.",
    garanties: [
      {
        icone: "horloge",
        titre: "12 heures pour vérifier",
        texte: "Vous confirmez ou signalez un problème. Le paiement part au déneigeur seulement après.",
      },
    ],
  },
];

export default function ParcoursDemande() {
  return (
    <ol className="parcours-demande" aria-label="Le parcours d'une demande">
      {ETAPES.map((etape, i) => (
        <li
          key={etape.nom}
          className="parcours-demande__etape"
          style={{ "--garanties": etape.garanties.length }}
        >
          <div className="parcours-demande__repere">
            <span className="parcours-demande__numero" aria-hidden="true">
              {i + 1}
            </span>
            <span className="eyebrow parcours-demande__nom">{etape.nom}</span>
          </div>
          <div className="parcours-demande__corps">
            <p className="parcours-demande__resume">{etape.resume}</p>
            <ul className="parcours-demande__garanties">
              {etape.garanties.map((g) => (
                <li key={g.titre} className="parcours-demande__garantie">
                  <Icone nom={g.icone} />
                  <div>
                    <span className="parcours-demande__titre">{g.titre}</span>
                    <span className="parcours-demande__texte">{g.texte}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ol>
  );
}
