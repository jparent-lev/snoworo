import { useState } from "react";
import { REGLES_DEFAUT, inviterJeune, reglerJeune, resumeRegles } from "../lib/jeunes";
import { messageServeur } from "../lib/erreurs";

// Paramètres du parent : inviter son jeune (14 à 17 ans), fixer ses règles
// une fois, mettre en pause ou retirer son accord (projet pilote).
const VIDE = { prenom: "", courriel: "", anneeNaissance: "", ...REGLES_DEFAUT, attestation: false };

function ChampsRegles({ valeur, onChange, disabled }) {
  const champ = (cle, libelle, min, max) => (
    <label className="auth-form__champ jeunes__regle">
      {libelle}
      <input type="number" min={min} max={max} value={valeur[cle]} onChange={(e) => onChange({ ...valeur, [cle]: e.target.value })} disabled={disabled} />
    </label>
  );
  return (
    <div className="jeunes__regles">
      {champ("heureDebut", "Pas avant (h)", 6, 21)}
      {champ("heureFin", "Pas après (h)", 7, 22)}
      {champ("rayonKm", "Rayon (km)", 1, 5)}
      {champ("maxParJour", "Demandes par jour", 1, 5)}
    </div>
  );
}

const versRegles = (v) => ({ heureDebut: Number(v.heureDebut), heureFin: Number(v.heureFin), rayonKm: Number(v.rayonKm), maxParJour: Number(v.maxParJour) });

export default function SectionJeunes({ profile }) {
  const [form, setForm] = useState(null);
  const [edition, setEdition] = useState(null); // { id, regles }
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const jeunes = Object.entries(profile.jeunes ?? {}).filter(([, j]) => j.statut !== "retire");

  async function inviter(e) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await inviterJeune({
        prenom: form.prenom.trim(),
        courriel: form.courriel.trim(),
        anneeNaissance: Number(form.anneeNaissance),
        attestation: form.attestation,
        regles: versRegles(form),
      });
      setMessage(`Invitation envoyée à ${form.courriel.trim()}.`);
      setForm(null);
    } catch (err) {
      setErreur(messageServeur(err) || "Une erreur est survenue.");
    } finally {
      setEnCours(false);
    }
  }

  async function regler(id, changement) {
    setErreur(null);
    setMessage(null);
    try {
      await reglerJeune({ invitationId: id, ...changement });
      return true;
    } catch (err) {
      setErreur(messageServeur(err) || "Une erreur est survenue.");
      return false;
    }
  }

  async function enregistrerRegles(e) {
    e.preventDefault();
    setEnCours(true);
    const prenom = profile.jeunes?.[edition.id]?.prenom;
    if (await regler(edition.id, { regles: versRegles(edition.regles) })) {
      setEdition(null);
      setMessage(`Règles de ${prenom} mises à jour.`);
    }
    setEnCours(false);
  }

  return (
    <>
      <h1 id="jeunes">Jeune déneigeur</h1>
      <p className="parametres__intro">
        Projet pilote : votre jeune de 14 à 17 ans déneige près de la maison avec son propre accès. Les paiements arrivent dans
        votre compte de versement. Vous fixez ses règles une fois, vous êtes avisé à chaque demande acceptée et vous pouvez en
        annuler une tant que le travail n'est pas fait.
      </p>
      <div className="parametres__liste">
        {jeunes.map(([id, j]) => (
          <div key={id} className="parametres__item jeunes__fiche">
            <div className="parametres__item-texte">
              <h3>{j.prenom}</h3>
              <p>{j.statut === "invite" ? `Invitation envoyée à ${j.courriel}, en attente.` : "Actif."}</p>
              <p className="parametres__meta">Règles : {resumeRegles(j.regles)}.</p>
              {j.pause && <p className="parametres__meta">En pause : aucune nouvelle demande.</p>}
              {edition?.id === id && (
                <form className="jeunes__edition" onSubmit={enregistrerRegles} noValidate>
                  <ChampsRegles valeur={edition.regles} onChange={(r) => setEdition({ id, regles: r })} disabled={enCours} />
                  <div className="parametres__carnet-actions">
                    <button type="submit" className="auth-form__bouton" disabled={enCours}>
                      {enCours ? "Enregistrement…" : "Enregistrer"}
                    </button>
                    <button type="button" className="btn btn--lien" onClick={() => setEdition(null)} disabled={enCours}>
                      Annuler
                    </button>
                  </div>
                </form>
              )}
            </div>
            <div className="jeunes__actions">
              {edition?.id !== id && (
                <button type="button" className="btn btn--fantome" onClick={() => { setEdition({ id, regles: { ...REGLES_DEFAUT, ...j.regles } }); setMessage(null); }}>
                  Modifier les règles
                </button>
              )}
              {j.statut === "actif" && (
                <button type="button" className="btn btn--fantome" onClick={() => regler(id, { pause: !j.pause })}>
                  {j.pause ? "Reprendre" : "Mettre en pause"}
                </button>
              )}
              <button type="button" className="btn btn--lien" onClick={() => window.confirm(`Retirer votre accord pour ${j.prenom}?`) && regler(id, { retirer: true })}>
                Retirer mon accord
              </button>
            </div>
          </div>
        ))}
        {message && <p className="champ-adresse__ok">✓ {message}</p>}
        {erreur && <p className="message-erreur" role="alert">{erreur}</p>}
        {form ? (
          <form className="parametres__item parametres__carnet-ajout" onSubmit={inviter} noValidate>
            <h3>Inviter mon jeune</h3>
            <label className="auth-form__champ">
              Son prénom
              <input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} maxLength={40} disabled={enCours} />
            </label>
            <label className="auth-form__champ">
              Son courriel (il recevra le lien pour créer son accès)
              <input type="email" value={form.courriel} onChange={(e) => setForm({ ...form, courriel: e.target.value })} disabled={enCours} />
            </label>
            <label className="auth-form__champ">
              Son année de naissance
              <input type="number" value={form.anneeNaissance} onChange={(e) => setForm({ ...form, anneeNaissance: e.target.value })} placeholder="Ex. 2011" disabled={enCours} />
            </label>
            <span className="auth-form__champ">Ses règles</span>
            <ChampsRegles valeur={form} onChange={setForm} disabled={enCours} />
            <label className="auth-form__case auth-form__case--haut">
              <input type="checkbox" checked={form.attestation} onChange={(e) => setForm({ ...form, attestation: e.target.checked })} disabled={enCours} />
              <span>Je suis son parent ou tuteur légal, et je consens à sa participation au projet pilote, dont les paiements versés dans mon compte.</span>
            </label>
            <div className="parametres__carnet-actions">
              <button type="submit" className="auth-form__bouton" disabled={enCours || !form.attestation}>
                {enCours ? "Envoi…" : "Envoyer l'invitation"}
              </button>
              <button type="button" className="btn btn--lien" onClick={() => setForm(null)} disabled={enCours}>
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn btn--fantome parametres__carnet-bouton" onClick={() => { setForm(VIDE); setMessage(null); }}>
            Inviter mon jeune
          </button>
        )}
      </div>
    </>
  );
}
