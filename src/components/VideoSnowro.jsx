import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./VideoSnowro.css";

// Les quatre vidéos de présentation (public/videos/) : MP4 web, image
// d'aperçu et sous-titres français. Rien n'est chargé avant le clic.
export const VIDEOS = {
  enBref: { fichier: "snowro-en-bref", titre: "Snowro en bref", duree: "30 s" },
  faireDeneiger: { fichier: "snowro-faire-deneiger", titre: "Faire déneiger avec Snowro", duree: "35 s" },
  deneiger: { fichier: "snowro-deneiger", titre: "Déneiger avec Snowro", duree: "30 s" },
  confiance: { fichier: "snowro-la-confiance", titre: "Ce qui vous protège avec Snowro", duree: "35 s" },
};

// Vignette cliquable qui ouvre la vidéo dans un lecteur plein écran.
export default function VideoSnowro({ video, libelle, sombre = false, className = "" }) {
  const [ouvert, setOuvert] = useState(false);
  const v = VIDEOS[video];
  return (
    <>
      <button
        type="button"
        className={`video-lien ${sombre ? "video-lien--sombre" : ""} ${className}`}
        onClick={() => setOuvert(true)}
      >
        <span className="video-lien__vignette" aria-hidden="true">
          <img src={`/videos/${v.fichier}.jpg`} alt="" loading="lazy" width="128" height="72" />
          <span className="video-lien__lecture">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path d="M8 5 L19 12 L8 19 Z" fill="currentColor" />
            </svg>
          </span>
        </span>
        <span className="video-lien__texte">
          <b>{libelle}</b>
          <span>Vidéo avec son · {v.duree}</span>
        </span>
      </button>
      {ouvert && <LecteurVideo v={v} onFermer={() => setOuvert(false)} />}
    </>
  );
}

function LecteurVideo({ v, onFermer }) {
  const boite = useRef(null);
  const lecteur = useRef(null);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;

  useEffect(() => {
    const precedent = document.activeElement;
    boite.current?.querySelector(".lecteur-video__fermer")?.focus();
    const touche = (e) => e.key === "Escape" && fermer.current();
    document.addEventListener("keydown", touche);
    const defilement = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Ouvert par un clic : le navigateur permet de jouer avec le son.
    lecteur.current?.play?.().catch(() => {});
    return () => {
      document.removeEventListener("keydown", touche);
      document.body.style.overflow = defilement;
      precedent?.focus?.();
    };
  }, []);

  // Rendu dans <body> : une section avec son propre contexte d'empilement ne peut pas le recouvrir.
  return createPortal(
    <div className="lecteur-video" onClick={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="lecteur-video__boite" role="dialog" aria-modal="true" aria-label={v.titre} ref={boite}>
        <div className="lecteur-video__haut">
          <span>{v.titre}</span>
          <button type="button" className="lecteur-video__fermer" onClick={onFermer}>
            Fermer
          </button>
        </div>
        <video
          ref={lecteur}
          className="lecteur-video__video"
          src={`/videos/${v.fichier}.mp4`}
          poster={`/videos/${v.fichier}.jpg`}
          controls
          playsInline
          preload="metadata"
        >
          <track kind="captions" srcLang="fr" label="Français" src={`/videos/${v.fichier}.fr.vtt`} />
        </video>
      </div>
    </div>,
    document.body,
  );
}
