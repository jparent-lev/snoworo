import { useEffect, useRef, useState } from "react";
import { URL_SITE, messagePartage } from "../../lib/partage";
import "./PartageListe.css";

async function copierTexte(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    // Repli pour les navigateurs sans API Clipboard (ou permission refusée).
    const zone = document.createElement("textarea");
    zone.value = texte;
    zone.setAttribute("readonly", "");
    zone.style.position = "fixed";
    zone.style.opacity = "0";
    document.body.appendChild(zone);
    zone.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(zone);
    return ok;
  }
}

// Invitation à partager Snowro, affichée juste après l'inscription à la liste
// d'attente. Partage simple : le même lien pour tout le monde, aucun suivi de
// qui a invité qui (décision produit, voir docs/architecture.md § Site
// vitrine). Le texte s'adapte au rôle et à la ville dérivée du code postal.
export default function PartageListe({ role, ville }) {
  const [copie, setCopie] = useState(null); // "message" | "lien" | null
  const minuterie = useRef(null);
  const message = messagePartage({ role, ville });
  const messageComplet = `${message} ${URL_SITE}`;
  const partageNatif = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => () => clearTimeout(minuterie.current), []);

  async function copier(quoi) {
    const ok = await copierTexte(quoi === "lien" ? URL_SITE : messageComplet);
    if (!ok) return;
    setCopie(quoi);
    clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => setCopie(null), 2200);
  }

  async function partager() {
    try {
      await navigator.share({ title: "Snowro", text: message, url: URL_SITE });
    } catch {
      // Annulé par la personne : rien à faire.
    }
  }

  const texteEncode = encodeURIComponent(messageComplet);
  const liens = [
    { nom: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(URL_SITE)}` },
    { nom: "WhatsApp", href: `https://wa.me/?text=${texteEncode}` },
    { nom: "Texto", href: `sms:?&body=${texteEncode}` },
    {
      nom: "Courriel",
      href: `mailto:?subject=${encodeURIComponent("Du déneigement entre voisins : Snowro")}&body=${texteEncode}`,
    },
  ];

  return (
    <div className="partage">
      <span className="partage__titre">Fais avancer {ville ? ville : "ton quartier"}</span>
      <p className="partage__texte">
        Plus il y a de voisins inscrits dans ton secteur, plus vite Snowro ouvre. Un message à tes contacts ou
        dans le groupe du quartier, ça fait toute la différence.
      </p>

      <blockquote className="partage__apercu">
        {message} <span className="partage__apercu-lien">{URL_SITE.replace("https://", "")}</span>
      </blockquote>

      <div className="partage__actions">
        {partageNatif && (
          <button type="button" className="partage__bouton partage__bouton--principal" onClick={partager}>
            Partager
          </button>
        )}
        <button
          type="button"
          className={`partage__bouton ${partageNatif ? "" : "partage__bouton--principal"}`}
          onClick={() => copier("message")}
        >
          {copie === "message" ? "Message copié ✓" : "Copier le message"}
        </button>
        <button type="button" className="partage__bouton" onClick={() => copier("lien")}>
          {copie === "lien" ? "Lien copié ✓" : "Copier le lien"}
        </button>
      </div>

      <div className="partage__liens">
        <span>Ou directement sur</span>
        {liens.map((l) => (
          <a key={l.nom} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
            {l.nom}
          </a>
        ))}
      </div>

      <span className="sr-only" aria-live="polite">
        {copie ? "Copié dans le presse-papiers." : ""}
      </span>
    </div>
  );
}
