import "./ApercuTableau.css";

// Aperçu décoratif du tableau de bord côté client (section « Dans l'app ») :
// une job « À confirmer » avec les photos du déneigeur et un message reçu.
// Reprend les composants réels (carte de job, étapes, bulle de conversation)
// en version figée ; tout le sens est aussi donné en texte à côté.
function PhotoNeige({ variante }) {
  return (
    <svg viewBox="0 0 80 60" className="apercu-tableau__photo">
      <rect width="80" height="60" fill="#DCE6E8" />
      <rect y="34" width="80" height="26" fill="#F4F6F7" />
      {variante === 1 ? (
        <>
          <rect x="8" y="12" width="30" height="24" fill="#C1652F" />
          <rect x="15" y="20" width="8" height="16" fill="#3B2A1F" />
          <path d="M19 36 L30 60 L48 60 L26 36 Z" fill="#8E9AA0" />
          <path d="M0 40 Q10 35 18 38 L15 60 L0 60 Z M40 38 Q55 33 80 40 L80 60 L52 60 Z" fill="#FFFFFF" />
        </>
      ) : (
        <>
          <rect x="36" y="10" width="36" height="26" fill="#9E4E23" />
          <rect x="44" y="18" width="10" height="9" fill="#EDE0CC" />
          <path d="M6 44 H70 V58 H6 Z" fill="#8E9AA0" />
          <path d="M0 42 Q4 38 8 42 V60 H0 Z M70 42 Q76 37 80 42 V60 H70 Z" fill="#FFFFFF" />
        </>
      )}
    </svg>
  );
}

export default function ApercuTableau() {
  return (
    <div className="apercu-tableau" aria-hidden="true">
      <div className="apercu-tableau__bascule">
        <span className="apercu-tableau__bascule--actif">Client</span>
        <span>Déneigeur</span>
      </div>
      <div className="apercu-tableau__carte">
        <div className="apercu-tableau__haut">
          <span className="apercu-tableau__badge">À confirmer</span>
          <span className="apercu-tableau__meta">il y a 4 min</span>
        </div>
        <div className="apercu-tableau__titre">Entrée double + balcon</div>
        <div className="apercu-tableau__personne">
          <span className="apercu-tableau__pastille">M</span>
          <span>
            <b>Marc dit que c'est fait</b>
            <span className="apercu-tableau__meta">
              <span className="apercu-tableau__etoile">★</span> 4,8 · 23 jobs
            </span>
          </span>
        </div>
        <div className="apercu-tableau__photos">
          <PhotoNeige variante={1} />
          <PhotoNeige variante={2} />
          <span className="apercu-tableau__photos-legende">📷 2 photos prises à 7 h 52</span>
        </div>
        <div className="apercu-tableau__note">
          Confirmée automatiquement dans <b>12 h</b> si tu ne fais rien.
        </div>
        <div className="apercu-tableau__actions">
          <span className="apercu-tableau__bouton apercu-tableau__bouton--principal">Confirmer</span>
          <span className="apercu-tableau__bouton">Signaler un problème</span>
        </div>
        <div className="apercu-tableau__etapes">
          {["Publiée", "Acceptée", "Faite", "Confirmée"].map((e, i) => (
            <span key={e} className={i < 2 ? "fait" : i === 2 ? "encours" : ""}>
              {e}
            </span>
          ))}
        </div>
      </div>
      <div className="apercu-tableau__bulle">
        <span className="apercu-tableau__bulle-qui">Marc · 7 h 53</span>
        J'ai aussi dégagé les marches du balcon. Bonne journée !
      </div>
    </div>
  );
}
