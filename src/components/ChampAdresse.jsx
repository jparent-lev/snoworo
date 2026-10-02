import { useEffect, useId, useRef, useState } from "react";
import { suggererAdresses } from "../lib/adresse";
import "./ChampAdresse.css";

// Adresse d'une demande ou adresse de service, avec suggestions pendant la saisie (Canada,
// adresses civiques seulement). `valeur` : { texte, placeId, libelle }.
// Choisir une suggestion fixe placeId ; retaper l'efface. Si le service de
// suggestions ne répond pas, ou si l'adresse n'est pas dans la liste, on
// peut l'écrire au complet : le serveur vérifie alors qu'elle est précise.
export default function ChampAdresse({ valeur, onChange, manuel, onManuel, disabled = false }) {
  const [suggestions, setSuggestions] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const [indisponible, setIndisponible] = useState(false);
  const [recherche, setRecherche] = useState(false);
  const session = useRef(crypto.randomUUID());
  const idListe = useId();
  const choisie = Boolean(valeur.placeId);
  const sansSuggestions = manuel || indisponible;

  useEffect(() => {
    const texte = valeur.texte.trim();
    // Rien à chercher : la liste est simplement masquée (listeVisible).
    if (choisie || sansSuggestions || texte.length < 4) return undefined;
    let annule = false;
    const minuterie = setTimeout(async () => {
      setRecherche(true);
      try {
        const liste = await suggererAdresses(texte, session.current);
        if (!annule) {
          setSuggestions(liste);
          setActif(-1);
          setOuvert(true);
        }
      } catch {
        if (!annule) setIndisponible(true);
      } finally {
        if (!annule) setRecherche(false);
      }
    }, 300);
    return () => {
      annule = true;
      clearTimeout(minuterie);
    };
  }, [valeur.texte, choisie, sansSuggestions]);

  function choisir(s) {
    const libelle = [s.principal, s.secondaire].filter(Boolean).join(", ");
    onChange({ texte: libelle, placeId: s.placeId, libelle });
    setOuvert(false);
    // Une nouvelle saisie commence une nouvelle session de suggestions.
    session.current = crypto.randomUUID();
  }

  function clavier(e) {
    if (!ouvert || !suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && actif >= 0) {
      e.preventDefault();
      choisir(suggestions[actif]);
    } else if (e.key === "Escape") {
      setOuvert(false);
    }
  }

  const listeVisible = ouvert && !choisie && !sansSuggestions && valeur.texte.trim().length >= 4;

  return (
    <div className="champ-adresse">
      <input
        value={valeur.texte}
        onChange={(e) => onChange({ texte: e.target.value, placeId: null, libelle: null })}
        onKeyDown={clavier}
        onFocus={() => setOuvert(true)}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
        placeholder={sansSuggestions ? "1234, 3e Avenue, Québec, G1L 2M4" : "Commence par le numéro et la rue"}
        autoComplete="off"
        disabled={disabled}
        role="combobox"
        aria-expanded={listeVisible}
        aria-controls={idListe}
        aria-autocomplete="list"
        aria-activedescendant={actif >= 0 ? `${idListe}-${actif}` : undefined}
        required
      />
      {listeVisible && (
        <ul id={idListe} role="listbox" className="champ-adresse__liste">
          {recherche && !suggestions.length && <li className="champ-adresse__info">Recherche…</li>}
          {!recherche && !suggestions.length && (
            <li className="champ-adresse__info">Aucune adresse trouvée. Vérifie le numéro et la rue.</li>
          )}
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              id={`${idListe}-${i}`}
              role="option"
              aria-selected={i === actif}
              className={`champ-adresse__option ${i === actif ? "champ-adresse__option--actif" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choisir(s);
              }}
            >
              <b>{s.principal}</b>
              {s.secondaire && <span>{s.secondaire}</span>}
            </li>
          ))}
          <li className="champ-adresse__manuel">
            <button
              type="button"
              className="btn btn--lien"
              onMouseDown={(e) => {
                e.preventDefault();
                onManuel(true);
                setOuvert(false);
              }}
            >
              Mon adresse n'est pas dans la liste
            </button>
          </li>
        </ul>
      )}
      {choisie && <span className="champ-adresse__ok">✓ Adresse reconnue : {valeur.libelle}</span>}
      {indisponible && !manuel && (
        <span className="auth-form__aide">Suggestions indisponibles : écris l'adresse au complet, avec le code postal.</span>
      )}
      {manuel && (
        <span className="auth-form__aide">
          Écris l'adresse au complet, avec le numéro civique et le code postal. On vérifiera qu'elle est précise.{" "}
          <button type="button" className="btn btn--lien" onClick={() => onManuel(false)}>
            Revenir aux suggestions
          </button>
        </span>
      )}
    </div>
  );
}
