import { useEffect, useRef } from "react";
import { Icone } from "./Decors";
import "./TableauParallaxe.css";

// Section « Tout se passe dans ton tableau de bord » : une scène par élément de
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
        <span className="parallaxe__meta">à 1,4 km de toi</span>
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
        <span>Engagement du déneigeur : la job ne s'annule pas.</span>
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
      "Le déneigeur prend de 1 à 3 photos du travail fini, sur place, avant de marquer la job faite. Tu les vois tout de suite.",
    Visuel: VisuelPhotos,
  },
  {
    icone: "message",
    titre: "Une messagerie privée",
    texte:
      "Dès que la job est acceptée, vous vous écrivez dans Snowro. Pas besoin d'échanger vos numéros de téléphone.",
    Visuel: VisuelMessagerie,
  },
  {
    icone: "epingle",
    titre: "Ton adresse protégée",
    texte: "Seul le déneigeur qui accepte voit l'adresse exacte. Les autres voient le quartier et la distance.",
    Visuel: VisuelAdresse,
  },
  {
    icone: "horloge",
    titre: "12 heures pour vérifier",
    texte: "Tu confirmes ou tu signales un problème. Le paiement part au déneigeur seulement après.",
    Visuel: VisuelVerification,
  },
  {
    icone: "engagement",
    titre: "Une job acceptée ne s'annule pas",
    texte: "Personne ne laisse tomber ta job pour une plus payante : accepter, c'est s'engager.",
    Visuel: VisuelEngagement,
  },
];

export default function TableauParallaxe() {
  const racine = useRef(null);

  useEffect(() => {
    const el = racine.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const scenes = Array.from(el.querySelectorAll(".parallaxe__scene"));
    let image = 0;
    const maj = () => {
      image = 0;
      const h = window.innerHeight;
      for (const s of scenes) {
        const r = s.getBoundingClientRect();
        if (r.bottom < -h || r.top > 2 * h) continue;
        // 1 quand le centre de la scène est tout en bas de l'écran, -1 tout en haut.
        const p = (r.top + r.height / 2 - h / 2) / (h / 2 + r.height / 2);
        s.style.setProperty("--p", Math.max(-1, Math.min(1, p)).toFixed(3));
      }
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

  return (
    <div ref={racine} className="parallaxe">
      {SCENES.map(({ icone, titre, texte, Visuel }, i) => (
        <article key={titre} className={`parallaxe__scene${i % 2 ? " parallaxe__scene--inverse" : ""}`}>
          <span className="parallaxe__numero" aria-hidden="true">
            {i + 1}
          </span>
          <div className="parallaxe__texte">
            <Icone nom={icone} />
            <h3 className="parallaxe__titre">{titre}</h3>
            <p className="parallaxe__p">{texte}</p>
          </div>
          <div className="parallaxe__visuel">
            <Visuel />
          </div>
        </article>
      ))}
    </div>
  );
}
