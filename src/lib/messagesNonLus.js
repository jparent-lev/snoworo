import { useEffect, useState } from "react";
import { ecouterMesDemandes, ecouterMesJobs } from "./demandes";
import { aNouveauMessage, ecouterLectures } from "./messagerie";
import { ROLE_CLIENT, ROLE_DENEIGEUR } from "./mode";

// Conversations avec un message non lu, pour le menu de profil de l'en-tête :
// [{ id, prenom, titre, mode, lien }]. Mêmes données que les tableaux de bord
// (demandes du client, demandes acceptées par le déneigeur, dernières lectures).
export function useMessagesNonLus(uid, roles = []) {
  const client = roles.includes(ROLE_CLIENT);
  const deneigeur = roles.includes(ROLE_DENEIGEUR);
  const [demandes, setDemandes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [lectures, setLectures] = useState({});

  useEffect(() => (uid && client ? ecouterMesDemandes(uid, (l) => setDemandes(l ?? [])) : undefined), [uid, client]);
  useEffect(() => (uid && deneigeur ? ecouterMesJobs(uid, (l) => setJobs(l ?? [])) : undefined), [uid, deneigeur]);
  useEffect(() => (uid ? ecouterLectures(uid, setLectures) : undefined), [uid]);

  const versItem = (d, mode, prenom) => ({
    id: d.id,
    prenom: prenom || (mode === "client" ? "Votre déneigeur" : "Votre client"),
    titre: d.titre ?? "",
    mode,
    lien: `/tableau-de-bord?mode=${mode}&conversation=${encodeURIComponent(d.id)}`,
  });
  return [
    ...(client ? demandes : []).filter((d) => aNouveauMessage(d, uid, lectures)).map((d) => versItem(d, "client", d.deneigeurPrenom)),
    ...(deneigeur ? jobs : []).filter((j) => aNouveauMessage(j, uid, lectures)).map((j) => versItem(j, "deneigeur", j.donneurPrenom)),
  ];
}
