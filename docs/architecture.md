# Architecture — Snowro

Voir aussi [`data-model.md`](./data-model.md) et les handoffs design fournis
séparément : `design_handoff_snowro_brand/README.md` (symbole, tokens de base)
et `design_handoff_snowro_site/README.md` (site vitrine de pré-lancement —
audit de contraste qui a retiré `#8A7361`/`#A08E7A` comme couleurs de texte
dans toute l'app, voir `src/styles/tokens.css`).

## Site vitrine de pré-lancement (`/`)

La racine du site est une page unique à ancres (`src/pages/Landing.jsx` +
`src/pages/landing/*`) dont l'unique objectif est la collecte de liste
d'attente (courriel + code postal + rôle) — **pas** un point d'entrée vers
l'app fonctionnelle (`/connexion`, `/inscription` restent accessibles
directement, mais ne sont plus liées depuis la page publique). Copie et
structure figées par `design_handoff_snowro_site`.

- Calculateur de frais interactif : lit `config/frais` (lecture publique) en
  temps réel, aucune valeur codée en dur — voir `src/lib/config.js`.
- Inscription à la liste : `rejoindreListeAttente` (callable publique, sans
  authentification), qui valide et géocode le code postal avant d'écrire dans
  `listeAttente/{courriel}` — voir `data-model.md`.

## Stack

| Couche | Choix |
|---|---|
| Frontend | React 19 (Vite), React Router |
| Hébergement frontend | Netlify |
| Backend/DB/Auth | Firebase (Firestore + Auth + Cloud Functions v2) |
| Paiements Snowro X | Stripe Connect (comptes Express) — pas encore implémenté, voir ci-dessous |
| Paiements Snowro Pro | Stripe Billing (abonnement) — pas encore implémenté |
| Cartes / zones | Géolocalisation navigateur + geohash (`ngeohash`) pour le MVP ; Google Maps API à intégrer pour la carte visuelle |
| Notifications | Twilio (SMS) + FCM — pas encore implémenté |

## Paiement — Stripe Connect (décision révisée)

