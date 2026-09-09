# Architecture — Snowro

Voir aussi [`data-model.md`](./data-model.md) et le handoff design
(`design_handoff_snowro_brand/README.md`, fourni séparément) pour les tokens visuels.

## Stack

| Couche | Choix |
|---|---|
| Frontend | React 19 (Vite), React Router |
| Hébergement frontend | Netlify |
| Backend/DB/Auth | Firebase (Firestore + Auth + Cloud Functions v2) |
| Paiements Snowro X | Stripe standard (frais de mise en relation) — pas encore implémenté |
| Paiements Snowro Pro | Stripe Billing (abonnement) — pas encore implémenté |
| Cartes / zones | Géolocalisation navigateur + geohash (`ngeohash`) pour le MVP ; Google Maps API à intégrer pour la carte visuelle |
| Notifications | Twilio (SMS) + FCM — pas encore implémenté |

## Pourquoi pas de Stripe Connect en v1

Décision explicite : le paiement du service de déneigement reste hors plateforme
(Interac/comptant entre particuliers). Snowro ne facture que des frais de mise en
relation fixes via Stripe standard. Ne pas réintroduire Stripe Connect / un split
de paiement sans discussion — voir le handoff pour le contexte (expérience négative
sur un projet précédent, VouchGuard).

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

1. Frais de mise en relation (Stripe standard) au moment du match.
2. Messagerie in-app post-match (collection `messages`, déjà couverte par les
   Firestore rules mais pas d'UI).
3. Snowro Pro : abonnement Stripe Billing, tableau de bord `zonesStats`.
4. Snowro Pro : UI pour `creerOffreCiblee`.
5. Notifications SMS/push (Twilio + FCM) à l'ouverture d'une demande dans la
   ville d'un déneigeur (filtrer par `villeGeoId`, comme `ecouterDemandesOuvertes`).
6. Intégration Google Maps côté client (carte visuelle, autocomplétion
   d'adresse) — le géocodage inverse serveur pour `ville`/`villeGeoId` est fait.
