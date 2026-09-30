import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ecouterMesDemandes } from "../../lib/demandes";
import { annulerDemande, augmenterOffre, confirmerJob, messageErreur } from "../../lib/cycleDemande";
import { formatArgent } from "../../lib/formatArgent";
import { dateCourte, dureeRestante, echeance, ilYa } from "../../lib/temps";
import Rangee from "../../components/Rangee";
import { Etapes, Modale, ModaleSignalement, Personne } from "./elements";
import "./Tableau.css";

const FILTRES = [
  { cle: "en_cours", libelle: "En cours", statuts: ["faite", "matchee", "ouverte", "signalee"] },
  { cle: "a_confirmer", libelle: "À confirmer", statuts: ["faite"] },
  { cle: "en_attente", libelle: "En attente", statuts: ["ouverte"] },
  { cle: "acceptees", libelle: "Acceptées", statuts: ["matchee"] },
];
// Ce qui attend une action du client passe en premier.
const PRIORITE = { faite: 0, signalee: 1, matchee: 2, ouverte: 3 };

export default function TableauClient() {
  const { user, profile } = useAuth();
  const [demandes, setDemandes] = useState(null);
  const [filtre, setFiltre] = useState("en_cours");

  useEffect(() => ecouterMesDemandes(user.uid, setDemandes), [user.uid]);

  const { enCours, historique } = useMemo(() => {
    const liste = demandes ?? [];
    return {
      enCours: liste.filter((d) => d.statut in PRIORITE).sort((a, b) => PRIORITE[a.statut] - PRIORITE[b.statut]),
      historique: liste.filter((d) => d.statut === "completee" || d.statut === "annulee"),
    };
  }, [demandes]);

  const filtres = FILTRES.map((f) => ({ ...f, compte: enCours.filter((d) => f.statuts.includes(d.statut)).length }));
  const affichees = enCours.filter((d) => FILTRES.find((f) => f.cle === filtre).statuts.includes(d.statut));
  const prenom = (profile?.displayName || "").split(" ")[0];

  return (
    <div className="tableau">
      <div className="tableau__salut">
        <div>
          <h1>Salut{prenom ? ` ${prenom}` : ""}</h1>
          <p>Tes demandes de déneigement</p>
        </div>
        <Link to="/publier" className="btn btn--principal">
          + Publier une demande
        </Link>
      </div>
      <p className="tableau__simulation">Période de test : aucun paiement réel n'est fait pour l'instant.</p>

      {demandes && (
        <Rangee
          titre="Mes demandes"
          compte={`${enCours.length} en cours`}
          filtres={filtres}
          filtreActif={filtre}
          onFiltre={setFiltre}
          vide={
            enCours.length === 0
              ? "Aucune demande en cours. Publie-en une : les déneigeurs de quartier de ta ville sont avertis tout de suite."
              : "Rien dans cette catégorie pour l'instant."
          }
        >
          {affichees.map((d) => (
            <CarteDemandeClient key={d.id} demande={d} />
          ))}
        </Rangee>
      )}

      {historique.length > 0 && (
        <section>
          <h2 className="rangee__titre" style={{ marginBottom: 12 }}>
            Historique
          </h2>
          <div className="historique">
            {historique.map((d) => (
              <div key={d.id} className="historique__rang">
                <span className="historique__date">{dateCourte(d.confirmeeAt ?? d.annuleeAt ?? d.createdAt)}</span>
                <span>
                  {d.titre}
                  {d.statut === "annulee" ? (
                    <i> · annulée</i>
                  ) : (
                    <>
                      {" "}
                      · {d.deneigeurPrenom}
                      {d.confirmationAuto ? <i> · confirmée automatiquement</i> : null}
                    </>
                  )}
                </span>
                <b>{formatArgent(d.remunerationOfferte)}</b>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CarteDemandeClient({ demande: d }) {
  const [modale, setModale] = useState(null); // "augmenter" | "annuler" | "signaler"
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function agir(action) {
    setEnCours(true);
    setErreur(null);
    try {
      await action();
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  const attention = d.statut === "faite";

  return (
    <article className={`carte-job ${attention ? "carte-job--attention" : ""}`}>
      <div className="carte-job__haut">
        {d.statut === "ouverte" && <span className="badge badge--ocre">En attente d'un déneigeur</span>}
        {d.statut === "matchee" && <span className="badge badge--ardoise">Acceptée</span>}
        {d.statut === "faite" && <span className="badge badge--argile">À confirmer</span>}
        {d.statut === "signalee" && <span className="badge badge--gris">Problème signalé</span>}
        <span className="carte-job__meta">{ilYa(d.statut === "faite" ? d.faiteAt : d.createdAt)}</span>
      </div>
      <div className="carte-job__titre">{d.titre}</div>

      {d.deneigeurPrenom && (
        <Personne
          prenom={d.deneigeurPrenom}
          note={d.deneigeurNote}
          texte={d.statut === "faite" ? `${d.deneigeurPrenom} dit que c'est fait` : `${d.deneigeurPrenom} s'en occupe`}
        />
      )}

      <div className="carte-job__ligne">
        <span className="heure">⏱ {echeance(d.dateHeureSouhaitee)}</span>
        <span className="carte-job__prix">{formatArgent(d.remunerationOfferte)}</span>
      </div>

      {d.statut === "ouverte" && (
        <p className="carte-job__note">
          Visible par les déneigeurs de quartier de <b>{d.ville}</b>. Personne encore ? Une offre un peu plus haute
          part souvent plus vite.
        </p>
      )}
      {d.statut === "matchee" && (
        <p className="carte-job__note">Paiement retenu par Snowro jusqu'à ce que la job soit confirmée.</p>
      )}
      {d.statut === "faite" && (
        <p className="carte-job__note">
          Confirmée automatiquement dans <b>{dureeRestante(d.confirmationAutoAt)}</b> si tu ne fais rien. Le paiement de{" "}
          <b>{formatArgent(d.remunerationOfferte)}</b> sera alors versé à {d.deneigeurPrenom}.
        </p>
      )}
      {d.statut === "signalee" && (
        <p className="carte-job__note">On regarde ça et on te revient par courriel. Aucun versement ne part d'ici là.</p>
      )}
      {erreur && <p className="carte-job__erreur">{erreur}</p>}

      <div className="carte-job__actions">
        {d.statut === "ouverte" && (
          <>
            <button type="button" className="btn btn--ardoise btn--petit" onClick={() => setModale("augmenter")}>
              Augmenter l'offre
            </button>
            <button type="button" className="btn btn--fantome btn--petit" onClick={() => setModale("annuler")}>
              Annuler
            </button>
          </>
        )}
        {d.statut === "faite" && (
          <>
            <button
              type="button"
              className="btn btn--principal btn--petit"
              disabled={enCours}
              onClick={() => agir(() => confirmerJob({ demandeId: d.id }))}
            >
              {enCours ? "Confirmation…" : "Confirmer"}
            </button>
            <button type="button" className="btn btn--fantome btn--petit" onClick={() => setModale("signaler")}>
              Signaler un problème
            </button>
          </>
        )}
        {d.statut === "matchee" && (
          <button type="button" className="btn btn--lien" onClick={() => setModale("signaler")}>
            Signaler un problème
          </button>
        )}
      </div>

      <Etapes demande={d} />

      {modale === "augmenter" && (
        <ModaleAugmenter demande={d} onFermer={() => setModale(null)} />
      )}
      {modale === "annuler" && (
        <Modale titre="Annuler cette demande ?" onFermer={() => setModale(null)}>
          <p>Personne ne l'a encore prise : tu peux l'annuler sans frais. Elle disparaît de la liste des déneigeurs.</p>
          <div className="modale__actions">
            <button type="button" className="btn btn--fantome" onClick={() => setModale(null)}>
              La garder
            </button>
            <button
              type="button"
              className="btn btn--principal"
              onClick={() => {
                setModale(null);
                agir(() => annulerDemande({ demandeId: d.id }));
              }}
            >
              Annuler la demande
            </button>
          </div>
        </Modale>
      )}
      {modale === "signaler" && <ModaleSignalement demande={d} par="client" onFermer={() => setModale(null)} />}
    </article>
  );
}

function ModaleAugmenter({ demande, onFermer }) {
  const [montant, setMontant] = useState(String(demande.remunerationOfferte + 5));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function envoyer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      await augmenterOffre({ demandeId: demande.id, montant: Number(montant) });
      onFermer();
    } catch (err) {
      setErreur(messageErreur(err));
      setEnCours(false);
    }
  }

  return (
    <Modale titre="Augmenter l'offre" onFermer={onFermer}>
      <p>Offre actuelle : {formatArgent(demande.remunerationOfferte)}. La nouvelle offre est montrée tout de suite aux déneigeurs.</p>
      <form onSubmit={envoyer} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Nouvelle offre ($)
          <input
            type="number"
            min={demande.remunerationOfferte + 1}
            max={1000}
            step="1"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            required
          />
        </label>
        {erreur && <p className="carte-job__erreur">{erreur}</p>}
        <div className="modale__actions">
          <button type="button" className="btn btn--fantome" onClick={onFermer}>
            Retour
          </button>
          <button type="submit" className="btn btn--principal" disabled={enCours}>
            {enCours ? "Envoi…" : "Augmenter"}
          </button>
        </div>
      </form>
    </Modale>
  );
}
