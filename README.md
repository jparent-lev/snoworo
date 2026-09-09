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

```bash
npm install -g firebase-tools   # si pas déjà installé
firebase login
firebase use --add              # associer au projet Firebase

firebase deploy --only firestore:rules,firestore:indexes

# Requis avant de déployer functions/ : clé Geocoding API (voir
# docs/architecture.md § Intégrité du matching géographique)
firebase functions:secrets:set GOOGLE_GEOCODING_API_KEY

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

Pas encore implémenté : frais de mise en relation (Stripe), messagerie
post-match, Snowro Pro (abonnement, tableau de bord zones, offres ciblées),
notifications SMS/push, intégration Google Maps. Voir
`docs/architecture.md` § *Ce qui reste à construire*.
