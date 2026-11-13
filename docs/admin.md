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

# Liens de compte (functions/src/liensCompte.js)

- Mot de passe oublié : `/mot-de-passe-oublie` → courriel → `/mot-de-passe?code=…`.
- Connexion par lien : bouton sur `/connexion` → courriel → `/connexion/lien?mode=signIn&oobCode=…`.
- Confirmation du courriel : `functions/src/courrielConfirmation.js` → `/courriel/confirmer?code=…`.
- Prérequis console Firebase (chaque projet) : Authentication, Mode de connexion,
  « Adresse e-mail/Mot de passe », option « Lien envoyé par e-mail (connexion
  sans mot de passe) » activée ; snowro.com et test.snowro.com dans les
  domaines autorisés.
- Même réponse qu'un compte existe ou non ; rien n'est envoyé sans compte ; un
  lien par minute par adresse (`envoisCompte`, effacé après 24 h).

# Google Analytics dans /admin (functions/src/analyticsAdmin.js)

- `GA_PROPERTY_ID` (functions/.env.snowro-app) : identifiant numérique de la
  propriété GA4. Vide sur test.
- Accès : le compte de service des fonctions
  (`938452694811-compute@developer.gserviceaccount.com`, projet snowro-app) a le
  rôle « Lecteur » sur la propriété ; l'API « Google Analytics Data API » est
  activée dans le projet Google Cloud snowro-app.
- Rapports : visiteurs, nouveaux, sessions (7 et 30 jours), canaux, événements
  clés (entonnoir), visiteurs par jour. Seuls les visiteurs consentants sont
  comptés.
