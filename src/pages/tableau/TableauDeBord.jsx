import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import TableauClient from "./TableauClient";
import TableauDeneigeur from "./TableauDeneigeur";
import { ChoixRoles } from "./elements";
import "./Tableau.css";

// Point d'entrée après connexion : le mode (Client / Déneigeur) vient de la
// bascule de l'en-tête (Layout). Un compte sans rôle choisit d'abord.
export default function TableauDeBord() {
  const { profile } = useAuth();
  const { mode } = useOutletContext();

  if (!profile) return null;
  if (!(profile.role ?? []).length) return <PremierChoix />;
  return mode === "deneigeur" ? <TableauDeneigeur /> : <TableauClient />;
}

function PremierChoix() {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [enCours, setEnCours] = useState(false);

  async function valider() {
    setEnCours(true);
    await setDoc(doc(db, "users", user.uid), { role: roles }, { merge: true });
  }

  return (
    <div className="tableau" style={{ maxWidth: 640 }}>
      <div>
        <h1 style={{ fontSize: 30 }}>Comment veux-tu utiliser Snowro ?</h1>
        <p className="carte-job__meta" style={{ marginTop: 6, fontSize: 15 }}>
          Tu peux choisir les deux, et changer d'idée en tout temps dans tes paramètres.
        </p>
      </div>
      <ChoixRoles valeur={roles} onChange={setRoles} />
      <button type="button" className="btn btn--principal" disabled={!roles.length || enCours} onClick={valider}>
        {enCours ? "Un instant…" : "Continuer"}
      </button>
    </div>
  );
}
