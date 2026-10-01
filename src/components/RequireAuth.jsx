import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  // On revient à la page demandée après la connexion (ex. le lien d'un
  // courriel « Marc t'a écrit », qui ouvre la conversation).
  if (!user) return <Navigate to="/connexion" replace state={{ depuis: location.pathname + location.search }} />;
  return children;
}
