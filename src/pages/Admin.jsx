import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { lireAnalyticsAdmin, lireMetriquesAdmin } from "../lib/admin";
import { messageServeur } from "../lib/erreurs";
import { formatArgent } from "../lib/formatArgent";
import "./Admin.css";

// /admin : acquisition et utilisation de la plateforme, en chiffres agrégés.
// L'accès est vérifié par le serveur (ADMIN_UIDS) ; cette page ne fait
// qu'afficher ce qu'il renvoie.
const STATUTS = [
  ["ouverte", "Ouvertes"],
  ["matchee", "Acceptées, à faire"],
  ["faite", "Faites, à confirmer"],
  ["completee", "Confirmées"],
  ["signalee", "Signalées"],
  ["paiement_refuse", "Carte refusée"],
  ["annulee", "Annulées"],
];

// Canaux par défaut de GA4, en français.
const CANAUX = {
  Direct: "Direct (adresse tapée, favoris)",
  "Organic Search": "Recherche (Google, Bing)",
  "Paid Search": "Recherche payante",
  "Organic Social": "Réseaux sociaux",
  "Paid Social": "Réseaux sociaux payants",
  Referral: "Sites référents (médias, liens)",
  Email: "Courriels",
  "Organic Video": "Vidéo",
  Display: "Bannières",
  Unassigned: "Non attribué",
  "Cross-network": "Multiréseau",
  "Organic Shopping": "Magasinage",
};

const nombre = (n) => (n == null ? "-" : n.toLocaleString("fr-CA"));
const pourcent = (x) => (x == null ? "-" : `${Math.round(x * 100)} %`);
const delai = (min) => (min == null ? "-" : min < 60 ? `${min} min` : `${(min / 60).toLocaleString("fr-CA", { maximumFractionDigits: 1 })} h`);
const jourCourt = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "short" });

function Tuile({ libelle, valeur, detail }) {
  return (
    <div className="admin__tuile">
      <span className="admin__tuile-libelle">{libelle}</span>
      <span className="admin__tuile-valeur">{valeur}</span>
      {detail && <span className="admin__tuile-detail">{detail}</span>}
    </div>
  );
}

// Barres par jour (30 jours), une seule série : le titre la nomme. Survol :
// la valeur et le jour.
function BarresParJour({ titre, serie, cle }) {
  const [survol, setSurvol] = useState(null);
  const max = Math.max(1, ...serie.map((j) => j[cle]));
  const L = 600;
  const H = 140;
  const pas = L / serie.length;
  const largeur = Math.max(4, pas - 4);
  const total = serie.reduce((s, j) => s + j[cle], 0);
  const actif = survol == null ? null : serie[survol];
  return (
    <figure className="admin__graphique">
      <figcaption>
        <strong>{titre}</strong>
        <span>{actif ? `${jourCourt(actif.jour)} : ${nombre(actif[cle])}` : `${nombre(total)} en 30 jours`}</span>
      </figcaption>
      <svg viewBox={`0 0 ${L} ${H + 20}`} role="img" aria-label={`${titre}, ${total} en 30 jours`} onMouseLeave={() => setSurvol(null)}>
        <line x1="0" x2={L} y1={H} y2={H} className="admin__axe" />
        <text x="0" y="10" className="admin__echelle">{max}</text>
        {serie.map((j, i) => {
          const h = (j[cle] / max) * (H - 16);
          const x = i * pas + (pas - largeur) / 2;
          return (
            <g key={j.jour} onMouseEnter={() => setSurvol(i)}>
              <rect x={i * pas} y="0" width={pas} height={H} fill="transparent" />
              {j[cle] > 0 && (
                <path
                  className={`admin__barre ${survol === i ? "admin__barre--survol" : ""}`}
                  d={`M${x},${H} V${H - h + 4} q0,-4 4,-4 h${largeur - 8} q4,0 4,4 V${H} Z`}
                />
              )}
            </g>
          );
        })}
        <text x="0" y={H + 16} className="admin__echelle">{jourCourt(serie[0].jour)}</text>
        <text x={L} y={H + 16} textAnchor="end" className="admin__echelle">Aujourd'hui</text>
      </svg>
    </figure>
  );
}

