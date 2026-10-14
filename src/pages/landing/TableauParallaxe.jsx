import { useEffect, useRef, useState } from "react";
import { Icone } from "./Decors";
import "./TableauParallaxe.css";

// Section « Tout se passe dans votre tableau de bord » : une scène par élément de
// confiance, chacune avec son visuel. Au défilement, le visuel et le texte se
// déplacent à des vitesses différentes (parallaxe) : la variable --p va de -1
// (scène sous l'écran) à 1 (scène au-dessus). Sans mouvement si l'utilisateur
// préfère les animations réduites.

function PhotoNeige({ variante }) {
  return (
    <svg viewBox="0 0 80 60" className="parallaxe__photo" aria-hidden="true">
      <rect width="80" height="60" fill="#DCE6E8" />
      <rect y="34" width="80" height="26" fill="#F4F6F7" />
      {variante === 1 ? (
        <>
          <rect x="8" y="12" width="30" height="24" fill="#C1652F" />
          <rect x="15" y="20" width="8" height="16" fill="#3B2A1F" />
          <path d="M19 36 L30 60 L48 60 L26 36 Z" fill="#8E9AA0" />
          <path d="M0 40 Q10 35 18 38 L15 60 L0 60 Z M40 38 Q55 33 80 40 L80 60 L52 60 Z" fill="#FFFFFF" />
        </>
      ) : (
        <>
          <rect x="36" y="10" width="36" height="26" fill="#9E4E23" />
          <rect x="44" y="18" width="10" height="9" fill="#EDE0CC" />
          <path d="M6 44 H70 V58 H6 Z" fill="#8E9AA0" />
          <path d="M0 42 Q4 38 8 42 V60 H0 Z M70 42 Q76 37 80 42 V60 H70 Z" fill="#FFFFFF" />
        </>
      )}
    </svg>
  );
}

// Cadre de téléphone autour de chaque visuel : barre d'état, en-tête de
// l'app Snowro, puis l'écran de la fonctionnalité.
function Telephone({ children }) {
  return (
    <div className="parallaxe__telephone" aria-hidden="true">
      <div className="parallaxe__telephone-ecran">
        <div className="parallaxe__telephone-encoche" />
        <div className="parallaxe__telephone-entete">
          <span className="parallaxe__telephone-logo">snowro</span>
          <span className="parallaxe__telephone-pastille" />
        </div>
        <div className="parallaxe__telephone-contenu">{children}</div>
      </div>
    </div>
  );
}

function VisuelPhotos() {
  return (
    <div className="parallaxe__carte">
      <div className="parallaxe__haut">
        <span className="parallaxe__badge">À confirmer</span>
        <span className="parallaxe__meta">il y a 4 min</span>
      </div>
      <div className="parallaxe__carte-titre">Entrée double + balcon</div>
      <div className="parallaxe__photos">
        <PhotoNeige variante={1} />
        <PhotoNeige variante={2} />
      </div>
      <span className="parallaxe__legende">📷 2 photos prises à 7 h 52</span>
    </div>
  );
}

function VisuelMessagerie() {
  return (
    <div className="parallaxe__carte parallaxe__carte--fil">
      <div className="parallaxe__bulle">
        <span className="parallaxe__bulle-qui">Marc · 7 h 53</span>
        J'ai aussi dégagé les marches du balcon. Bonne journée !
      </div>
      <div className="parallaxe__bulle parallaxe__bulle--moi">
        <span className="parallaxe__bulle-qui">Mireille · 7 h 58</span>
        Merci beaucoup, c'est parfait !
      </div>
      <div className="parallaxe__saisie">Écrire à Marc…</div>
    </div>
  );
}

function VisuelAdresse() {
  return (
    <div className="parallaxe__carte parallaxe__carte--adresse">
      <div className="parallaxe__vue">
        <span className="parallaxe__vue-etiquette">Ce que les autres voient</span>
        <b>Vieux-Limoilou</b>
        <span className="parallaxe__meta">à 1,4 km de vous</span>
      </div>
      <div className="parallaxe__vue parallaxe__vue--accepte">
        <span className="parallaxe__vue-etiquette">Seulement après avoir accepté</span>
        <b>1234, 3e Avenue, Québec</b>
        <span className="parallaxe__meta">Mireille · Marches du balcon aussi</span>
      </div>
    </div>
  );
}

function VisuelVerification() {
  return (
    <div className="parallaxe__carte">
      <div className="parallaxe__minuterie">
        <b>12 h</b>
        <span className="parallaxe__meta">pour vérifier le travail</span>
      </div>
      <div className="parallaxe__actions">
        <span className="parallaxe__bouton parallaxe__bouton--principal">Confirmer</span>
        <span className="parallaxe__bouton">Signaler un problème</span>
      </div>
      <div className="parallaxe__etapes">
        {["Publiée", "Acceptée", "Faite", "Confirmée"].map((e, i) => (
          <span key={e} className={i < 2 ? "fait" : i === 2 ? "encours" : ""}>
            {e}
          </span>
        ))}
      </div>
      <span className="parallaxe__legende">Le paiement part au déneigeur seulement après.</span>
    </div>
  );
}

