import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { ChoixRoles } from "./tableau/elements";
import { ROLE_DENEIGEUR } from "../lib/mode";
import "./tableau/Tableau.css";
import { useAuth } from "../context/AuthContext";
import { grantConsent, revokeConsent } from "../lib/consents";
import { mettreAJourAdresseParPosition, mettreAJourAdresseParTexte } from "../lib/adresse";
import { encoderGeohash } from "../lib/geo";
import { messageErreur } from "../lib/cycleDemande";
import {
  STATUTS_CONNECT,
  PAIEMENT_REEL,
  libelleCarte,
  lienCompteDeneigeur,
  synchroniserCompteDeneigeur,
} from "../lib/paiements";
import CarteDePaiement from "../components/CarteDePaiement";
import "./Parametres.css";

const CONSENTS = [
  {
    type: "zonesAgregees",
    titre: "Statistiques de zone (Snowro Pro)",
    description: "Permet d'inclure tes demandes, de façon anonyme et agrégée, dans les statistiques vues par les déneigeurs professionnels abonnés.",
  },
  {
    type: "offresCiblees",
    titre: "Offres ciblées",
    description: "Permet à un déneigeur professionnel de te contacter directement avec une offre. Toujours révocable.",
  },
  {
    type: "notificationsSMS",
    titre: "Notifications SMS",
    description: "Reçois un texto quand une demande ouvre près de toi ou quand ton match est confirmé.",
  },
];

export default function Parametres() {
  const { user, profile } = useAuth();
  const [enCours, setEnCours] = useState(null);
  const [erreurAdresse, setErreurAdresse] = useState(null);
  const [majAdresseEnCours, setMajAdresseEnCours] = useState(false);
  const [adresseTexte, setAdresseTexte] = useState("");

  async function basculer(type, accorde) {
    setEnCours(type);
    try {
      if (accorde) await revokeConsent(type);
      else await grantConsent(type);
    } finally {
      setEnCours(null);
    }
  }

  function mettreAJourParPosition() {
    if (!navigator.geolocation) {
      setErreurAdresse("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setErreurAdresse(null);
    setMajAdresseEnCours(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const hash = encoderGeohash(pos.coords.latitude, pos.coords.longitude);
          await mettreAJourAdresseParPosition(hash);
        } catch {
          setErreurAdresse("Impossible de déterminer ta ville à partir de cette position. Réessaie, ou entre ton adresse manuellement.");
        } finally {
          setMajAdresseEnCours(false);
        }
      },
      () => {
        setErreurAdresse("Localisation refusée ou indisponible : entre ton adresse manuellement ci-dessous.");
        setMajAdresseEnCours(false);
      },
      { timeout: 10000 },
    );
  }

  async function mettreAJourParTexte(e) {
    e.preventDefault();
    if (!adresseTexte.trim()) return;
    setErreurAdresse(null);
    setMajAdresseEnCours(true);
    try {
      await mettreAJourAdresseParTexte(adresseTexte.trim());
      setAdresseTexte("");
    } catch {
      setErreurAdresse("Adresse introuvable. Vérifie l'orthographe et réessaie.");
    } finally {
      setMajAdresseEnCours(false);
    }
  }

  if (!profile) return null;

  const roles = profile.role ?? [];
  const changerRoles = (r) => r.length && setDoc(doc(db, "users", user.uid), { role: r }, { merge: true });

  return (
    <div className="parametres__page">
      <h1>Comment tu utilises Snowro</h1>
      <p className="parametres__intro">Tu peux avoir les deux rôles : une bascule Client / Déneigeur apparaît alors en haut.</p>
      <ChoixRoles valeur={roles} onChange={changerRoles} />

      {roles.includes(ROLE_DENEIGEUR) && (
        <>
      <h1>Ton adresse de service</h1>
      <p className="parametres__intro">
        Détermine les demandes que tu peux voir : jamais hors de ta ville, même si la distance semble
        raisonnable.
      </p>

      <div className="parametres__item">
        <div className="parametres__item-texte">
          <h3>{profile.ville ? profile.ville : "Aucune adresse enregistrée"}</h3>
          <p>
            {profile.ville
              ? "Tu vois les demandes ouvertes dans cette ville."
              : "Ajoute ton adresse pour voir les demandes près de chez toi."}
          </p>
          {erreurAdresse && <p className="message-erreur" role="alert">{erreurAdresse}</p>}
        </div>
        <button
          type="button"
          className="auth-form__bouton"
          onClick={mettreAJourParPosition}
          disabled={majAdresseEnCours}
          style={{ flex: "none" }}
        >
          {majAdresseEnCours ? "Localisation…" : profile.ville ? "Mettre à jour" : "Utiliser ma position"}
        </button>
      </div>

      <form className="parametres__adresse-manuelle" onSubmit={mettreAJourParTexte}>
        <label className="auth-form__champ" style={{ flex: 1 }}>
          Ou entre ton adresse
          <input
            type="text"
            value={adresseTexte}
            onChange={(e) => setAdresseTexte(e.target.value)}
            placeholder="123 rue des Érables, Lévis"
            disabled={majAdresseEnCours}
          />
        </label>
        <button type="submit" className="auth-form__bouton" disabled={majAdresseEnCours || !adresseTexte.trim()}>
          {majAdresseEnCours ? "Recherche…" : "Utiliser cette adresse"}
        </button>
      </form>

        </>
      )}

      {PAIEMENT_REEL && <SectionPaiement profile={profile} deneigeur={roles.includes(ROLE_DENEIGEUR)} />}

      <h1>Tes consentements</h1>
      <p className="parametres__intro">
        Chacun de ces consentements est indépendant, daté, et retirable en tout temps, et le retrait est aussi
        simple que l'octroi.
      </p>

      <div className="parametres__liste">
        {CONSENTS.map((c) => {
          const etat = profile.consents?.[c.type];
          const accorde = Boolean(etat?.granted);
          return (
            <div key={c.type} className="parametres__item">
              <div className="parametres__item-texte">
                <h3>{c.titre}</h3>
                <p>{c.description}</p>
                {etat?.grantedAt && (
                  <p className="parametres__meta">
                    {accorde ? "Accordé" : "Retiré"} · version {etat.version}
                  </p>
                )}
              </div>
              <button
                type="button"
                className={`parametres__toggle ${accorde ? "parametres__toggle--actif" : ""}`}
                onClick={() => basculer(c.type, accorde)}
                disabled={enCours === c.type}
                role="switch"
                aria-checked={accorde}
              >
                <span className="parametres__toggle-pastille" />
              </button>
            </div>
          );
        })}
      </div>

      <button type="button" className="btn btn--fantome" style={{ alignSelf: "flex-start" }} onClick={() => signOut(auth)}>
        Me déconnecter
      </button>
    </div>
  );
}

