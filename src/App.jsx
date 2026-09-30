import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import DemandesX from "./pages/DemandesX";
import PublierDemande from "./pages/PublierDemande";
import Parametres from "./pages/Parametres";
import Confidentialite from "./pages/Confidentialite";
import Conditions from "./pages/Conditions";
import NousEcrire from "./pages/NousEcrire";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/connexion" element={<Login />} />
      <Route path="/inscription" element={<Signup />} />
      <Route path="/confidentialite" element={<Confidentialite />} />
      <Route path="/conditions" element={<Conditions />} />
      <Route path="/nous-ecrire" element={<NousEcrire />} />

      <Route element={<Layout />}>
        <Route
          path="/demandes"
          element={
            <RequireAuth>
              <DemandesX />
            </RequireAuth>
          }
        />
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
