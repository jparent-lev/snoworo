import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { ChoixRoles, Modale } from "./tableau/elements";
import { ROLE_DENEIGEUR } from "../lib/mode";
import "./tableau/Tableau.css";
import { useAuth } from "../context/AuthContext";
import { grantConsent, revokeConsent } from "../lib/consents";
import { mettreAJourAdresseParPosition, mettreAJourAdresseParSaisie } from "../lib/adresse";
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
import { fermerCompte, messageFermeture } from "../lib/compte";
import ChampAdresse from "../components/ChampAdresse";
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

const ADRESSE_VIDE = { texte: "", placeId: null, libelle: null };

export default function Parametres() {
  const { user, profile } = useAuth();
  const [enCours, setEnCours] = useState(null);
  const [erreurAdresse, setErreurAdresse] = useState(null);
  const [majAdresseEnCours, setMajAdresseEnCours] = useState(false);
  const [adresse, setAdresse] = useState(ADRESSE_VIDE);
  const [adresseManuelle, setAdresseManuelle] = useState(false);
  const [adresseEnregistree, setAdresseEnregistree] = useState(null);

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
          setAdresseEnregistree(null);
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

  // Comme pour une demande : une suggestion choisie, ou l'adresse écrite au
  // complet (« pas dans la liste »), que le serveur vérifie.
  const adresseManquante = !adresse.placeId && (!adresseManuelle || adresse.texte.trim().length < 8);

  async function mettreAJourParSaisie(e) {
    e.preventDefault();
    if (adresseManquante) {
      setErreurAdresse(
        adresseManuelle
          ? "Écris l'adresse au complet, avec le numéro civique."
          : "Choisis ton adresse dans la liste de suggestions.",
      );
      return;
    }
    setErreurAdresse(null);
    setMajAdresseEnCours(true);
    try {
      await mettreAJourAdresseParSaisie(adresse);
      setAdresseEnregistree(adresse.placeId ? adresse.libelle : adresse.texte.trim());
      setAdresse(ADRESSE_VIDE);
      setAdresseManuelle(false);
    } catch (err) {
      setErreurAdresse(
        err?.code === "functions/invalid-argument" ? err.message : "Adresse introuvable. Vérifie l'adresse et réessaie.",
      );
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
          {adresseEnregistree && <p className="champ-adresse__ok">✓ Adresse enregistrée : {adresseEnregistree}</p>}
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

      <form className="parametres__adresse-manuelle" onSubmit={mettreAJourParSaisie} noValidate>
        <div className="auth-form__champ" style={{ flex: 1 }}>
          <span>Ou entre ton adresse</span>
          <ChampAdresse
            valeur={adresse}
            onChange={setAdresse}
            manuel={adresseManuelle}
            onManuel={(m) => {
              setAdresseManuelle(m);
              setAdresse(ADRESSE_VIDE);
            }}
            disabled={majAdresseEnCours}
          />
        </div>
        <button type="submit" className="auth-form__bouton" disabled={majAdresseEnCours || !adresse.texte.trim()}>
          {majAdresseEnCours ? "Vérification…" : "Utiliser cette adresse"}
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

      <SectionFermeture />
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

// Loi 25 : la personne peut faire effacer ses renseignements elle-même.
function SectionFermeture() {
  const naviguer = useNavigate();
  const [ouverte, setOuverte] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function fermer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      await fermerCompte();
      await signOut(auth).catch(() => {});
      naviguer("/", { replace: true });
    } catch (err) {
      setErreur(messageFermeture(err));
      setEnCours(false);
    }
  }

  function annuler() {
    if (enCours) return;
    setOuverte(false);
    setSaisie("");
    setErreur(null);
  }

  return (
    <div className="parametres__fermeture">
      <h2>Fermer mon compte</h2>
      <p>
        Tes renseignements sont effacés ou rendus anonymes, sauf le registre des paiements que la loi nous oblige à
        garder 6 ans. Impossible tant qu'une job est en cours.
      </p>
      <button type="button" className="btn btn--fantome parametres__bouton-fermer" onClick={() => setOuverte(true)}>
        Fermer mon compte
      </button>
      {ouverte && (
        <Modale titre="Fermer ton compte ?" onFermer={annuler}>
          <p>C'est définitif. On efface :</p>
          <ul className="parametres__liste-fermeture">
            <li>ton profil, ton adresse et ta carte enregistrée;</li>
            <li>dans tes demandes et tes jobs : ton prénom, les adresses, les photos, les évaluations et les messages;</li>
            <li>ton inscription à la liste d'attente, s'il y en a une.</li>
          </ul>
          <p>Tes demandes encore ouvertes sont annulées. Tu pourras créer un nouveau compte plus tard.</p>
          <form onSubmit={fermer} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>
              Écris FERMER pour confirmer
              <input value={saisie} onChange={(e) => setSaisie(e.target.value)} autoComplete="off" data-autofocus />
            </label>
            {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
            <div className="modale__actions">
              <button type="button" className="btn btn--fantome" onClick={annuler} disabled={enCours}>
                Garder mon compte
              </button>
              <button
                type="submit"
                className="btn btn--principal parametres__bouton-fermer-confirmer"
                disabled={enCours || saisie.trim().toUpperCase() !== "FERMER"}
              >
                {enCours ? "Fermeture…" : "Fermer définitivement"}
              </button>
            </div>
          </form>
        </Modale>
      )}
    </div>
  );
}
