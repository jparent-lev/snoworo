import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ecouterDemandesOuvertes, ecouterMesJobs, lireAdressePrivee, lirePrive } from "../../lib/demandes";
import { preparerPhoto } from "../../lib/photo";
import { PAIEMENT_REEL } from "../../lib/paiements";
import { accepterDemande, marquerFaite, messageErreur } from "../../lib/cycleDemande";
import { aNouveauMessage, ecouterLectures } from "../../lib/messagerie";
import { calculerPaiement, ecouterConfigFrais } from "../../lib/config";
import { formatArgent } from "../../lib/formatArgent";
import { decoderGeohash, distanceMetres } from "../../lib/geo";
import { dateCourte, debutSemaine, echeance, estAujourdhui, heure, ilYa, millis } from "../../lib/temps";
import Rangee from "../../components/Rangee";
import { Modale, ModaleSignalement } from "./elements";
import Conversation, { BoutonMessages } from "./Conversation";
import "./Tableau.css";

const FILTRES_JOBS = [
  { cle: "en_cours", libelle: "En cours", statuts: ["matchee", "faite"] },
  { cle: "a_faire", libelle: "À faire", statuts: ["matchee"] },
  { cle: "a_confirmer", libelle: "À confirmer", statuts: ["faite"] },
  { cle: "signalees", libelle: "Signalées", statuts: ["signalee"] },
  { cle: "terminees", libelle: "Terminées", statuts: ["completee"] },
  { cle: "toutes", libelle: "Toutes", statuts: ["matchee", "faite", "signalee", "completee"] },
];

const FILTRES_DEMANDES = [
  { cle: "toutes", libelle: "Toutes", garde: () => true },
  { cle: "entree", libelle: "Entrée", garde: (d) => d.typeService === "entree" || d.typeService === "entree_balcon" },
  { cle: "stationnement", libelle: "Stationnement", garde: (d) => d.typeService === "stationnement" },
  { cle: "toiture", libelle: "Toiture", garde: (d) => d.typeService === "toiture" },
  { cle: "aujourdhui", libelle: "Aujourd'hui", garde: (d) => estAujourdhui(d.dateHeureSouhaitee) },
  { cle: "outils", libelle: "Outils fournis", garde: (d) => d.outilsFournis },
];

const TRIS = [
  { cle: "proches", libelle: "Plus proches", comparer: (a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity) },
  { cle: "payantes", libelle: "Plus payantes", comparer: (a, b) => b.remunerationOfferte - a.remunerationOfferte },
  { cle: "urgentes", libelle: "Plus urgentes", comparer: (a, b) => millis(a.dateHeureSouhaitee) - millis(b.dateHeureSouhaitee) },
  { cle: "recentes", libelle: "Plus récentes", comparer: (a, b) => millis(b.createdAt) - millis(a.createdAt) },
];

