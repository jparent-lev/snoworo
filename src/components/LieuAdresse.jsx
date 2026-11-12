import { TEXTE_ATTESTATION } from "../lib/carnet";

// « Chez moi » ou « Chez un proche », prénom de la personne sur place et
// attestation d'autorisation : communs à l'ajout au carnet et à une adresse
// saisie pour une seule demande. valeur = { lien, personneSurPlace, attestation }.
export default function LieuAdresse({ valeur, onChange, disabled }) {
  const maj = (champ) => onChange({ ...valeur, ...champ });
  return (
    <>
      <fieldset className="auth-form__champ lieu-adresse" disabled={disabled}>
        <legend>À qui est cette adresse?</legend>
        <div className="lieu-adresse__choix">
          {[
            ["moi", "Chez moi"],
            ["proche", "Chez un proche"],
          ].map(([v, libelle]) => (
            <label key={v} className="auth-form__case">
              <input type="radio" name="lien" value={v} checked={valeur.lien === v} onChange={() => maj({ lien: v })} />
              {libelle}
            </label>
          ))}
        </div>
      </fieldset>
      {valeur.lien === "proche" && (
        <label className="auth-form__champ">
          Prénom de la personne sur place (facultatif)
          <input
            value={valeur.personneSurPlace}
            onChange={(e) => maj({ personneSurPlace: e.target.value })}
            maxLength={40}
            placeholder="Ex. Ginette"
            disabled={disabled}
          />
          <span className="auth-form__aide">Montré seulement au déneigeur qui accepte, pour qu'il sache à qui parler.</span>
        </label>
      )}
      <label className="auth-form__case auth-form__case--haut">
        <input
          type="checkbox"
          checked={valeur.attestation}
          onChange={(e) => maj({ attestation: e.target.checked })}
          disabled={disabled}
        />
        <span>{TEXTE_ATTESTATION}</span>
      </label>
    </>
  );
}