function VisuelEngagement() {
  return (
    <div className="parallaxe__carte parallaxe__carte--engagement">
      <div className="parallaxe__haut">
        <span className="parallaxe__badge parallaxe__badge--ardoise">Acceptée</span>
        <span className="parallaxe__meta">Demain avant 8 h</span>
      </div>
      <div className="parallaxe__carte-titre">Entrée double + balcon</div>
      <div className="parallaxe__engage">
        <Icone nom="engagement" />
        <span>Engagement du déneigeur : la demande ne s'annule pas.</span>
      </div>
      <b className="parallaxe__montant">39,40 $</b>
    </div>
  );
}

const SCENES = [
  {
    icone: "photo",
    titre: "Des photos avant de partir",
    texte:
      "Le déneigeur prend de 1 à 3 photos du travail fini, sur place, avant de marquer la demande faite. Vous les voyez tout de suite.",
    Visuel: VisuelPhotos,
  },
  {
    icone: "message",
    titre: "Une messagerie privée",
    texte:
      "Dès que la demande est acceptée, vous vous écrivez dans Snowro. Inutile d'échanger vos numéros de téléphone.",
    Visuel: VisuelMessagerie,
  },
  {
    icone: "epingle",
    titre: "Votre adresse protégée",
    texte: "Seul le déneigeur qui accepte voit l'adresse exacte. Les autres voient le quartier et la distance.",
    Visuel: VisuelAdresse,
  },
  {
    icone: "horloge",
    titre: "12 heures pour vérifier",
    texte: "Vous confirmez ou signalez un problème. Le paiement part au déneigeur seulement après.",
    Visuel: VisuelVerification,
  },
  {
    icone: "engagement",
    titre: "Une demande acceptée ne s'annule pas",
    texte: "Personne ne laisse tomber votre demande pour une plus payante : accepter, c'est s'engager.",
    Visuel: VisuelEngagement,
  },
];

const HAUTEUR_ETAPE_VH = 85;

export default function TableauParallaxe() {
  const racine = useRef(null);
  const [actif, setActif] = useState(0);

  useEffect(() => {
    const el = racine.current;
    if (!el) return undefined;
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let image = 0;
    let dernier = 0;
    const maj = () => {
      image = 0;
      const r = el.getBoundingClientRect();
      const course = r.height - window.innerHeight;
      const avance = course > 0 ? Math.max(0, Math.min(0.9999, -r.top / course)) : 0;
      const pos = avance * SCENES.length;
      const idx = Math.floor(pos);
      if (idx !== dernier) {
        dernier = idx;
        setActif(idx);
      }
      if (!reduit) el.style.setProperty("--etape", (pos - idx).toFixed(3));
    };
    const demander = () => {
      if (!image) image = requestAnimationFrame(maj);
    };
    maj();
    window.addEventListener("scroll", demander, { passive: true });
    window.addEventListener("resize", demander);
    return () => {
      window.removeEventListener("scroll", demander);
      window.removeEventListener("resize", demander);
      cancelAnimationFrame(image);
    };
  }, []);

  // Clic sur la navigation : on fait défiler la page jusqu'à l'élément voulu.
  const aller = (i) => {
    const el = racine.current;
    if (!el) return;
    const course = el.offsetHeight - window.innerHeight;
    const haut = el.getBoundingClientRect().top + window.scrollY;
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: haut + ((i + 0.5) / SCENES.length) * course, behavior: reduit ? "auto" : "smooth" });
  };

  return (
    <div
      ref={racine}
      className="parcours"
      style={{ height: `${SCENES.length * HAUTEUR_ETAPE_VH}vh`, "--etape": 0 }}
    >
      <div className="parcours__collant">
        <ol className="parcours__nav" aria-label="Éléments du tableau de bord">
          {SCENES.map((sc, i) => (
            <li key={sc.titre} className={`parcours__item${i === actif ? " parcours__item--actif" : ""}`}>
              <button
                type="button"
                className="parcours__bouton"
                aria-current={i === actif ? "step" : undefined}
                onClick={() => aller(i)}
              >
                <span className="parcours__numero">{i + 1}</span>
                <span className="parcours__corps">
                  <span className="parcours__titre">{sc.titre}</span>
                  <span className="parcours__texte">{sc.texte}</span>
                </span>
              </button>
              <span className="parcours__progression" aria-hidden="true" />
            </li>
          ))}
        </ol>

        <div className="parcours__scene">
          <div className="parcours__points" aria-hidden="true">
            {SCENES.map((sc, i) => (
              <span key={sc.titre} className={i === actif ? "parcours__point--actif" : ""} />
            ))}
          </div>
          <div className="parcours__telephone">
            <Telephone>
              <div className="parcours__ecrans">
                {SCENES.map(({ titre, Visuel }, i) => (
                  <div
                    key={titre}
                    className={`parcours__ecran${i === actif ? " parcours__ecran--actif" : ""}`}
                    aria-hidden={i === actif ? undefined : true}
                  >
                    <Visuel />
                  </div>
                ))}
              </div>
            </Telephone>
          </div>
        </div>
      </div>
    </div>
  );
}
