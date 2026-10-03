import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { LONGUEUR_MAX, STATUTS_ECRITURE, ecouterMessages, envoyerMessage, marquerLu } from "../../lib/messagerie";
import { dateCourte, estAujourdhui, heure } from "../../lib/temps";
import { Modale } from "./elements";

// Bouton « Écrire à Marc » d'une carte de job, avec pastille si un message
// non lu attend.
export function BoutonMessages({ prenom, nouveau, onClick }) {
  return (
    <button type="button" className="btn btn--ardoise btn--petit bouton-messages" onClick={onClick}>
      {nouveau && <span className="bouton-messages__pastille" aria-hidden="true" />}
      {nouveau ? "Nouveau message" : `Écrire à ${prenom}`}
      {nouveau && <span className="sr-only"> de {prenom}</span>}
    </button>
  );
}

function quand(date) {
  if (!date) return "";
  return estAujourdhui(date) ? heure(date) : `${dateCourte(date)}, ${heure(date)}`;
}

export default function Conversation({ demande, autrePrenom, onFermer }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState(null);
  const [texte, setTexte] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const fil = useRef(null);
  const ouverte = STATUTS_ECRITURE.includes(demande.statut);

  useEffect(
    () =>
      ecouterMessages(demande.id, setMessages, () =>
        setErreur("Impossible d'afficher la conversation pour l'instant."),
      ),
    [demande.id],
  );

  // Conversation ouverte = lue, y compris les messages qui arrivent pendant
  // qu'elle est affichée.
  const nbMessages = messages?.length ?? 0;
  useEffect(() => {
    marquerLu(user.uid, demande.id).catch(() => {});
  }, [user.uid, demande.id, nbMessages]);

  useEffect(() => {
    if (fil.current) fil.current.scrollTop = fil.current.scrollHeight;
  }, [nbMessages]);

  async function envoyer(e) {
    e?.preventDefault();
    const contenu = texte.trim();
    if (!contenu || enCours) return;
    setEnCours(true);
    setErreur(null);
    // Le message s'affiche tout de suite (cache local) : le champ se vide sans
    // attendre la confirmation du serveur, et le texte revient en cas d'échec.
    setTexte("");
    try {
      await envoyerMessage(demande.id, user.uid, contenu);
    } catch {
      setTexte(contenu);
      setErreur("Le message n'est pas parti. Réessaie dans un instant.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modale titre={`Conversation avec ${autrePrenom}`} onFermer={onFermer} classe="modale--conversation" fermer>
      <p className="conversation__sujet">{demande.titre}</p>
      <div className="conversation__fil" ref={fil} aria-live="polite">
        {messages && messages.length === 0 && demande.messagesEffaces && (
          <p className="conversation__vide">Les messages sont effacés 30 jours après la job.</p>
        )}
        {messages && messages.length === 0 && !demande.messagesEffaces && (
          <p className="conversation__vide">
            Pas encore de message. Une question sur l'accès, l'endroit où mettre la neige, l'heure d'arrivée ?
            C'est ici.
          </p>
        )}
        {messages?.map((m) => {
          const moi = m.expediteurId === user.uid;
          const date = m.createdAt?.toDate?.();
          return (
            <div key={m.id} className={`bulle ${moi ? "bulle--moi" : ""}`}>
              <span className="sr-only">{moi ? "Toi" : autrePrenom} : </span>
              <span className="bulle__texte">{m.contenu}</span>
              <span className="bulle__heure">{quand(date)}</span>
            </div>
          );
        })}
      </div>

      {erreur && <p className="message-erreur" role="alert">{erreur}</p>}

      {ouverte ? (
        <form className="conversation__saisie" onSubmit={envoyer}>
          <textarea
            data-autofocus
            rows={2}
            maxLength={LONGUEUR_MAX}
            placeholder={`Écrire à ${autrePrenom}…`}
            aria-label={`Message à ${autrePrenom}`}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              // Entrée envoie, Maj+Entrée fait un saut de ligne.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) envoyer(e);
            }}
          />
          <button type="submit" className="btn btn--principal btn--petit" disabled={!texte.trim() || enCours}>
            {enCours ? "Envoi…" : "Envoyer"}
          </button>
        </form>
      ) : (
        <p className="conversation__fermee">
          La job est terminée : la conversation reste lisible 30 jours, puis elle est effacée.
        </p>
      )}
      <p className="conversation__rappel">
        Pour ta sécurité, garde les échanges et les paiements dans Snowro. {autrePrenom} reçoit un avis par courriel.
      </p>
    </Modale>
  );
}
