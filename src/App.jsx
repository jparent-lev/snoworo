import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import TableauDeBord from "./pages/tableau/TableauDeBord";
import PublierDemande from "./pages/PublierDemande";
import Parametres from "./pages/Parametres";
import Confidentialite from "./pages/Confidentialite";
import Conditions from "./pages/Conditions";
import NousEcrire from "./pages/NousEcrire";
import CreditImpot from "./pages/creditImpot/CreditImpot";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/connexion" element={<Login />} />
      <Route path="/inscription" element={<Signup />} />
      <Route path="/confidentialite" element={<Confidentialite />} />
      <Route path="/conditions" element={<Conditions />} />
      <Route path="/nous-ecrire" element={<NousEcrire />} />
      <Route path="/credit-impot" element={<CreditImpot />} />

      <Route element={<Layout />}>
        <Route
          path="/tableau-de-bord"
          element={
            <RequireAuth>
              <TableauDeBord />
            </RequireAuth>
          }
        />
        {/* Ancienne adresse, gardée pour les favoris et les liens déjà partagés. */}
        <Route path="/demandes" element={<Navigate to="/tableau-de-bord" replace />} />
        <Route
          path="/publier"
          element={
            <RequireAuth>
              <PublierDemande />
            </RequireAuth>
          }
        />
        <Route
          path="/parametres"
          element={
            <RequireAuth>
              <Parametres />
            </RequireAuth>
          }
        />
      </Route>
    </Routes>
  );
}
