// Pastille d'état, la même partout dans les paramètres : ✓ vert quand c'est
// en place, ○ neutre sinon (ton : ok | neutre | attente | alerte).
export default function Pastille({ ton, children }) {
  const icone = { ok: "✓", attente: "…", alerte: "!", neutre: "○" }[ton];
  return (
    <span className={`statut-connect statut-connect--${ton}`}>
      <span className="statut-connect__icone" aria-hidden="true">
        {icone}
      </span>
      {children}
    </span>
  );
}