function distanceTexte(m) {
  if (m == null) return null;
  return m < 1000 ? `À ${Math.max(100, Math.round(m / 100) * 100)} m` : `À ${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

export default function TableauDeneigeur({ conversation, onConversationFermee }) {
  const { user, profile } = useAuth();
  const [jobs, setJobs] = useState(null);
  const [lectures, setLectures] = useState({});
  const [ouvertes, setOuvertes] = useState([]);
  const [frais, setFrais] = useState(undefined);
  const [filtreJobs, setFiltreJobs] = useState("en_cours");
  const [filtreDemandes, setFiltreDemandes] = useState("toutes");
  const [tri, setTri] = useState("proches");
  const villeGeoId = profile?.villeGeoId;
  // Sans paiement réel, aucun compte de versement n'est exigé.
  const compteActif = !PAIEMENT_REEL || profile?.connectStatus === "actif";

  useEffect(() => ecouterMesJobs(user.uid, setJobs), [user.uid]);
  useEffect(() => ecouterLectures(user.uid, setLectures), [user.uid]);
  useEffect(() => (villeGeoId ? ecouterDemandesOuvertes(villeGeoId, setOuvertes) : undefined), [villeGeoId]);
  useEffect(() => ecouterConfigFrais(setFrais), []);

  const chiffres = useMemo(() => {
    const liste = jobs ?? [];
    const lundi = debutSemaine();
    const semaine = liste.filter((j) => j.statut === "completee" && millis(j.confirmeeAt) >= lundi);
    const aConfirmer = liste.filter((j) => j.statut === "faite");
    const somme = (l) => l.reduce((t, j) => t + (j.paiement?.montantDeneigeur ?? 0), 0);
    return { semaine: somme(semaine), nbSemaine: semaine.length, aConfirmer: somme(aConfirmer), nbAConfirmer: aConfirmer.length };
  }, [jobs]);

  const listeJobs = jobs ?? [];
  const filtresJobs = FILTRES_JOBS.map((f) => ({ ...f, compte: f.cle === "toutes" ? undefined : listeJobs.filter((j) => f.statuts.includes(j.statut)).length }));
  const jobsAffichees = listeJobs.filter((j) => FILTRES_JOBS.find((f) => f.cle === filtreJobs).statuts.includes(j.statut));

  const geohashService = profile?.addressGeohash;
  const demandes = useMemo(() => {
    const depart = geohashService ? decoderGeohash(geohashService) : null;
    const garde = FILTRES_DEMANDES.find((f) => f.cle === filtreDemandes).garde;
    return ouvertes
      .filter((d) => d.donneurOuvrageId !== user.uid && garde(d))
      .map((d) => ({ ...d, distanceM: depart && d.adresseGeohash ? distanceMetres(depart, decoderGeohash(d.adresseGeohash)) : null }))
      .sort(TRIS.find((t) => t.cle === tri).comparer);
  }, [ouvertes, geohashService, filtreDemandes, tri, user.uid]);

  const prenom = (profile?.displayName || "").split(" ")[0];
  const nbJobs = profile?.nbJobsCompletees ?? 0;

  return (
    <div className="tableau">
      <div className="tableau__salut">
        <div>
          <h1>Salut{prenom ? ` ${prenom}` : ""}</h1>
          <p>{profile?.ville ? `Tu déneiges à ${profile.ville}` : "Ajoute ton adresse de service pour voir les demandes"}</p>
        </div>
      </div>
      {!PAIEMENT_REEL && (
        <p className="tableau__simulation">Période de test : aucun paiement réel n'est fait pour l'instant.</p>
      )}

      {(!villeGeoId || !compteActif) && (
        <div className="bandeau">
          <div>
            <h3>{villeGeoId ? "Une étape avant d'accepter des jobs" : "Une étape avant de voir les demandes"}</h3>
            <p className="carte-job__meta" style={{ marginTop: 4 }}>
              {villeGeoId
                ? "Ton compte de versement Stripe reçoit l'argent de tes jobs. Ça se fait une seule fois."
                : "Ton adresse de service détermine ta ville : tu ne vois jamais de demandes ailleurs."}
            </p>
            <div className="bandeau__etapes">
              <span className="bandeau__ok">✓ Profil</span>
              <span className={villeGeoId ? "bandeau__ok" : "bandeau__manque"}>{villeGeoId ? "✓" : "○"} Adresse de service</span>
              {PAIEMENT_REEL ? (
                <span className={compteActif ? "bandeau__ok" : "bandeau__manque"}>{compteActif ? "✓" : "○"} Compte de versement</span>
              ) : (
                <span className="bandeau__manque">○ Compte de versement (bientôt)</span>
              )}
            </div>
          </div>
          <Link to="/parametres" className="btn btn--principal">
            {villeGeoId ? "Configurer mes versements" : "Ajouter mon adresse"}
          </Link>
        </div>
      )}

      <div className="chiffres">
        <div className="chiffre">
          <span className="eyebrow">Cette semaine</span>
          <div className="chiffre__valeur">{formatArgent(chiffres.semaine)}</div>
          <div className="chiffre__sous">
            {chiffres.nbSemaine} job{chiffres.nbSemaine > 1 ? "s" : ""} confirmée{chiffres.nbSemaine > 1 ? "s" : ""}, frais déjà déduits
          </div>
        </div>
        <div className="chiffre">
          <span className="eyebrow">En attente de confirmation</span>
          <div className="chiffre__valeur">{formatArgent(chiffres.aConfirmer)}</div>
          <div className="chiffre__sous">
            {chiffres.nbAConfirmer ? "Versé au plus tard 12 h après « C'est fait »" : "Rien en attente"}
          </div>
        </div>
        <div className="chiffre">
          <span className="eyebrow">Ta note</span>
          <div className="chiffre__valeur">
            {nbJobs > 0 && profile?.ratingAvg ? (
              <>
                <span className="etoile">★</span> {profile.ratingAvg.toFixed(1).replace(".", ",")}
              </>
            ) : (
              "Nouveau"
            )}
          </div>
          <div className="chiffre__sous">
            {nbJobs} job{nbJobs > 1 ? "s" : ""} terminée{nbJobs > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {jobs && (
        <Rangee
          titre="Mes jobs"
          compte={listeJobs.length}
          filtres={filtresJobs}
          filtreActif={filtreJobs}
          onFiltre={setFiltreJobs}
          vide={listeJobs.length ? "Rien dans cette catégorie pour l'instant." : "Tes jobs acceptées apparaîtront ici."}
          pied={`${jobsAffichees.length} affichée${jobsAffichees.length > 1 ? "s" : ""}, triées par heure`}
        >
          {jobsAffichees.map((j) => (
            <CarteJob
              key={j.id}
              job={j}
              nouveau={aNouveauMessage(j, user.uid, lectures)}
              conversationOuverte={conversation === j.id}
              onConversationFermee={onConversationFermee}
            />
          ))}
        </Rangee>
      )}

      {villeGeoId && (
        <Rangee
          titre="Demandes près de toi"
          compte={demandes.length}
          filtres={FILTRES_DEMANDES}
          filtreActif={filtreDemandes}
          onFiltre={setFiltreDemandes}
          tri={{ valeur: tri, onChange: setTri, options: TRIS }}
          vide={ouvertes.length ? "Aucune demande avec ce filtre." : `Aucune demande ouverte à ${profile.ville} pour l'instant.`}
        >
          {demandes.map((d) => (
            <CarteDemandeOuverte key={d.id} demande={d} frais={frais} compteActif={compteActif} />
          ))}
        </Rangee>
      )}
    </div>
  );
}

