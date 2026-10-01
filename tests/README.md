# Tests (émulateurs Firebase)

Rien ici ne touche la production : tout tourne contre les émulateurs, projet
`demo-snowro`. Java 11+ requis pour l'émulateur Firestore.

```bash
cd functions && npm install && cd ..
cd tests && npm install

# 1. Cycle de vie des demandes (Cloud Functions) + Firestore rules
npm test

# 2. Parcours complet dans Chromium (Playwright ; CHROMIUM_PATH=… pour un
#    Chromium déjà installé, sinon `npx playwright install chromium`)
#    L'app doit être construite pour les émulateurs :
cd .. && VITE_UTILISER_EMULATEURS=1 VITE_FIREBASE_PROJECT_ID=demo-snowro \
  VITE_FIREBASE_API_KEY=cle-emulateur VITE_FIREBASE_APP_ID=1:1:web:1 npm run build && cd tests
printf 'GOOGLE_GEOCODING_API_KEY=factice\nRESEND_API_KEY=factice\n' > ../functions/.secret.local
npm run e2e
```

- `cycle.test.mjs` : publier, accepter (premier arrivé, exclusion dure par
  ville), marquer faite, confirmer, confirmation automatique après 12 h,
  signaler, annuler (seulement si ouverte), augmenter l'offre ; puis les
  rules (fiche lisible par son propriétaire seulement, note non modifiable,
  aucune écriture client sur les demandes, adresse privée, messages :
  participants seulement, pendant la job, heure du serveur, 1000 caractères
  max) et l'avis par courriel d'un nouveau message (une fois par 15 min).
  Aussi : photo « c'est fait » (JPEG seulement, taille, effacement après
  30 jours sauf job signalée) et évaluation (en confirmant ou dans les 7 jours,
  une seule fois, moyenne recalculée).
  Le géocodage Google est simulé.
- `parcours.e2e.mjs` : trois comptes (déneigeur, cliente, deux rôles) dans
  un vrai navigateur, captures d'écran dans un dossier temporaire.

Derrière un proxy d'entreprise, lancer les émulateurs sans variables
`HTTP(S)_PROXY` (les appels vers localhost ne doivent pas y passer).
