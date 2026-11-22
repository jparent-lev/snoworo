import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { etapesDemarrage } from "../lib/etapes";
import { ROLE_CLIENT, ROLE_DENEIGEUR } from "../lib/mode";
import { PAIEMENT_REEL } from "../lib/paiements";
import "./MenuProfil.css";

// Menu de profil de l'en-tête : une pastille aux initiales qui ouvre un petit
// menu (étapes à faire, paramètres, aide, déconnexion). La déconnexion n'est
// plus au bas des Paramètres, à côté de « Fermer mon compte » (risque de
// confusion, retour d'utilisateur de novembre 2026).
const initiales = (nom) =>
  String(nom ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0].toUpperCase())
    .join("") || "?";

export default function MenuProfil({ user, profile, admin }) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);
  const { pathname, hash } = useLocation();
  const roles = profile?.role ?? [];
  const etapes = etapesDemarrage(profile).filter((e) => e.requis && !e.fait);
  const nom = profile?.displayName || user?.displayName || "";

  // Ferme le menu en changeant de page, au clic ailleurs et avec Échap.
  useEffect(() => setOuvert(false), [pathname, hash]);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e) => !zone.current?.contains(e.target) && setOuvert(false);
    const touche = (e) => {
      if (e.key !== "Escape") return;
      setOuvert(false);
      zone.current?.querySelector(".menu-profil__bouton")?.focus();
    };
    document.addEventListener("pointerdown", dehors);
    document.addEventListener("keydown", touche);
    zone.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", dehors);
      document.removeEventListener("keydown", touche);
    };
  }, [ouvert]);

  // Flèches haut et bas entre les choix du menu.
  function naviguer(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...zone.current.querySelectorAll('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  }

  return (
    <div className="menu-profil" ref={zone}>
      <button
        type="button"
        className="menu-profil__bouton"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label="Mon compte"
        onClick={() => setOuvert((o) => !o)}
      >
        <span aria-hidden="true">{initiales(nom)}</span>
        {etapes.length > 0 && (
          <span className="menu-profil__pastille" aria-label={`${etapes.length} étape${etapes.length > 1 ? "s" : ""} à faire`}>
            {etapes.length}
          </span>
        )}
      </button>
      {ouvert && (
        <div className="menu-profil__menu" role="menu" aria-label="Mon compte" onKeyDown={naviguer}>
          <div className="menu-profil__identite">
            <strong>{nom || "Mon compte"}</strong>
            {user?.email && <span>{user.email}</span>}
          </div>
          {etapes.length > 0 && (
            <div className="menu-profil__etapes">
              <span className="menu-profil__titre">À faire</span>
              {etapes.map((e) => (
                <Link key={e.cle} to={e.lien} role="menuitem" className="menu-profil__item menu-profil__item--etape">
                  {e.titre}
                </Link>
              ))}
            </div>
          )}
          <Link to="/tableau-de-bord" role="menuitem" className="menu-profil__item">
            Mon tableau de bord
          </Link>
          <Link to="/parametres" role="menuitem" className="menu-profil__item">
            Paramètres
          </Link>
          {roles.includes(ROLE_CLIENT) && (
            <Link to="/parametres#adresses" role="menuitem" className="menu-profil__item">
              Mes adresses
            </Link>
          )}
          {roles.includes(ROLE_DENEIGEUR) && PAIEMENT_REEL && !profile?.parentId && (
            <Link to="/parametres#paiement" role="menuitem" className="menu-profil__item">
              Compte de versement
            </Link>
          )}
          {admin && (
            <Link to="/admin" role="menuitem" className="menu-profil__item">
              Admin
            </Link>
          )}
          <hr className="menu-profil__separateur" />
          <Link to="/#faq" role="menuitem" className="menu-profil__item">
            Aide
          </Link>
          <Link to="/nous-ecrire" role="menuitem" className="menu-profil__item">
            Nous écrire
          </Link>
          <hr className="menu-profil__separateur" />
          <button type="button" role="menuitem" className="menu-profil__item menu-profil__item--sortie" onClick={() => signOut(auth)}>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
