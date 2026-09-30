import { useState } from "react";

// Un seul compte, deux modes : Client (donneur_ouvrage) et Déneigeur
// (deneigeur_x). Le mode choisi est mémorisé sur l'appareil ; la bascule
// n'apparaît que si la personne a les deux rôles.
export const ROLE_CLIENT = "donneur_ouvrage";
export const ROLE_DENEIGEUR = "deneigeur_x";

const cle = (uid) => `snowro-mode-${uid}`;

function lireMemoire(uid) {
  try {
    return localStorage.getItem(cle(uid));
  } catch {
    return null;
  }
}

export function useMode(uid, roles = []) {
  const aClient = roles.includes(ROLE_CLIENT);
  const aDeneigeur = roles.includes(ROLE_DENEIGEUR);
  const parDefaut = aDeneigeur && !aClient ? "deneigeur" : "client";
  // Choix faits pendant la session, par compte ; sinon, le choix mémorisé.
  const [choixSession, setChoixSession] = useState({});
  const choisi = uid ? (choixSession[uid] ?? lireMemoire(uid)) : null;

  // Un mode mémorisé qui ne correspond plus à un rôle (rôle retiré) est ignoré.
  const valide = (m) => (m === "deneigeur" && aDeneigeur) || (m === "client" && (aClient || !aDeneigeur));
  const mode = valide(choisi) ? choisi : parDefaut;

  function changerMode(m) {
    setChoixSession((prec) => ({ ...prec, [uid]: m }));
    try {
      localStorage.setItem(cle(uid), m);
    } catch {
      // Stockage indisponible (navigation privée) : le choix vaut pour la session.
    }
  }

  return { mode, changerMode, deuxRoles: aClient && aDeneigeur };
}
