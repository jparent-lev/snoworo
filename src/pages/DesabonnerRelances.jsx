import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageLegale from "../components/PageLegale";
import { desabonnerRelances } from "../lib/relances";

// Page du lien « Ne plus recevoir ces rappels » (/courriels/desabonner?u=…&j=…).
// Un clic suffit, sans connexion (Loi canadienne anti-pourriel).
export default function DesabonnerRelances() {
  const [params] = useSearchParams();
  const u = params.get("u") ?? "";
  const j = params.get("j") ?? "";
  const [etat, setEtat] = useState(u && j ? "en_cours" : "invalide");

  useEffect(() => {
    if (!u || !j) return;
    let annule = false;
    desabonnerRelances(u, j)
      .then(() => !annule && setEtat("fait"))
      .catch(() => !annule && setEtat("invalide"));
    return () => {
      annule = true;
    };
  }, [u, j]);

  if (etat === "en_cours") {
    return (
      <PageLegale surtitre="Vos courriels" titre="Un instant">
        <p>Nous enregistrons votre choix…</p>
      </PageLegale>
    );
  }
  if (etat === "fait") {
    return (
      <PageLegale surtitre="Vos courriels" titre="C'est noté">
        <p>Vous ne recevrez plus de rappels pour compléter votre compte. Les avis liés à vos demandes, eux, continuent.</p>
        <p>
          Vous pouvez changer d'idée en tout temps dans vos <Link to="/parametres#courriels">paramètres</Link>.
        </p>
      </PageLegale>
    );
  }
  return (
    <PageLegale surtitre="Vos courriels" titre="Ce lien ne fonctionne pas">
      <p>
        Le lien est incomplet. Connectez-vous et désactivez les rappels dans vos{" "}
        <Link to="/parametres#courriels">paramètres</Link>.
      </p>
    </PageLegale>
  );
}