**⚠️ Cette décision annule et remplace la précédente.** La v1 du handoff excluait
explicitement Stripe Connect (le paiement du service restait hors plateforme,
Snowro ne facturant qu'un frais de mise en relation fixe). Ce n'est plus le cas
— voir `snowro-changements-claude-code.md` § 1 pour la décision complète.

**Modèle actuel** : Snowro encaisse le paiement complet du contrat par carte
(donneur d'ouvrage) et le redistribue au déneigeur via **Stripe Connect
(comptes Express)**, moins la commission de Snowro. Raison du changement : un
frais d'affichage seul n'était pas un argument assez fort contre les groupes
Facebook de quartier — sécuriser toute la transaction (protection en cas de
no-show, reçu automatique) l'est davantage.

Implications :
- Un déneigeur doit compléter l'onboarding Stripe Connect Express avant de
  pouvoir accepter une demande — vérification d'identité gérée par Stripe.
- `users/{userId}.connectStatus` ("non_demarre" | "en_attente" | "actif" |
  "restreint") — un déneigeur dont le statut n'est pas "actif" ne doit
  **jamais** apparaître dans les résultats de matching (exclusion dure, pas un
  badge UI). **Pas encore appliqué** : voir le TODO dans `firestore.rules` et
  `src/lib/demandes.js` — l'onboarding Connect doit exister avant d'activer ce
  filtre, sinon plus aucun déneigeur ne peut rien voir.
- `demandes/{demandeId}.paiement` (remplace l'ancien `fraisMiseEnRelation`) :
  `{ montantTotal, fraisSnowro, montantDeneigeur, statutPaiement, stripePaymentIntentId, stripeTransferId }`.
- Structure de frais **fixe + %** (remplace l'ancien frais fixe unique), lue
  depuis `config/frais` (`fraisFixe`, `fraisPct`) — jamais codée en dur, pour
  pouvoir l'ajuster sans redéploiement. Montants exacts non finalisés (voir le
  classeur financier) : ne jamais afficher un montant précis dans le code ou la
  copie tant que ce n'est pas confirmé.
- Frais Stripe standard (2,9 % + 0,30 $) s'appliquent maintenant sur le montant
  **total du contrat**, pas seulement sur la commission Snowro — impact direct
  sur la marge.
- `connectStatus` n'est modifiable que par une Cloud Function qui reçoit la
  confirmation Stripe (webhook), jamais en écriture directe côté client — voir
  `champsProteges()` dans `firestore.rules`.

**Pas encore construit** : onboarding Connect (génération du lien
d'inscription Express, page de retour), webhook Stripe (`account.updated` →
`connectStatus`), création du PaymentIntent au moment du match (destination
charge vers le compte Connect du déneigeur, `application_fee_amount` = frais
calculé), document `config/frais`. Nécessite une clé secrète Stripe (comme
`GOOGLE_GEOCODING_API_KEY`, à stocker via `firebase functions:secrets:set`).

## Cloud Functions (`functions/`)

- `onUserCreate` (trigger Auth) — crée `users/{uid}` avec le squelette `consents`
  déjà en place (tout refusé par défaut). Le consentement existe donc dès la
  création du compte, avant toute fonctionnalité Pro.
- `grantConsent` / `revokeConsent` (callable) — seul point d'écriture sur
  `users/{uid}.consents`. Les Firestore rules bloquent toute écriture directe
  côté client sur ce champ.
- `creerOffreCiblee` (callable) — valide `consents.offresCiblees.granted` côté
  serveur AVANT d'écrire dans `offresCiblees` (jamais côté client).
- `regenererZonesStats` (scheduled, hebdomadaire) — agrège `demandes` par
  `postalCodePrefix` ET par `villeGeoId`/semaine (`zonesStats` / `zonesStatsParVille`),
  sans référence à un `userId` ou `demandeId` (anonymisation à la source, voir Loi 25).
- `mettreAJourAdresseUtilisateur` (callable) — seul point d'écriture pour
  l'adresse de service, `ville` et `villeGeoId` d'un déneigeur. Voir
  "Intégrité du matching géographique" ci-dessous.
- `calculerVilleDemande` (trigger Firestore, `onDocumentCreated`) — calcule
  `ville`/`villeGeoId` d'une demande juste après sa création.

## Conformité — Loi 25

Le consentement se stocke par type de traitement (`zonesAgregees`,
`offresCiblees`, `notificationsSMS`), jamais comme un flag global. Chaque entrée
porte `granted`, `grantedAt`, `version` (version du texte consenti — voir
`functions/src/consentVersions.js`). Le retrait (`revokeConsent`) est aussi
simple que l'octroi.

## Géolocalisation (MVP)

Pas encore de carte visuelle Google Maps. Pour le MVP :
- Le donneur d'ouvrage publie avec sa position navigateur (`navigator.geolocation`),
  encodée en geohash (`adresseGeohash`).
- Un déneigeur enregistre son adresse de service (Paramètres → "Utiliser ma
  position") — même mécanisme de géolocalisation navigateur, encodé en geohash,
  envoyé à `mettreAJourAdresseUtilisateur`.
- `quartier` (sur une demande) est saisi librement par le donneur d'ouvrage —
  purement cosmétique, jamais utilisé pour une décision de matching.
- `ville`/`villeGeoId` sont dérivés côté serveur par géocodage inverse Google
  (Geocoding API) — voir section suivante.

## Intégrité du matching géographique

Il n'y a aucune sélection de ville par l'utilisateur, nulle part. La ville est
un attribut **dérivé automatiquement** du géocodage de l'adresse (donneur ou
déneigeur) — de nouvelles villes apparaissent naturellement dans le système
sans activation manuelle. Ça simplifie l'onboarding, mais déplace toute la
responsabilité vers l'intégrité du matching :

- Un déneigeur ne doit **jamais** être mis en relation avec une demande hors
  de sa ville de service, même si la distance à vol d'oiseau semble raisonnable
  (ex. Québec/Lévis, séparées par le fleuve mais proches en ligne droite).
- `villeGeoId` (place_id Google du composant `locality`) sert aux comparaisons
  de matching — jamais `ville` (chaîne de caractères libre : accents,
  majuscules, "Québec" vs "Ville de Québec" sont des pièges classiques).
- Toute requête qui liste des demandes pour un déneigeur **filtre** sur
  `villeGeoId` en premier (exclusion dure, jamais optionnelle), et ne trie par
  proximité (geohash) qu'à l'intérieur de ce sous-ensemble. Voir
  `src/lib/demandes.js` (`ecouterDemandesOuvertes`) et `src/pages/DemandesX.jsx`.
- `ville`/`villeGeoId` sont calculés côté serveur uniquement (Cloud Functions
  `mettreAJourAdresseUtilisateur` et `calculerVilleDemande`, via
  `functions/src/geocoding.js`) et bloqués en écriture directe côté client
  (`champsProteges()` / `champsProtegesDemande()` dans `firestore.rules`) —
  même principe que `consents` : une donnée qui détermine un comportement de
  sécurité/matching ne doit pas être manipulable par le client.
- Un géocodage qui échoue à trouver une localité ne produit **jamais** un
  résultat partiel ou approximatif : la demande/le profil reste sans
  `villeGeoId`, donc invisible au matching, plutôt que mal classé.
- **Cas limite documenté, pas résolu** : les zones limitrophes (municipalités
  collées) soulèveront éventuellement des demandes légitimes de matching
  inter-villes. Le filtre strict par ville reste la bonne valeur par défaut
  tant que le volume ne justifie pas une zone de service personnalisée par
  déneigeur — ne pas complexifier avant que ce soit un vrai problème observé.

### Configuration requise

`GOOGLE_GEOCODING_API_KEY` — secret Cloud Functions (Secret Manager), distinct
de `VITE_GOOGLE_MAPS_API_KEY` (client). Nécessite l'activation de la
**Geocoding API** dans Google Cloud Console pour le projet Firebase. À définir avec :

```bash
firebase functions:secrets:set GOOGLE_GEOCODING_API_KEY
```

## Ce qui reste à construire

Voir l'ordre de construction du handoff. Après ce scaffold (auth + modèle de
données + Snowro X minimal — publication, liste, match) :

1. Paiement Stripe Connect complet : onboarding Express, webhook, PaymentIntent
   au moment du match, `config/frais`, filtre `connectStatus == 'actif'`
   (voir § Paiement ci-dessus — priorité avant tout lancement public).
2. Messagerie in-app post-match (collection `messages`, déjà couverte par les
   Firestore rules mais pas d'UI).
3. Snowro Pro : abonnement Stripe Billing, tableau de bord `zonesStats`.
4. Snowro Pro : UI pour `creerOffreCiblee`.
5. Notifications SMS/push (Twilio + FCM) à l'ouverture d'une demande dans la
   ville d'un déneigeur (filtrer par `villeGeoId`, comme `ecouterDemandesOuvertes`).
6. Intégration Google Maps côté client (carte visuelle, autocomplétion
   d'adresse) — le géocodage inverse serveur pour `ville`/`villeGeoId` est fait.
