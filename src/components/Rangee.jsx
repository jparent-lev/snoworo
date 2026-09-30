import { useCallback, useEffect, useRef, useState } from "react";
import "./Rangee.css";

// Rangée horizontale de cartes (tableaux de bord) : titre, compte, filtres en
// puces, tri facultatif, flèches sur ordinateur et glissement au doigt sur
// mobile. `filtres` : [{ cle, libelle, compte? }].
export default function Rangee({ titre, compte, filtres, filtreActif, onFiltre, tri, vide, pied, children }) {
  const piste = useRef(null);
  const [bords, setBords] = useState({ debut: true, fin: true });

  const mesurer = useCallback(() => {
    const el = piste.current;
    if (!el) return;
    setBords({ debut: el.scrollLeft <= 2, fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    mesurer();
    const el = piste.current;
    if (!el) return undefined;
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [mesurer, children]);

  function defiler(sens) {
    const el = piste.current;
    el?.scrollBy({ left: sens * el.clientWidth * 0.85, behavior: "smooth" });
  }

  const nbCartes = Array.isArray(children) ? children.filter(Boolean).length : children ? 1 : 0;

  return (
    <section className="rangee">
      <div className="rangee__entete">
        <h2 className="rangee__titre">
          {titre} {compte != null && <small>{compte}</small>}
        </h2>
        <div className="rangee__outils">
          {tri && (
            <label className="rangee__tri">
              <span>Trier :</span>
              <select value={tri.valeur} onChange={(e) => tri.onChange(e.target.value)}>
                {tri.options.map((o) => (
                  <option key={o.cle} value={o.cle}>
                    {o.libelle}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className="rangee__fleche" onClick={() => defiler(-1)} disabled={bords.debut} aria-label="Précédent">
            ‹
          </button>
          <button type="button" className="rangee__fleche" onClick={() => defiler(1)} disabled={bords.fin} aria-label="Suivant">
            ›
          </button>
        </div>
      </div>

      {filtres && (
        <div className="rangee__filtres" role="tablist" aria-label={`Filtrer : ${titre}`}>
          {filtres.map((f) => (
            <button
              key={f.cle}
              type="button"
              role="tab"
              aria-selected={filtreActif === f.cle}
              className={`rangee__puce ${filtreActif === f.cle ? "rangee__puce--actif" : ""}`}
              onClick={() => onFiltre(f.cle)}
            >
              {f.libelle}
              {f.compte != null && <b>{f.compte}</b>}
            </button>
          ))}
        </div>
      )}

      {nbCartes === 0 ? (
        <p className="rangee__vide">{vide}</p>
      ) : (
        <div className={`rangee__cadre ${bords.fin ? "" : "rangee__cadre--suite"}`}>
          <div className="rangee__piste" ref={piste} onScroll={mesurer}>
            {children}
          </div>
        </div>
      )}
      {pied && nbCartes > 0 && <p className="rangee__pied">{pied}</p>}
    </section>
  );
}