// Carte du client et compte de versement du déneigeur (Stripe).
function SectionPaiement({ profile, deneigeur }) {
  const [params, setParams] = useSearchParams();
  const [changerCarte, setChangerCarte] = useState(false);
  const [carteAjoutee, setCarteAjoutee] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const carte = carteAjoutee ?? profile.carte;
  const statut = profile.connectStatus ?? "non_demarre";
  const infoStatut = STATUTS_CONNECT[statut] ?? STATUTS_CONNECT.en_attente;

  // Retour de Stripe (?stripe=retour ou ?stripe=reprendre) : met le statut à
  // jour sans attendre le webhook.
  const retourStripe = params.get("stripe");
  useEffect(() => {
    if (!retourStripe) return;
    synchroniserCompteDeneigeur()
      .catch(() => {})
      .finally(() => setParams({}, { replace: true }));
  }, [retourStripe, setParams]);

  async function ouvrirStripe() {
    setEnCours(true);
    setErreur(null);
    try {
      const { url } = await lienCompteDeneigeur();
      window.location.assign(url);
    } catch (err) {
      setErreur(messageErreur(err));
      setEnCours(false);
    }
  }

  return (
    <>
      <h1>Paiement</h1>
      <div className="parametres__liste">
        <div className="parametres__item parametres__item--colonne">
          <div className="parametres__item-texte">
            <h3>Carte pour tes demandes</h3>
            <p>
              {carte
                ? `${libelleCarte(carte)}. Prélevée seulement quand un déneigeur de quartier accepte ta demande.`
                : "Aucune carte enregistrée. Tu pourras en ajouter une en publiant ta première demande."}
            </p>
          </div>
          {changerCarte ? (
            <CarteDePaiement
              onEnregistree={(c) => {
                setCarteAjoutee(c);
                setChangerCarte(false);
              }}
            />
          ) : (
            <button type="button" className="btn btn--fantome btn--petit" onClick={() => setChangerCarte(true)}>
              {carte ? "Changer de carte" : "Ajouter une carte"}
            </button>
          )}
        </div>

        {deneigeur && (
          <div className="parametres__item parametres__item--empile-mobile">
            <div className="parametres__item-texte">
              <h3>Compte de versement</h3>
              <span className={`statut-connect statut-connect--${infoStatut.ton}`}>
                <span className="statut-connect__icone" aria-hidden="true">
                  {{ ok: "✓", attente: "…", alerte: "!", neutre: "○" }[infoStatut.ton]}
                </span>
                {infoStatut.pastille}
              </span>
              <p>{infoStatut.texte}</p>
              <p className="parametres__meta">
                Géré par Stripe : identité et compte bancaire, une seule fois. <strong>Obligatoire pour accepter des jobs.</strong>
              </p>
              {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
            </div>
            <button type="button" className="auth-form__bouton" style={{ flex: "none" }} disabled={enCours} onClick={ouvrirStripe}>
              {enCours ? "Ouverture…" : statut === "actif" ? "Voir mes versements" : statut === "non_demarre" ? "Configurer" : "Continuer"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
