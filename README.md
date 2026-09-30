# Snowro

Plateforme québécoise de déneigement à la demande — Snowro X (particuliers) et
Snowro Pro (professionnels abonnés). Voir [`docs/architecture.md`](docs/architecture.md)
et [`docs/data-model.md`](docs/data-model.md) pour le contexte produit et technique.

## Démarrer

```bash
npm install
cp .env.example .env   # puis remplir avec la config d'un projet Firebase
npm run dev
```

Sans config Firebase valide dans `.env`, l'app démarre mais l'auth/Firestore
échoueront silencieusement — créer un projet Firebase (Auth + Firestore) et
copier sa config web dans `.env` pour tester le flux complet.

## Firebase (règles, index, functions)

**Déploiement automatique.** Chaque fusion dans `main` qui touche
`functions/`, `firestore.rules`, `firestore.indexes.json` ou `firebase.json`
déploie les fonctions, les règles et les index par GitHub Actions
(`.github/workflows/deployer-firebase.yml`). Le site, lui, est déployé par
Netlify. Lancement manuel possible : onglet Actions > « Déployer Firebase » >
Run workflow. Configuration unique, sans clé de compte de service : lancer
`scripts/configurer-deploiement-ci.sh` dans Cloud Shell, puis ajouter les deux
variables de dépôt GitHub qu'il affiche. Les secrets (ci-dessous) doivent
exister avant le déploiement, sinon il échoue.

Fonctions en Node.js 22 (`functions/package.json`, champ `engines`) : Node 20
est retiré par Google le 30 octobre 2026. Pas Node 24 : `onUserCreate` est une
fonction de 1re génération (déclencheur Auth, sans équivalent en 2e
génération) et la 1re génération s'arrête à Node 22. Node 22 est déprécié le
30 avril 2027 et retiré le 31 octobre 2027 : prévoir la suite d'ici là.

Déploiement à la main, si besoin :

```bash
npm install -g firebase-tools   # si pas déjà installé
firebase login
firebase use --add              # associer au projet Firebase

firebase deploy --only firestore:rules,firestore:indexes

# Requis avant de déployer functions/ : clé Geocoding API (voir
# docs/architecture.md § Intégrité du matching géographique)
firebase functions:secrets:set GOOGLE_GEOCODING_API_KEY
# Clé Resend (« Sending access », limitée au domaine snowro.com) pour les
# courriels transactionnels, voir functions/src/courriels.js
firebase functions:secrets:set RESEND_API_KEY

cd functions && npm install && cd ..
firebase deploy --only functions
```

Émulateurs locaux (Auth + Firestore + Functions) :

```bash
firebase emulators:start
```

## État actuel

- Auth (email/mot de passe) + création automatique de `users/{uid}` avec le
  squelette de consentements (Loi 25) dès l'inscription.
- Page Paramètres pour accorder/retirer chaque consentement individuellement,
  et pour qu'un déneigeur enregistre son adresse de service (géolocalisation
  → géocodage serveur → `ville`/`villeGeoId`, jamais saisis directement).
- Snowro X : publication de demande, liste filtrée par ville (exclusion dure)
  puis triée par distance, acceptation (premier arrivé, premier servi côté
  Firestore rules), état "déjà prise".
- Design system appliqué (tokens, symbole, verrouillage horizontal) — voir
  `src/styles/tokens.css` et `src/components/brand/`.
- Site vitrine de pré-lancement à la racine (`/`) : calculateur de frais,
  FAQ, liste d'attente (courriel + code postal → ville dérivée par
  géocodage). Voir `docs/architecture.md` § *Site vitrine*.

Pas encore implémenté : paiement Stripe Connect (onboarding, webhook,
PaymentIntent — voir `docs/architecture.md` § *Paiement*, priorité avant tout
lancement public), messagerie post-match, Snowro Pro (abonnement, tableau de
bord zones, offres ciblées), notifications SMS/push, intégration Google Maps.
Voir `docs/architecture.md` § *Ce qui reste à construire*.
