import { Link, Outlet } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import SnowroLockup from "./brand/SnowroLockup";
import VersionFooter from "./VersionFooter";
import "./Layout.css";

export default function Layout() {
  const { user } = useAuth();

  return (
    <div className="layout">
      <header className="layout__entete">
        <Link to="/demandes" className="layout__logo">
          <SnowroLockup qualifiant="X" size={30} />
        </Link>
        {user && (
          <nav className="layout__nav">
            <Link to="/parametres">Paramètres</Link>
            <button type="button" onClick={() => signOut(auth)} className="layout__deconnexion">
              Déconnexion
            </button>
          </nav>
        )}
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="layout__pied">
        <VersionFooter />
      </footer>
    </div>
  );
}