function CarteJob({ job: j, nouveau, conversationOuverte, onConversationFermee }) {
  const [adresse, setAdresse] = useState(null);
  const [modale, setModale] = useState(conversationOuverte ? "messages" : null); // "faite" | "signaler" | "messages"
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (j.statut !== "matchee" && j.statut !== "faite") return;
    lireAdressePrivee(j.id)
      .then(setAdresse)
      .catch(() => setAdresse(null));
  }, [j.id, j.statut]);

  async function confirmerFaite(photos) {
    setModale(null);
    setEnCours(true);
    setErreur(null);
    try {
      await marquerFaite({ demandeId: j.id, photos });
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  const net = j.paiement?.montantDeneigeur;

  return (
    <article className={`carte-job ${j.statut === "matchee" ? "carte-job--attention" : ""}`}>
      <div className="carte-job__haut">
        {j.statut === "matchee" && <span className="badge badge--argile">À faire</span>}
        {j.statut === "faite" && <span className="badge badge--vert">En attente de confirmation</span>}
        {j.statut === "signalee" && <span className="badge badge--gris">Signalée</span>}
        {j.statut === "completee" && <span className="badge badge--ardoise">Terminée</span>}
        {j.statut === "completee" ? (
          <span className="carte-job__meta">{dateCourte(j.confirmeeAt)}</span>
        ) : (
          <span className="heure">⏱ {echeance(j.dateHeureSouhaitee)}</span>
        )}
      </div>
      <div className="carte-job__titre">{j.titre}</div>

      {(j.statut === "matchee" || j.statut === "faite") && (
        <div>
          <div className="carte-job__adresse">{adresse ?? "Adresse…"}</div>
          <div className="carte-job__meta">
            {j.donneurPrenom}
            {j.description ? ` · ${j.description}` : ""}
          </div>
        </div>
      )}
      {j.outilsFournis && j.statut === "matchee" && <span className="carte-job__etiquette">Outils fournis sur place</span>}

      <div className="carte-job__ligne">
        <span className="carte-job__prix">{net != null ? formatArgent(net) : ""}</span>
        <span className="carte-job__meta">pour toi ({formatArgent(j.remunerationOfferte)} moins les frais)</span>
      </div>

      {j.statut === "faite" && (
        <p className="carte-job__note">
          {j.donneurPrenom} a jusqu'à <b>{j.confirmationAutoAt ? heure(j.confirmationAutoAt.toDate()) : "…"}</b> pour confirmer ou
          signaler un problème. Sans réponse, c'est confirmé tout seul et ton versement part.
        </p>
      )}
      {j.statut === "signalee" && (
        <p className="carte-job__note">Un problème a été signalé. On regarde ça et on vous revient par courriel, toi et le client.</p>
      )}
      {j.statut === "completee" && (
        <p className="carte-job__note">
          {j.confirmationAuto ? "Confirmée automatiquement." : `Confirmée par ${j.donneurPrenom}.`} Versement en route vers ton compte.
        </p>
      )}
      {j.statut === "completee" && j.evaluee && <EvaluationRecue demandeId={j.id} prenom={j.donneurPrenom} />}
      {erreur && <p className="message-erreur" role="alert">{erreur}</p>}

      {(j.statut === "matchee" || j.statut === "faite" || j.statut === "signalee" || j.dernierMessage) && (
        <div className="carte-job__actions">
          {j.statut === "matchee" && (
            <>
              <button type="button" className="btn btn--principal btn--petit" disabled={enCours} onClick={() => setModale("faite")}>
                {enCours ? "Envoi…" : "C'est fait"}
              </button>
              <button type="button" className="btn btn--lien" onClick={() => setModale("signaler")}>
                Signaler un problème
              </button>
            </>
          )}
          <BoutonMessages prenom={j.donneurPrenom} nouveau={nouveau} onClick={() => setModale("messages")} />
        </div>
      )}

      {modale === "faite" && (
        <ModaleFaite job={j} net={net} onConfirmer={confirmerFaite} onFermer={() => setModale(null)} />
      )}
      {modale === "signaler" && <ModaleSignalement demande={j} par="deneigeur" onFermer={() => setModale(null)} />}
      {modale === "messages" && (
        <Conversation
          demande={j}
          autrePrenom={j.donneurPrenom}
          onFermer={() => {
            setModale(null);
            if (conversationOuverte) onConversationFermee();
          }}
        />
      )}
    </article>
  );
}

// « C'est fait » exige de 1 à 3 photos du travail terminé, prises sur place
// avant de partir : la preuve pour le client et en cas de signalement.
const PHOTOS_MAX = 3;

function ModaleFaite({ job: j, net, onConfirmer, onFermer }) {
  const [photos, setPhotos] = useState([]);
  const [preparation, setPreparation] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function ajouter(e) {
    const fichiers = [...(e.target.files ?? [])].slice(0, PHOTOS_MAX - photos.length);
    e.target.value = "";
    if (!fichiers.length) return;
    setPreparation(true);
    setErreur(null);
    try {
      const prets = [];
      for (const f of fichiers) prets.push(await preparerPhoto(f));
      setPhotos((p) => [...p, ...prets].slice(0, PHOTOS_MAX));
    } catch (err) {
      setErreur(err.message);
    } finally {
      setPreparation(false);
    }
  }

  return (
    <Modale titre="La job est terminée ?" onFermer={onFermer}>
      <p>
        Avant de partir, prends <b>au moins une photo</b> du travail terminé (jusqu'à {PHOTOS_MAX}) : l'entrée, le
        balcon, le stationnement. {j.donneurPrenom} la voit tout de suite et a 12 heures pour confirmer ou signaler un
        problème. Sans réponse, c'est confirmé tout seul et ton versement de {formatArgent(net ?? 0)} part.
      </p>
      <div className="photos-faite">
        {photos.map((photo, i) => (
          <div key={i} className="photos-faite__vignette">
            <img src={photo} alt={`Photo ${i + 1}`} />
            <button
              type="button"
              className="photos-faite__retirer"
              aria-label={`Retirer la photo ${i + 1}`}
              onClick={() => setPhotos((p) => p.filter((_, k) => k !== i))}
            >
              ×
            </button>
          </div>
        ))}
        {photos.length < PHOTOS_MAX && (
          <label className="photos-faite__ajouter">
            <span aria-hidden="true">📷</span>
            {preparation ? "Préparation…" : photos.length ? "Une autre" : "Prendre une photo"}
            <input type="file" accept="image/*" capture="environment" multiple onChange={ajouter} className="sr-only" />
          </label>
        )}
      </div>
      <span className="modale__aide">
        Seuls vous deux voyez les photos. Elles sont effacées 30 jours après la job.
      </span>
      {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
      <div className="modale__actions">
        <button type="button" className="btn btn--fantome" onClick={onFermer}>
          Pas encore
        </button>
        <button
          type="button"
          className="btn btn--principal"
          disabled={preparation || photos.length === 0}
          onClick={() => onConfirmer(photos)}
        >
          {photos.length ? "Oui, c'est fait" : "Photo requise"}
        </button>
      </div>
    </Modale>
  );
}

function EvaluationRecue({ demandeId, prenom }) {
  const [evaluation, setEvaluation] = useState(null);
  useEffect(() => {
    lirePrive(demandeId, "evaluation")
      .then(setEvaluation)
      .catch(() => setEvaluation(null));
  }, [demandeId]);
  if (!evaluation) return null;
  return (
    <div className="evaluation-recue">
      <span className="etoile" aria-label={`${evaluation.note} sur 5`}>
        {"★".repeat(evaluation.note)}
        <span className="evaluation-recue__vide">{"★".repeat(5 - evaluation.note)}</span>
      </span>
      {evaluation.commentaire && (
        <p>
          « {evaluation.commentaire} » <span className="carte-job__meta">· {prenom}</span>
        </p>
      )}
    </div>
  );
}

function CarteDemandeOuverte({ demande: d, frais, compteActif }) {
  const [engagement, setEngagement] = useState(false);
  const [etat, setEtat] = useState("libre"); // libre | envoi | prise | erreur
  const [erreur, setErreur] = useState(null);
  const net = calculerPaiement(d.remunerationOfferte, frais).montantDeneigeur;
  const distance = distanceTexte(d.distanceM);

  async function accepter() {
    setEngagement(false);
    setEtat("envoi");
    setErreur(null);
    try {
      await accepterDemande({ demandeId: d.id });
      // La carte disparaît d'elle-même de la liste (plus « ouverte ») et
      // réapparaît dans « Mes jobs ».
    } catch (err) {
      setEtat(err.message === "deja-prise" ? "prise" : "erreur");
      setErreur(messageErreur(err));
    }
  }

  return (
    <article className="carte-job">
      <div className="carte-job__haut">
        <span className="carte-job__meta">
          {distance && <b>{distance}</b>}
          {distance && d.quartier ? " · " : ""}
          {d.quartier}
        </span>
        <span className="heure">⏱ {echeance(d.dateHeureSouhaitee)}</span>
      </div>
      <div className="carte-job__titre">{d.titre}</div>
      <div className="carte-job__meta">
        {d.description ? `${d.description} · ` : ""}Offert par {d.donneurPrenom} · {ilYa(d.createdAt)}
      </div>
      {d.outilsFournis && <span className="carte-job__etiquette" style={{ alignSelf: "flex-start" }}>Outils fournis sur place</span>}
      <div className="carte-job__ligne">
        <span className="carte-job__prix">{formatArgent(d.remunerationOfferte)}</span>
        <span className="carte-job__meta">{formatArgent(net)} pour toi</span>
      </div>
      {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
      <button
        type="button"
        className="btn btn--principal btn--petit"
        disabled={etat === "envoi" || etat === "prise" || !compteActif}
        title={compteActif ? undefined : "Configure ton compte de versement dans tes paramètres"}
        onClick={() => setEngagement(true)}
      >
        {etat === "envoi"
          ? "Confirmation…"
          : etat === "prise"
            ? "Déjà prise"
            : compteActif
              ? "Je prends la job"
              : "Compte de versement requis"}
      </button>

      {engagement && (
        <Modale titre="Tu prends cette job ?" onFermer={() => setEngagement(false)}>
          <div className="modale__resume">
            <b>{d.titre}</b>
            <span className="carte-job__meta">
              {d.quartier ? `${d.quartier} · ` : ""}
              {echeance(d.dateHeureSouhaitee)}
            </span>
            <span>
              <b>{formatArgent(net)}</b> pour toi
            </span>
          </div>
          <p className="modale__engagement">
            Tu t'engages à faire cette job {echeance(d.dateHeureSouhaitee).toLowerCase()}. Une fois acceptée, pas
            d'annulation possible : {d.donneurPrenom} compte sur toi.
          </p>
          <p>L'adresse exacte s'affiche dans « Mes jobs » dès que tu acceptes.</p>
          <div className="modale__actions">
            <button type="button" className="btn btn--fantome" onClick={() => setEngagement(false)}>
              Pas maintenant
            </button>
            <button type="button" className="btn btn--principal" onClick={accepter}>
              Je m'engage
            </button>
          </div>
        </Modale>
      )}
    </article>
  );
}
