import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
  profilStripe,
  STATUTS_CONNECT,
  PAIEMENT_REEL,
  libelleCarte,
  lienCompteDeneigeur,
  synchroniserCompteDeneigeur,
} from "../lib/paiements";
import CarteDePaiement from "../components/CarteDePaiement";
import { fermerCompte, messageFermeture } from "../lib/compte";
import { envoyerCodeTelephone, envoyerTexteEssai, formaterNumero, messageTelephone, retirerTelephone, verifierCodeTelephone } from "../lib/telephone";
import ChampAdresse from "../components/ChampAdresse";
import "./Parametres.css";
import { messageServeur } from "../lib/erreurs";

// Les consentements liés à Snowro Pro (zonesAgregees, offresCiblees) sont
// masqués jusqu'à la V2 : le modèle de données et les functions les gèrent
// toujours, il suffira de remettre les deux entrées ici et dans la politique
// de confidentialité (Confidentialite.jsx) pour les réactiver.
// Textos : section et consentement affichés si VITE_TEXTOS=1 (.env.test, .env.production).
const TEXTOS = import.meta.env.VITE_TEXTOS === "1";

const CONSENTS = [
  TEXTOS && {
    type: "notificationsSMS",
    titre: "Notifications SMS",
    // Texte de la version 2 (functions/src/consentVersions.js) : un accord
    // donné à une version antérieure est redemandé.
    version: 2,
    exigeTelephone: true,
    description:
      "Recevez un texto quand une demande est publiée près de chez vous (déneigeurs), quand votre demande est acceptée ou faite, et quand l'autre personne vous écrit. Votre numéro est vérifié par un code.",
  },
].filter(Boolean);

const ADRESSE_VIDE = { texte: "", placeId: null, libelle: null };

