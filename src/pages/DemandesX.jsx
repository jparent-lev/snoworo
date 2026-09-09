import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ecouterDemandesOuvertes } from "../lib/demandes";
import { decoderGeohash, distanceMetres } from "../lib/geo";
import DemandeCard from "../components/DemandeCard";
import "./DemandesX.css";

export default function DemandesX() {
  const { user } = useAuth();
  const [demandes, setDemandes] = useState([]);
  const [position, setPosition] = useState(null);

  useEffect(() => ecouterDemandesOuvertes(setDemandes), []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setPosition(null),
    );
  }, []);

  const demandesAvecDistance = useMemo(() => {
    return demandes
      .filter((d) => d.donneurOuvrageId !== user?.uid)
      .map((d) => {
        let distanceM = null;
        if (position && d.adresseGeohash) {
          try {
            distanceM = distanceMetres(position, decoderGeohash(d.adresseGeohash));
          } catch {
            distanceM = null;
          }
        }
        return { ...d, distanceM };
      })
      .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  }, [demandes, position, user]);

  return (
    <div className="demandes-x__page">
      <header className="demandes-x__entete">
        <h1>Demandes près de toi</h1>
        <Link to="/publier" className="demandes-x__lien-publier">
          Publier une demande
        </Link>
      </header>

      {demandesAvecDistance.length === 0 ? (
        <p className="demandes-x__vide">Aucune demande ouverte pour l'instant.</p>
      ) : (
        <div className="demandes-x__grille">
          {demandesAvecDistance.map((d) => (
            <DemandeCard
              key={d.id}
              deneigeurId={user.uid}
              demande={{
                id: d.id,
                donneurOuvrageId: d.donneurOuvrageId,
                statut: d.statut,
                distanceM: d.distanceM ?? "?",
                quartier: d.quartier ?? "",
                titre: d.titre,
                description: d.description,
                montant: d.remunerationOfferte,
                donneurPrenom: d.donneurPrenom,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
