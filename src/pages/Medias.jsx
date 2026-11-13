import PageLegale from "../components/PageLegale";
import SnowroSymbol from "../components/brand/SnowroSymbol";
import { VIDEOS } from "../components/VideoSnowro";
import "./Medias.css";

// Trousse médias (snowro.com/medias) : contact, faits vérifiables, logos,
// vidéos et images libres pour la couverture éditoriale. Les fichiers sont
// dans public/medias/ et public/videos/ ; les logos PNG sont produits à partir
// des composants de marque (voir docs/medias.md).
const CONTACT = { nom: "Jonathan Parent", titre: "Fondateur", telephone: "418 997-2577", courriel: "allo@snowro.com" };

const LOGOS = [
  { fichier: "snowro-logo.png", titre: "Logo couleur", detail: "Fond transparent, pour fond clair", fond: "clair" },
  { fichier: "snowro-logo-inverse.png", titre: "Logo inversé", detail: "Fond transparent, pour fond foncé", fond: "fonce" },
  { fichier: "snowro-symbole.png", titre: "Symbole seul", detail: "1024 × 1024, fond transparent", fond: "clair" },
];

const IMAGES = [
  { fichier: "/og-snowro.png", titre: "Visuel de présentation", detail: "1200 × 630" },
  { fichier: "/medias/snowro-accueil.png", titre: "Page d'accueil, ordinateur", detail: "2560 × 1600" },
  { fichier: "/medias/snowro-accueil-mobile.png", titre: "Page d'accueil, téléphone", detail: "1170 × 1992" },
];

const ORDRE_VIDEOS = ["enBref", "faireDeneiger", "deneiger", "confiance"];

function Telecharger({ href, children }) {
  return (
    <a className="medias__telecharger" href={href} download>
      {children}
    </a>
  );
}

export default function Medias() {
  return (
    <PageLegale surtitre="Médias" titre="Trousse médias">
      <p>
        Snowro jumelle les résidents qui veulent faire déneiger leur entrée, leur balcon ou leur stationnement avec un
        déneigeur de leur quartier. Le client fixe son prix, le premier déneigeur qui accepte s'engage, et le paiement
        est retenu jusqu'à ce que le travail soit confirmé.
      </p>

      <div className="medias__contact">
        <h2>Contact médias</h2>
        <p>
          <strong>{CONTACT.nom}</strong>, {CONTACT.titre.toLowerCase()}
          <br />
          <a href={`tel:+1${CONTACT.telephone.replace(/\D/g, "")}`}>{CONTACT.telephone}</a>
          <br />
          <a href={`mailto:${CONTACT.courriel}`}>{CONTACT.courriel}</a>
        </p>
        <p className="medias__note">Entrevues en français, en studio, au téléphone ou sur le terrain.</p>
      </div>

      <h2>En bref</h2>
      <ul>
        <li>Plateforme québécoise de déneigement résidentiel entre voisins, offerte partout au Québec.</li>
        <li>Le client publie sa demande, fixe le montant offert et l'heure limite ; aucun contrat de saison.</li>
        <li>
          Le montant est prélevé à l'acceptation, retenu par Snowro, puis versé au déneigeur une fois le travail confirmé,
          photos à l'appui.
        </li>
        <li>Si le déneigeur ne se présente pas, le client est remboursé au complet, automatiquement 12 heures après l'heure prévue.</li>
        <li>Un même compte peut regrouper plusieurs adresses, par exemple celle de ses parents.</li>
        <li>Frais Snowro : 2 $ plus 8 % du montant, déduits de la part du déneigeur.</li>
        <li>Paiements traités par Stripe ; l'adresse exacte n'est montrée qu'au déneigeur qui accepte.</li>
      </ul>

      <h2>Logos</h2>
      <div className="medias__grille">
        {LOGOS.map((l) => (
          <figure key={l.fichier} className="medias__carte">
            <div className={`medias__apercu medias__apercu--${l.fond}`}>
              <img src={`/medias/${l.fichier}`} alt={l.titre} loading="lazy" />
            </div>
            <figcaption>
              <strong>{l.titre}</strong>
              <span>{l.detail}</span>
              <Telecharger href={`/medias/${l.fichier}`}>Télécharger le PNG</Telecharger>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="medias__note">Merci de ne pas déformer, recolorer ou modifier le logo.</p>

      <h2>Vidéos</h2>
      <p>Quatre vidéos d'environ 30 secondes, en français, avec sous-titres.</p>
      <div className="medias__grille medias__grille--videos">
        {ORDRE_VIDEOS.map((cle) => {
          const v = VIDEOS[cle];
          return (
            <figure key={cle} className="medias__carte">
              {/* Lecteur natif : rien n'est chargé avant « lecture » (preload none). */}
              <video className="medias__video" controls preload="none" poster={`/videos/${v.fichier}.jpg`} width="1280" height="720">
                <source src={`/videos/${v.fichier}.mp4`} type="video/mp4" />
                <track kind="captions" srcLang="fr" label="Français" src={`/videos/${v.fichier}.fr.vtt`} />
              </video>
              <figcaption>
                <strong>{v.titre}</strong>
                <span>{v.duree}, 1280 × 720</span>
                <span className="medias__liens">
                  <Telecharger href={`/videos/${v.fichier}.mp4`}>MP4</Telecharger>
                  <Telecharger href={`/videos/${v.fichier}.jpg`}>Image</Telecharger>
                  <Telecharger href={`/videos/${v.fichier}.fr.vtt`}>Sous-titres</Telecharger>
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>

      <h2>Images</h2>
      <div className="medias__grille">
        {IMAGES.map((i) => (
          <figure key={i.fichier} className="medias__carte">
            <div className="medias__apercu medias__apercu--image">
              <img src={i.fichier} alt={i.titre} loading="lazy" />
            </div>
            <figcaption>
              <strong>{i.titre}</strong>
              <span>{i.detail}</span>
              <Telecharger href={i.fichier}>Télécharger</Telecharger>
            </figcaption>
          </figure>
        ))}
      </div>

      <h2>Utilisation</h2>
      <p>
        Ces fichiers peuvent être utilisés librement pour un reportage ou un article sur Snowro, avec la mention
        « Snowro ». Pour tout autre usage, écrivez-nous à <a href={`mailto:${CONTACT.courriel}`}>{CONTACT.courriel}</a>.
      </p>
    </PageLegale>
  );
}

// Planche des logos, grand format (route /medias/planche, en dev seulement) :
// sert à produire les PNG de public/medias/ (docs/medias.md).
export function PlancheLogos() {
  return (
    <div className="medias__planche">
      <div data-logo="snowro-logo" className="medias__lockup">
        <SnowroSymbol variant="x" neige surTuile size={240} />
        <span className="medias__lockup-texte">snowro</span>
      </div>
      <div data-logo="snowro-logo-inverse" className="medias__lockup medias__lockup--inverse">
        <SnowroSymbol variant="reversed" neige size={240} />
        <span className="medias__lockup-texte">snowro</span>
      </div>
      <div data-logo="snowro-symbole" className="medias__symbole">
        <SnowroSymbol variant="x" neige surTuile size={1024 / 3} />
      </div>
    </div>
  );
}
