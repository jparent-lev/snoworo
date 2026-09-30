import { Link, Outlet } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { useMode } from "../lib/mode";
import SnowroLockup from "./brand/SnowroLockup";
import SnowroSymbol from "./brand/SnowroSymbol";
import VersionFooter from "./VersionFooter";
import "./Layout.css";

export default function Layout() {
  const { user, profile } = useAuth();
  const { mode, changerMode, deuxRoles } = useMode(user?.uid, profile?.role ?? []);

  return (
    <div className="layout">
      <header className="layout__entete">
        <Link to="/tableau-de-bord" className="layout__logo">
          <span className="layout__logo-complet">
            <SnowroLockup qualifiant="X" size={30} />
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
            <Link to="/parametres">Paramètres</Link>
            <button type="button" onClick={() => signOut(auth)} className="layout__deconnexion">
              Déconnexion
            </button>
          </nav>
        )}
      </header>
      <main>
        <Outlet context={{ mode, changerMode }} />
      </main>
      <footer className="layout__pied">
        <VersionFooter />
      </footer>
    </div>
  );
}
