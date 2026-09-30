import { useEffect, useRef, useState } from "react";
import { messageErreur, signalerProbleme } from "../../lib/cycleDemande";
import { ROLE_CLIENT, ROLE_DENEIGEUR } from "../../lib/mode";

// Éléments partagés par les deux tableaux de bord.

const ORDRE_ETAPES = ["ouverte", "matchee", "faite", "completee"];
const LIBELLES_ETAPES = ["Publiée", "Acceptée", "Faite", "Confirmée"];

// Barre d'étapes Publiée > Acceptée > Faite > Confirmée. Une demande signalée
// reste figée à l'étape où le problème a été signalé.
export function Etapes({ demande }) {
  const statut = demande.statut === "signalee" ? demande.signalement?.statutPrecedent : demande.statut;
  const position = ORDRE_ETAPES.indexOf(statut);
  return (
    <div className="etapes" aria-label={`Étape : ${LIBELLES_ETAPES[position] ?? ""}`}>
      {LIBELLES_ETAPES.map((libelle, i) => {
        const classe = statut === "completee" || i < position ? "etapes__etape--fait" : i === position ? "etapes__etape--encours" : "";
        return (
          <span key={libelle} className={`etapes__etape ${classe}`}>
            {libelle}
          </span>
        );
      })}
    </div>
  );
}

export function Personne({ prenom, note, texte }) {
  const initiale = (prenom || "?").charAt(0).toUpperCase();
  return (
    <div className="personne">
      <div className="personne__pastille">{initiale}</div>
      <div>
        <b>{texte}</b>
        {note && (
          <div className="carte-job__meta">
            {note.nombre > 0 ? (
              <>
                <span className="etoile">★</span> {note.moyenne ? note.moyenne.toFixed(1).replace(".", ",") : "Nouveau"} · {note.nombre} job
                {note.nombre > 1 ? "s" : ""}
              </>
            ) : (
              "Nouveau sur Snowro"
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function Modale({ titre, onFermer, children }) {
  const boite = useRef(null);
  useEffect(() => {
    const precedent = document.activeElement;
    boite.current?.querySelector("button, select, textarea, input")?.focus();
    const touche = (e) => e.key === "Escape" && onFermer();
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("keydown", touche);
      precedent?.focus?.();
    };
  }, [onFermer]);

  return (
    <div className="modale__fond" onClick={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="modale" role="dialog" aria-modal="true" aria-label={titre} ref={boite}>
        <h2>{titre}</h2>
        {children}
      </div>
    </div>
  );
}

const MOTIFS = {
  client: [
    { cle: "absent", libelle: "Personne n'est venu" },
    { cle: "incomplet", libelle: "La job n'est pas faite au complet" },
    { cle: "autre", libelle: "Autre chose" },
  ],
  deneigeur: [
    { cle: "acces", libelle: "Je n'ai pas pu accéder à l'endroit" },
    { cle: "autre", libelle: "Autre chose" },
  ],
};

// Seul recours une fois une job acceptée (pas d'annulation, décision produit).
export function ModaleSignalement({ demande, par, onFermer }) {
  const [motif, setMotif] = useState(MOTIFS[par][0].cle);
  const [details, setDetails] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function envoyer(e) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    try {
      await signalerProbleme({ demandeId: demande.id, motif, details });
      onFermer();
    } catch (err) {
      setErreur(messageErreur(err));
      setEnCours(false);
    }
  }

  return (
    <Modale titre="Signaler un problème" onFermer={onFermer}>
      <p>
        On met la job sur pause et aucun versement ne part tant qu'on n'a pas regardé ça. On te revient par
        courriel.
      </p>
      <form onSubmit={envoyer} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          Ce qui se passe
          <select value={motif} onChange={(e) => setMotif(e.target.value)}>
            {MOTIFS[par].map((m) => (
              <option key={m.cle} value={m.cle}>
                {m.libelle}
              </option>
            ))}
          </select>
        </label>
        <label>
          Détails (facultatif)
          <textarea rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
        </label>
        {erreur && <p className="carte-job__erreur">{erreur}</p>}
        <div className="modale__actions">
          <button type="button" className="btn btn--fantome" onClick={onFermer}>
            Retour
          </button>
          <button type="submit" className="btn btn--principal" disabled={enCours}>
            {enCours ? "Envoi…" : "Signaler"}
          </button>
        </div>
      </form>
    </Modale>
  );
}

const CHOIX_ROLES = [
  { role: ROLE_CLIENT, titre: "Je veux faire déneiger", texte: "Publier des demandes pour chez moi ou pour un proche." },
  { role: ROLE_DENEIGEUR, titre: "Je veux déneiger", texte: "Prendre des jobs près de chez moi, quand ça me convient." },
];

// Sélection multiple : on peut cocher les deux.
export function ChoixRoles({ valeur, onChange }) {
  const basculer = (role) => onChange(valeur.includes(role) ? valeur.filter((r) => r !== role) : [...valeur, role]);
  return (
    <div className="roles">
      {CHOIX_ROLES.map((c) => (
        <button
          key={c.role}
          type="button"
          role="checkbox"
          aria-checked={valeur.includes(c.role)}
          className={`roles__choix ${valeur.includes(c.role) ? "roles__choix--actif" : ""}`}
          onClick={() => basculer(c.role)}
        >
          <strong>
            {valeur.includes(c.role) ? "✓ " : ""}
            {c.titre}
          </strong>
          <span>{c.texte}</span>
        </button>
      ))}
    </div>
  );
}
