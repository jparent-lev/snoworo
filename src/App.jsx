import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import DemandesX from "./pages/DemandesX";
import PublierDemande from "./pages/PublierDemande";
import Parametres from "./pages/Parametres";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/connexion" element={<Login />} />
      <Route path="/inscription" element={<Signup />} />

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