function SectionGa({ ga, jours }) {
  if (ga === null) return <p className="admin__meta">Chargement de Google Analytics…</p>;
  if (ga.erreur) return <p className="message-erreur" role="alert">{ga.erreur}</p>;
  if (!ga.configure) return <p className="admin__meta">Google Analytics n'est pas branché sur cet environnement.</p>;
  const visiteursParJour = Object.fromEntries(ga.parJour.map((j) => [j.jour, j.visiteurs]));
  const serie = jours.map((j) => ({ jour: j.jour, visiteurs: visiteursParJour[j.jour] ?? 0 }));
  const e = ga.evenements;
  const etapes = [
    ["Visiteurs", ga.visiteurs.j30],
    ["Comptes créés", e.sign_up],
    ["Demandes publiées", e.demande_publiee],
    ["Demandes acceptées", e.demande_acceptee],
    ["Demandes confirmées", e.demande_confirmee],
  ];
  return (
    <>
      <div className="admin__tuiles">
        <Tuile libelle="Visiteurs" valeur={nombre(ga.visiteurs.j7)} detail={`7 jours · ${nombre(ga.visiteurs.j30)} en 30 jours`} />
        <Tuile libelle="Nouveaux visiteurs" valeur={nombre(ga.nouveaux.j7)} detail={`7 jours · ${nombre(ga.nouveaux.j30)} en 30 jours`} />
        <Tuile libelle="Sessions" valeur={nombre(ga.sessions.j7)} detail={`7 jours · ${nombre(ga.sessions.j30)} en 30 jours`} />
        <Tuile libelle="Clics sur les appels à l'action" valeur={nombre(e.cta_clic)} detail={`30 jours · ${nombre(e.video_ouverte)} vidéos ouvertes`} />
      </div>
      <BarresParJour titre="Visiteurs par jour" serie={serie} cle="visiteurs" />
      <div className="admin__colonnes">
        <section>
          <h3>Provenance des visites (30 jours)</h3>
          <table className="admin__table">
            <thead>
              <tr>
                <th scope="col">Canal</th>
                <th scope="col">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {ga.canaux.map((c) => (
                <tr key={c.canal}>
                  <th scope="row">{CANAUX[c.canal] ?? c.canal}</th>
                  <td>{nombre(c.sessions)}</td>
                </tr>
              ))}
              {ga.canaux.length === 0 && (
                <tr>
                  <th scope="row">Aucune visite mesurée</th>
                  <td>0</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
        <section>
          <h3>Entonnoir (30 jours)</h3>
          <table className="admin__table">
            <tbody>
              {etapes.map(([libelle, n], i) => (
                <tr key={libelle}>
                  <th scope="row">{libelle}</th>
                  <td>
                    {nombre(n)}
                    {i > 0 && etapes[i - 1][1] > 0 && <span className="admin__taux"> · {pourcent(n / etapes[i - 1][1])}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <p className="admin__meta">
        Seuls les visiteurs qui acceptent la mesure sont comptés (Loi 25) : les chiffres réels sont plus élevés. Les comptes et
        demandes ci-dessous, eux, sont exacts.
      </p>
    </>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [m, setM] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [ga, setGa] = useState(null); // null = en cours ; { erreur } ; données

  const charger = useCallback(async () => {
    setEnCours(true);
    setErreur(null);
    setGa(null);
    lireAnalyticsAdmin()
      .then(setGa)
      .catch((err) =>
        setGa({
          erreur:
            messageServeur(err) === "acces-ga"
              ? "Le compte de service des fonctions n'a pas encore accès à la propriété Google Analytics (rôle « Lecteur »), ou l'API Analytics Data n'est pas activée."
              : "Google Analytics ne répond pas pour l'instant.",
        }),
      );
    try {
      setM(await lireMetriquesAdmin());
      // Le serveur vient peut-être d'ajouter { admin: true } : rafraîchir le
      // jeton fait apparaître le lien « Admin » dans l'en-tête.
      user?.getIdToken(true).catch(() => {});
    } catch (err) {
      setErreur(err.code === "functions/permission-denied" ? "refuse" : "Impossible de charger les métriques.");
    } finally {
      setEnCours(false);
    }
  }, [user]);

  useEffect(() => {
    document.title = "Admin · Snowro";
    charger();
  }, [charger]);

  if (erreur === "refuse") {
    return (
      <div className="admin">
        <h1>Accès réservé</h1>
        <p>Cette page est réservée à l'administration de Snowro.</p>
      </div>
    );
  }

  return (
    <div className="admin">
      <div className="admin__entete">
        <div>
          <h1>Tableau de bord</h1>
          {m && (
            <p className="admin__meta">
              Mis à jour le {new Date(m.genereA).toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "short" })}. Chiffres
              agrégés, aucun renseignement personnel.
            </p>
          )}
        </div>
        <button type="button" className="btn btn--fantome" onClick={charger} disabled={enCours}>
          {enCours ? "Chargement…" : "Actualiser"}
        </button>
      </div>
      {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
      {!m && !erreur && <p>Chargement…</p>}

      {m && (
        <>
          <h2>Visites (Google Analytics)</h2>
          <SectionGa ga={ga} jours={m.parJour} />

          <h2>Acquisition</h2>
          <div className="admin__tuiles">
            <Tuile libelle="Comptes" valeur={nombre(m.comptes.total)} detail={`+${nombre(m.comptes.j1)} en 24 h · +${nombre(m.comptes.j7)} en 7 jours`} />
            <Tuile libelle="Clients" valeur={nombre(m.comptes.clients)} detail={`${nombre(m.comptes.cartes)} avec une carte`} />
            <Tuile
              libelle="Déneigeurs"
              valeur={nombre(m.comptes.deneigeurs)}
              detail={`${nombre(m.comptes.deneigeursVersementActif)} prêts à être payés · ${nombre(m.comptes.deneigeursAdresse)} avec adresse`}
            />
            <Tuile libelle="Liste d'attente" valeur={nombre(m.listeAttente.total)} detail={`${nombre(m.listeAttente.confirmees)} confirmées · +${nombre(m.listeAttente.j7)} en 7 jours`} />
          </div>
          <p className="admin__meta">
            {nombre(m.comptes.deuxRoles)} comptes ont les deux rôles, {nombre(m.comptes.sansRole)} n'ont pas encore choisi.{" "}
            {nombre(m.comptes.cellulaires)} cellulaires vérifiés, {nombre(m.comptes.smsConsentis)} consentements aux textos.
          </p>
          <BarresParJour titre="Nouveaux comptes par jour" serie={m.parJour} cle="comptes" />

          <h2>Utilisation</h2>
          <div className="admin__tuiles">
            <Tuile libelle="Demandes publiées" valeur={nombre(m.demandes.total)} detail={`+${nombre(m.demandes.j1)} en 24 h · +${nombre(m.demandes.j7)} en 7 jours`} />
            <Tuile libelle="Ouvertes en ce moment" valeur={nombre(m.demandes.ouvertesMaintenant)} detail="En attente d'un déneigeur" />
            <Tuile libelle="Taux d'acceptation" valeur={pourcent(m.demandes.tauxAcceptation)} detail={`Délai médian : ${delai(m.demandes.delaiMedianAcceptationMin)}`} />
            <Tuile
              libelle="Confirmation"
              valeur={m.demandes.delaiMedianConfirmationH == null ? "-" : `${m.demandes.delaiMedianConfirmationH.toLocaleString("fr-CA")} h`}
              detail="Délai médian entre « fait » et confirmé"
            />
          </div>
          <BarresParJour titre="Demandes publiées par jour" serie={m.parJour} cle="demandes" />

          <div className="admin__colonnes">
            <section>
              <h3>Demandes par statut</h3>
              <table className="admin__table">
                <tbody>
                  {STATUTS.filter(([k]) => m.demandes.parStatut[k]).map(([k, libelle]) => (
                    <tr key={k}>
                      <th scope="row">{libelle}</th>
                      <td>{nombre(m.demandes.parStatut[k])}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Annulées pour retard (remboursées)</th>
                    <td>{nombre(m.demandes.annuleesRetard)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Avec un signalement</th>
                    <td>{nombre(m.demandes.signalees)}</td>
                  </tr>
                </tbody>
              </table>
            </section>
            <section>
              <h3>Argent</h3>
              <table className="admin__table">
                <tbody>
                  <tr>
                    <th scope="row">Volume confirmé ({nombre(m.argent.nbConfirmees)} demandes)</th>
                    <td>{formatArgent(m.argent.volumeConfirme)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Frais Snowro</th>
                    <td>{formatArgent(m.argent.fraisSnowro)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Versé ou à verser aux déneigeurs</th>
                    <td>{formatArgent(m.argent.montantDeneigeurs)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Panier moyen</th>
                    <td>{m.argent.panierMoyen == null ? "-" : formatArgent(m.argent.panierMoyen)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Retenu en ce moment</th>
                    <td>{formatArgent(m.argent.enRetenue)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Remboursé</th>
                    <td>{formatArgent(m.argent.rembourse)}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>

          <h2>Par ville</h2>
          <div className="admin__defilement">
            <table className="admin__table admin__table--villes">
              <thead>
                <tr>
                  <th scope="col">Ville</th>
                  <th scope="col">Déneigeurs</th>
                  <th scope="col">Clients</th>
                  <th scope="col">Demandes</th>
                  <th scope="col">Ouvertes</th>
                  <th scope="col">Confirmées</th>
                </tr>
              </thead>
              <tbody>
                {m.villes.map((v) => (
                  <tr key={v.ville}>
                    <th scope="row">{v.ville}</th>
                    <td>{nombre(v.deneigeurs)}</td>
                    <td>{nombre(v.clients)}</td>
                    <td>{nombre(v.demandes)}</td>
                    <td>{nombre(v.ouvertes)}</td>
                    <td>{nombre(v.completees)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="admin__meta">
            Clients : ville connue seulement s'ils ont aussi enregistré une adresse de service. Sources de trafic (Google, Facebook,
            courriels) : voir Google Analytics.
          </p>
        </>
      )}
    </div>
  );
}
