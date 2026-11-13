# Tableau de bord admin (/admin)

- Page `src/pages/Admin.jsx`, données de la callable `metriquesAdmin`
  (`functions/src/tableauAdmin.js`) : chiffres agrégés seulement (comptes,
  rôles, déneigeurs prêts à être payés, liste d'attente, demandes par statut,
  taux et délais d'acceptation, argent, villes, séries de 30 jours en heure de
  Québec). Aucun nom, courriel, adresse ni identifiant n'est renvoyé.
- Accès : `ADMIN_UIDS` dans `functions/.env.snowro-app` et
  `functions/.env.snowro-test` (UID Firebase séparés par des virgules ; jamais
  de courriel, le dépôt est public). Revérifié à chaque appel.
- Au premier appel réussi, le compte reçoit la revendication `admin: true`,
  qui affiche le lien « Admin » dans l'en-tête.
- Trouver un UID : console Firebase, Authentication, Utilisateurs, colonne
  « UID de l'utilisateur ».
- Sources de trafic et conversions : Google Analytics (docs/mesure.md).
