// Message d'une erreur de Cloud Function (callable), sans le suffixe de
// statut HTTP que le SDK Firebase ajoute (« deja-prise [409] » devient
// « deja-prise »). Les comparaisons avec les clés renvoyées par le serveur
// et les messages affichés passent par ici.
export function messageServeur(err) {
  return String(err?.message ?? "").replace(/\s*\[\d{3}\]$/, "");
}
