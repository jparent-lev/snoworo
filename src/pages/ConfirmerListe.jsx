import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageLegale from "../components/PageLegale";
import { confirmerListeAttente } from "../lib/listeAttente";

// Page du lien de confirmation de la liste d'attente
// (/liste/confirmer?c=…&j=…, envoyé par envoyerConfirmationListeAttente).
export default function ConfirmerListe() {
  const [params] = useSearchParams();
  const c = params.get("c") ?? "";
  const j = params.get("j") ?? "";
  const [etat, setEtat] = useState({ statut: "en_cours" });

  useEffect(() => {
    let annule = false;
    confirmerListeAttente({ c, j })
      .then(({ data }) => !annule && setEtat({ statut: "confirmee", ...data }))
      .catch((err) => !annule && setEtat({ statut: err?.message === "lien-expire" ? "expire" : "invalide" }));
    return () => {
      annule = true;
    };
  }, [c, j]);

  if (etat.statut === "en_cours") {
    return (
      <PageLegale surtitre="Liste d'attente" titre="Confirmation en cours">
        <p>Un instant…</p>
      </PageLegale>
    );
  }

  if (etat.statut === "confirmee") {
    return (
      <PageLegale surtitre="Liste d'attente" titre={etat.prenom ? `Merci ${etat.prenom}, c'est confirmé` : "C'est confirmé"}>
        <p>
          {etat.deja ? "Votre inscription était déjà confirmée. " : "Votre inscription est confirmée. "}
          Nous vous écrirons dès que Snowro sera offert {etat.ville ? `à ${etat.ville}` : "dans votre secteur"}. Aucun
          pourriel : uniquement cet avis.
        </p>
        <p>
          Connaissez-vous des voisins qui aimeraient faire déneiger ou donner un coup de pelle ? Partagez-leur
          snowro.com : plus nous sommes nombreux dans votre secteur, plus tôt nous ouvrirons.
        </p>
        <p>
          <Link to="/">Retour à l'accueil</Link>
        </p>
      </PageLegale>
    );
  }

  return (
    <PageLegale surtitre="Liste d'attente" titre={etat.statut === "expire" ? "Ce lien a expiré" : "Ce lien ne fonctionne pas"}>
      <p>
        {etat.statut === "expire"
          ? "Le lien de confirmation est valide 7 jours. "
          : "Le lien est incomplet ou a déjà été remplacé par un plus récent. "}
        Inscrivez-vous de nouveau sur l'accueil : nous vous enverrons un nouveau lien.
      </p>
      <p>
        <Link to="/#liste">Rejoindre la liste</Link>
      </p>
    </PageLegale>
  );
}