export default function Parametres() {
  const { user, profile } = useAuth();
  const consentSms = profile?.consents?.notificationsSMS;
  const smsActifs = Boolean(consentSms?.granted && (consentSms.version ?? 0) >= 2 && profile?.telephoneVerifie);
  const [enCours, setEnCours] = useState(null);
  const [erreurConsent, setErreurConsent] = useState(null);
  const [erreurAdresse, setErreurAdresse] = useState(null);
  const [majAdresseEnCours, setMajAdresseEnCours] = useState(false);
  const [adresse, setAdresse] = useState(ADRESSE_VIDE);
  const [adresseManuelle, setAdresseManuelle] = useState(false);
  const [adresseEnregistree, setAdresseEnregistree] = useState(null);
  // Adresse déjà enregistrée : le formulaire reste replié derrière « Changer
  // d'adresse », sinon il laisse croire que rien n'a été enregistré.
  const [modifierAdresse, setModifierAdresse] = useState(false);

  async function basculer(type, accorde) {
    setEnCours(type);
    setErreurConsent(null);
    try {
      if (accorde) await revokeConsent(type);
      else await grantConsent(type);
    } catch (err) {
      setErreurConsent(messageTelephone(err));
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
          setAdresseEnregistree("votre position actuelle");
          setModifierAdresse(false);
        } catch {
          setErreurAdresse("Impossible de déterminer votre ville à partir de cette position. Réessayez, ou entrez votre adresse manuellement.");
        } finally {
          setMajAdresseEnCours(false);
        }
      },
      () => {
        setErreurAdresse("Localisation refusée ou indisponible : entrez votre adresse manuellement ci-dessous.");
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
          ? "Écrivez l'adresse au complet, avec le numéro civique."
          : "Choisissez votre adresse dans la liste de suggestions.",
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
      setModifierAdresse(false);
    } catch (err) {
      setErreurAdresse(
        err?.code === "functions/invalid-argument" ? messageServeur(err) : "Adresse introuvable. Vérifiez l'adresse et réessayez.",
      );
    } finally {
      setMajAdresseEnCours(false);
    }
  }

  // Lien d'une étape de démarrage (/parametres#paiement) : défile jusqu'à la
  // section une fois le profil chargé.
  const { hash } = useLocation();
  const profilCharge = Boolean(profile);
  useEffect(() => {
    if (!hash || !profilCharge) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [hash, profilCharge]);

  if (!profile) return null;

  const roles = profile.role ?? [];
  const alertesActives = profile.alertesDemandesCourriel !== false;
  const changerRoles = (r) => r.length && setDoc(doc(db, "users", user.uid), { role: r }, { merge: true });

  return (
    <div className="parametres__page">
      <h1>Comment vous utilisez Snowro</h1>
      <p className="parametres__intro">Vous pouvez avoir les deux rôles : une bascule Client / Déneigeur apparaît alors en haut de la page.</p>
      <ChoixRoles valeur={roles} onChange={changerRoles} />

      {roles.includes(ROLE_DENEIGEUR) && (
        <>
      <h1 id="adresse">Votre adresse de service</h1>
      <p className="parametres__intro">
        Elle détermine les demandes que vous pouvez voir : jamais hors de votre ville, même si la distance
        semble raisonnable.
      </p>

      <div className="parametres__item parametres__item--adresse">
        <div className="parametres__item-texte">
          <h3>{profile.ville ? profile.ville : "Aucune adresse enregistrée"}</h3>
          {profile.ville ? (
            <>
              <p className="champ-adresse__ok">
                ✓ Adresse de service enregistrée{profile.postalCodePrefix ? ` (secteur ${profile.postalCodePrefix})` : ""}
              </p>
              <p>Vous voyez les demandes ouvertes dans cette ville, avec leur distance de chez vous.</p>
              <p className="parametres__meta">
                Pour votre vie privée, nous gardons seulement la ville, le secteur et une position approximative,
                jamais l'adresse exacte : c'est pourquoi elle ne s'affiche pas ici.
              </p>
            </>
          ) : (
            <p>Ajoutez votre adresse pour voir les demandes près de chez vous.</p>
          )}
          {adresseEnregistree && <p className="champ-adresse__ok">✓ Mise à jour à partir de : {adresseEnregistree}</p>}
          {erreurAdresse && <p className="message-erreur" role="alert">{erreurAdresse}</p>}
        </div>
        {profile.ville && !modifierAdresse ? (
          <button type="button" className="btn btn--fantome" onClick={() => setModifierAdresse(true)} style={{ flex: "none" }}>
            Changer d'adresse
          </button>
        ) : (
          <button
            type="button"
            className="auth-form__bouton"
            onClick={mettreAJourParPosition}
            disabled={majAdresseEnCours}
            style={{ flex: "none" }}
          >
            {majAdresseEnCours ? "Localisation…" : "Utiliser ma position"}
          </button>
        )}
      </div>

      {(!profile.ville || modifierAdresse) && (
        <form className="parametres__adresse-manuelle" onSubmit={mettreAJourParSaisie} noValidate>
          <div className="auth-form__champ" style={{ flex: 1 }}>
            <span>{profile.ville ? "Ou entrez votre nouvelle adresse" : "Ou entrez votre adresse"}</span>
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
          {profile.ville && (
            <button
              type="button"
              className="btn btn--lien"
              onClick={() => {
                setModifierAdresse(false);
                setAdresse(ADRESSE_VIDE);
                setErreurAdresse(null);
              }}
            >
              Annuler
            </button>
          )}
        </form>
      )}

      {/* Avis de nouvelles demandes (avertirDeneigeursNouvelleDemande) : actifs
          par défaut, au plus un courriel toutes les 20 minutes. */}
      <div className="parametres__item">
        <div className="parametres__item-texte">
          <h3>Avis de nouvelles demandes par courriel</h3>
          <p>
            Un courriel quand une demande est publiée dans votre ville (au plus un toutes les 20 minutes). Jamais
            l'adresse exacte : le quartier, la distance et le montant.
          </p>
        </div>
        <button
          type="button"
          className={`parametres__toggle ${alertesActives ? "parametres__toggle--actif" : ""}`}
          onClick={() => setDoc(doc(db, "users", user.uid), { alertesDemandesCourriel: !alertesActives }, { merge: true })}
          role="switch"
          aria-checked={alertesActives}
          aria-label="Avis de nouvelles demandes par courriel"
        >
          <span className="parametres__toggle-pastille" />
        </button>
      </div>

        </>
      )}

      {PAIEMENT_REEL && <SectionPaiement profile={profile} deneigeur={roles.includes(ROLE_DENEIGEUR)} />}

      {TEXTOS && (
        <>
          <h1 id="cellulaire">Votre cellulaire</h1>
          <p className="parametres__intro">
            Vérifié une seule fois par un code, il sert aux avis par texto si vous les activez ci-dessous.
          </p>
          <SectionTelephone profile={profile} smsActifs={smsActifs} />
        </>
      )}

      {CONSENTS.length > 0 && (
        <>
          <h1>Vos consentements</h1>
          <p className="parametres__intro">
            Chaque consentement est indépendant, daté et révocable en tout temps, et le retrait est aussi simple
            que l'octroi.
          </p>

          <div className="parametres__liste">
            {CONSENTS.map((c) => {
              const etat = profile.consents?.[c.type];
              const accorde = Boolean(etat?.granted);
              const sansTelephone = c.exigeTelephone && !profile.telephoneVerifie;
              const ancienneVersion = accorde && c.version && (etat?.version ?? 0) < c.version;
              return (
                <div key={c.type} className="parametres__item">
                  <div className="parametres__item-texte">
                    <h3>{c.titre}</h3>
                    <p>{c.description}</p>
                    {sansTelephone && !accorde && <p className="parametres__meta">Vérifiez d'abord votre cellulaire ci-dessus.</p>}
                    {ancienneVersion ? (
                      <div className="parametres__nouvelle-version">
                        <p>
                          Le texte de ce consentement a changé depuis votre accord. Rien ne vous est envoyé tant que vous
                          n'acceptez pas le nouveau texte.
                        </p>
                        <button type="button" className="btn btn--principal" onClick={() => basculer(c.type, false)} disabled={enCours === c.type || sansTelephone}>
                          Accepter le nouveau texte
                        </button>
                      </div>
                    ) : (
                      etat?.grantedAt && (
                        <p className="parametres__meta">
                          {dateConsentement(accorde ? "Activé" : "Désactivé", accorde ? etat.grantedAt : etat.revokedAt ?? etat.grantedAt)}
                        </p>
                      )
                    )}
                    {erreurConsent && enCours === null && c.type === "notificationsSMS" && (
                      <p className="message-erreur" role="alert">{erreurConsent}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className={`parametres__toggle ${accorde ? "parametres__toggle--actif" : ""}`}
                    onClick={() => basculer(c.type, accorde)}
                    disabled={enCours === c.type || (sansTelephone && !accorde)}
                    role="switch"
                    aria-checked={accorde}
                    aria-label={c.titre}
                  >
                    <span className="parametres__toggle-pastille" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Sur ordinateur, « Déconnexion » est déjà dans l'en-tête ; il y est caché sous 700 px. */}
      <button type="button" className="btn btn--fantome parametres__deconnexion" onClick={() => signOut(auth)}>
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
  const [info, setInfo] = useState(null);
  const carte = carteAjoutee ?? profilStripe(profile).carte;
  const statut = profilStripe(profile).connectStatus ?? "non_demarre";
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

  // Inscription : même onglet (Stripe ramène à /parametres?stripe=retour).
  // Compte actif : le tableau de bord Express (connect.stripe.com) n'a pas de
  // lien de retour, il s'ouvre donc dans un nouvel onglet et Snowro reste
  // ouvert. L'onglet est ouvert tout de suite, pendant le clic, sinon le
  // navigateur bloquerait la fenêtre ouverte après l'appel au serveur.
  async function ouvrirStripe() {
    const onglet = statut === "actif" ? window.open("", "_blank") : null;
    setEnCours(true);
    setErreur(null);
    try {
      const { url, type } = await lienCompteDeneigeur();
      if (type === "tableau" && onglet) {
        onglet.opener = null;
        onglet.location.href = url;
        setEnCours(false);
        return;
      }
      if (type === "tableau" && statut !== "actif") {
        // Statut affiché en retard (le compte vient d'être activé chez
        // Stripe) : on ne quitte pas le site ; le serveur a mis connectStatus
        // à jour, la pastille passe à « Actif » et le bouton devient « Voir
        // mes versements ».
        setInfo("Votre compte de versement est actif. Vous pouvez maintenant accepter des demandes.");
        setEnCours(false);
        return;
      }
      onglet?.close();
      window.location.assign(url);
    } catch (err) {
      onglet?.close();
      setErreur(messageErreur(err));
      setEnCours(false);
    }
  }

  return (
    <>
      <h1 id="paiement">Paiement</h1>
      <div className="parametres__liste">
        <div className="parametres__item parametres__item--colonne">
          <div className="parametres__item-texte">
            <h3>Carte pour vos demandes</h3>
            {/* Même pastille que le compte de versement : on voit d'un coup d'œil que c'est en place. */}
            <span className={`statut-connect statut-connect--${carte ? "ok" : "neutre"}`}>
              <span className="statut-connect__icone" aria-hidden="true">
                {carte ? "✓" : "○"}
              </span>
              {carte ? "Enregistrée" : "Aucune carte"}
            </span>
            <p>
              {carte
                ? `${libelleCarte(carte)}. Elle n'est prélevée que lorsqu'un déneigeur de quartier accepte votre demande.`
                : "Vous pourrez en ajouter une en publiant votre première demande."}
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
                Géré par Stripe : identité et compte bancaire, une seule fois. <strong>Obligatoire pour accepter des demandes.</strong>
              </p>
              {info && <p className="champ-adresse__ok" role="status">{info}</p>}
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
        Vos renseignements sont effacés ou rendus anonymes, sauf le registre des paiements que la loi nous oblige à
        conserver 6 ans. Impossible tant qu'une demande est en cours ou qu'un paiement n'est pas terminé.
      </p>
      <button type="button" className="btn btn--fantome parametres__bouton-fermer" onClick={() => setOuverte(true)}>
        Fermer mon compte
      </button>
      {ouverte && (
        <Modale titre="Fermer votre compte ?" onFermer={annuler}>
          <p>Cette action est définitive. Nous effaçons :</p>
          <ul className="parametres__liste-fermeture">
            <li>votre profil, votre adresse et votre carte enregistrée;</li>
            <li>dans vos demandes publiées et acceptées : votre prénom, les adresses, les photos, les évaluations et les messages;</li>
            <li>votre inscription à la liste d'attente, s'il y a lieu.</li>
          </ul>
          <p>Vos demandes encore ouvertes sont annulées. Vous pourrez créer un nouveau compte plus tard.</p>
          <form onSubmit={fermer} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>
              Écrivez FERMER pour confirmer
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

// Numéro pour les textos : vérifié par un code reçu par texto
// (functions/src/telephone.js). Affiché une fois le consentement accordé.
// « Votre cellulaire » : le numéro appartient au compte, vérifié une seule fois
// par un code. Le texto d'essai ne part que vers ce numéro vérifié.
// « Activé le 12 novembre 2026 » : la date de l'accord ou du retrait (la
// version du texte reste dans la fiche, pour la preuve du consentement).
function dateConsentement(libelle, horodatage) {
  const d = horodatage?.toDate?.() ?? (horodatage ? new Date(horodatage) : null);
  if (!d || Number.isNaN(d.getTime())) return libelle;
  return `${libelle} le ${d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}`;
}

// Compte à rebours jusqu'à `fin` (millisecondes) : secondes restantes, 0 à la fin.
function useCompteARebours(fin) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    if (!fin || fin <= Date.now()) return undefined;
    const t = setInterval(() => {
      setMaintenant(Date.now());
      if (Date.now() >= fin) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [fin]);
  return fin ? Math.max(0, Math.ceil((fin - maintenant) / 1000)) : 0;
}

const minSec = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function SectionTelephone({ profile, smsActifs }) {
  const [numero, setNumero] = useState("");
  const [code, setCode] = useState("");
  const [codeEnvoye, setCodeEnvoye] = useState(false);
  const [modification, setModification] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [info, setInfo] = useState(null);
  // Prochain texto d'essai permis (le serveur en limite un par 10 minutes).
  const [prochainEssai, setProchainEssai] = useState(null);
  const attenteEssai = useCompteARebours(prochainEssai);

  async function executer(action) {
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await action();
    } catch (err) {
      setErreur(messageTelephone(err));
    } finally {
      setEnCours(false);
    }
  }

  const envoyer = (e) => {
    e.preventDefault();
    executer(async () => {
      await envoyerCodeTelephone(numero);
      setCodeEnvoye(true);
    });
  };

  const verifier = (e) => {
    e.preventDefault();
    executer(async () => {
      const { ok } = await verifierCodeTelephone(code);
      if (!ok) {
        setErreur("Code incorrect. Vérifiez les 6 chiffres reçus par texto.");
        return;
      }
      setCodeEnvoye(false);
      setModification(false);
      setCode("");
      setNumero("");
    });
  };

  const essai = () =>
    executer(async () => {
      try {
        const { data } = await envoyerTexteEssai();
        setProchainEssai(data?.prochainEssaiAt ?? Date.now() + 10 * 60 * 1000);
        setInfo(`Texto d'essai envoyé au ${formaterNumero(profile.telephoneVerifie)}.`);
      } catch (err) {
        // Déjà envoyé il y a moins de 10 minutes (autre onglet, page rechargée) :
        // pas d'erreur, seulement le compte à rebours.
        const restant = err?.details?.restantMs;
        if (messageServeur(err) === "attendre-essai" && restant) {
          setProchainEssai(Date.now() + restant);
          setInfo("Un texto d'essai est parti il y a moins de 10 minutes.");
          return;
        }
        throw err;
      }
    });

  const retirer = () => {
    if (!window.confirm("Retirer votre cellulaire ? Les avis par texto seront aussi désactivés.")) return;
    executer(() => retirerTelephone());
  };

  if (profile.telephoneVerifie && !modification) {
    return (
      <div className="parametres__item parametres__item--colonne">
        <div className="parametres__item-texte">
          <h3>Cellulaire</h3>
          <p className="champ-adresse__ok">✓ {formaterNumero(profile.telephoneVerifie)} vérifié</p>
          <p>{smsActifs ? "Les avis par texto partent vers ce numéro." : "Activez « Notifications SMS » ci-dessous pour recevoir les avis à ce numéro."}</p>
        </div>
        <div className="parametres__actions">
          <button type="button" className="btn btn--fantome" onClick={essai} disabled={enCours || attenteEssai > 0}>
            {attenteEssai > 0 ? `Nouvel essai dans ${minSec(attenteEssai)}` : "M'envoyer un texto d'essai"}
          </button>
          <button type="button" className="btn btn--lien" onClick={() => setModification(true)} disabled={enCours}>
            Changer
          </button>
          <button type="button" className="btn btn--lien" onClick={retirer} disabled={enCours}>
            Retirer
          </button>
        </div>
        {info && <p className="champ-adresse__ok" role="status">{info}</p>}
        {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
      </div>
    );
  }

  return (
    <div className="parametres__item parametres__item--colonne">
      <div className="parametres__item-texte">
        <h3>{profile.telephoneVerifie ? "Changer de cellulaire" : "Cellulaire"}</h3>
        <p>
          {codeEnvoye
            ? "Entrez le code à 6 chiffres reçu par texto. Il expire dans 10 minutes."
            : "Nous envoyons un code à ce numéro pour vérifier qu'il est bien le vôtre. Aucun autre texto ne part sans votre accord."}
        </p>
      </div>
      {codeEnvoye ? (
        <form className="parametres__adresse-manuelle" onSubmit={verifier}>
          <label className="auth-form__champ" style={{ flex: 1 }}>
            Code reçu
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button type="submit" className="auth-form__bouton" disabled={enCours || code.length !== 6}>
            {enCours ? "Vérification…" : "Vérifier"}
          </button>
        </form>
      ) : (
        <form className="parametres__adresse-manuelle" onSubmit={envoyer}>
          <label className="auth-form__champ" style={{ flex: 1 }}>
            Numéro de cellulaire
            <input type="tel" autoComplete="tel" placeholder="418 555-1234" value={numero} onChange={(e) => setNumero(e.target.value)} />
          </label>
          <button type="submit" className="auth-form__bouton" disabled={enCours || numero.replace(/\D/g, "").length < 10}>
            {enCours ? "Envoi…" : "Recevoir un code"}
          </button>
        </form>
      )}
      <div className="parametres__actions">
        {codeEnvoye && (
          <button type="button" className="btn btn--lien" onClick={() => setCodeEnvoye(false)}>
            Changer de numéro ou recevoir un nouveau code
          </button>
        )}
        {profile.telephoneVerifie && (
          <button
            type="button"
            className="btn btn--lien"
            onClick={() => {
              setModification(false);
              setCodeEnvoye(false);
              setErreur(null);
            }}
          >
            Annuler
          </button>
        )}
      </div>
      {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
    </div>
  );
}
