import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { onIdTokenChanged } from "firebase/auth";
import LienTemoins from "./LienTemoins";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useMode } from "../lib/mode";
import SnowroLockup from "./brand/SnowroLockup";
import SnowroSymbol from "./brand/SnowroSymbol";
import VersionFooter from "./VersionFooter";
import { etapesRequisesManquantes } from "../lib/etapes";
import BandeauCourriel from "./BandeauCourriel";
import "./Layout.css";

export default function Layout() {
  const { user, profile } = useAuth();
  const { mode, changerMode, deuxRoles } = useMode(user?.uid, profile?.role ?? []);
  const etapesAFaire = etapesRequisesManquantes(profile);
  // Lien « Admin » : revendication posée par le serveur (metriquesAdmin) ;
  // l'accès lui-même est revérifié par le serveur à chaque appel.
  const [admin, setAdmin] = useState(false);
  useEffect(
    () =>
      onIdTokenChanged(auth, (u) => {
        if (!u) return setAdmin(false);
        u.getIdTokenResult()
          .then((r) => setAdmin(r.claims.admin === true))
          .catch(() => setAdmin(false));
      }),
    [],
  );

  return (
    <div className="layout">
      <header className="layout__entete">
        <Link to="/tableau-de-bord" className="layout__logo">
          <span className="layout__logo-complet">
            {/* Sans le qualifiant « X » : on n'évoque pas les offres (Snowro X, Pro)
                tant que Pro n'est pas développé. */}
            <SnowroLockup qualifiant={null} size={30} />
          </span>
          {/* Sur mobile, le symbole seul : l'en-tête doit aussi loger la bascule. */}
          <span className="layout__logo-court">
            <SnowroSymbol variant="x" size={30} />
          </span>
        </Link>
        {user && (
          <nav className="layout__nav">
            {deuxRoles && (
              <div className="layout__bascule" role="radiogroup" aria-label="Mode">
                {[
                  ["client", "Client"],
                  ["deneigeur", "Déneigeur"],
                ].map(([cle, libelle]) => (
                  <button
                    key={cle}
                    type="button"
                    role="radio"
                    aria-checked={mode === cle}
                    className={mode === cle ? "layout__bascule--actif" : ""}
                    onClick={() => changerMode(cle)}
                  >
                    {libelle}
                  </button>
                ))}
              </div>
            )}
            {admin && (
              <Link to="/admin" className="layout__parametres">
                Admin
              </Link>
            )}
            <Link to="/parametres" className="layout__parametres">
              Paramètres
              {etapesAFaire > 0 && (
                <span className="layout__pastille" aria-label={`${etapesAFaire} étape${etapesAFaire > 1 ? "s" : ""} à faire`}>
                  {etapesAFaire}
                </span>
              )}
            </Link>
            <button type="button" onClick={() => signOut(auth)} className="layout__deconnexion">
              Déconnexion
            </button>
          </nav>
        )}
      </header>
      <BandeauCourriel />
      <main>
        <Outlet context={{ mode, changerMode }} />
      </main>
      <footer className="layout__pied">
        <nav className="layout__aide" aria-label="Aide">
          <Link to="/#faq">Aide</Link>
          <Link to="/nous-ecrire">Nous écrire</Link>
          <Link to="/confidentialite">Confidentialité</Link>
          <Link to="/conditions">Conditions</Link>
          <LienTemoins />
        </nav>
        <VersionFooter />
      </footer>
    </div>
  );
}
