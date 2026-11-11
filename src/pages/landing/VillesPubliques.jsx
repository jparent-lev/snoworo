import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

// Compteur public : déneigeurs de quartier inscrits par ville, calculé chaque
// heure côté serveur (functions/src/villesPubliques.js). Seules les villes
// d'au moins 10 déneigeurs y figurent.
export default function VillesPubliques() {
  const [etat, setEtat] = useState({ charge: false, villes: [], seuil: 10 });

  useEffect(() => {
    let annule = false;
    getDoc(doc(db, "statsPubliques", "villes"))
      .then((s) => !annule && setEtat({ charge: true, villes: s.data()?.villes ?? [], seuil: s.data()?.seuil ?? 10 }))
      .catch(() => !annule && setEtat((e) => ({ ...e, charge: true })));
    return () => {
      annule = true;
    };
  }, []);

  const { charge, villes, seuil } = etat;
  return (
    <>
      <ul className="landing__jetons landing__villes-compteur" aria-label="Déneigeurs de quartier par ville">
        {villes.map((v) => (
          <li key={v.nom} className="landing__jeton">
            {v.nom} <b>{v.deneigeurs}</b>
          </li>
        ))}
        <li>
          <Link to="/inscription" className="landing__jeton landing__jeton--tienne">
            + La vôtre ?
          </Link>
        </li>
      </ul>
      <p className="landing__p landing__p--legende">
        {charge && villes.length === 0
          ? `Les villes s'afficheront ici dès qu'elles compteront ${seuil} déneigeurs de quartier. Votre ville n'y est pas encore ? Inscrivez-vous et parlez-en à vos voisins.`
          : `Nombre de déneigeurs de quartier inscrits, mis à jour chaque heure (villes d'au moins ${seuil}). Votre ville n'y est pas encore ? Inscrivez-vous et parlez-en à vos voisins.`}
      </p>
    </>
  );
}
