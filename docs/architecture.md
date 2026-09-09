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
  `postalCodePrefix`/semaine dans `zonesStats`, sans référence à un `userId` ou
  `demandeId` (anonymisation à la source, voir Loi 25 ci-dessous).

## Conformité — Loi 25

Le consentement se stocke par type de traitement (`zonesAgregees`,
`offresCiblees`, `notificationsSMS`), jamais comme un flag global. Chaque entrée
porte `granted`, `grantedAt`, `version` (version du texte consenti — voir
`functions/src/consentVersions.js`). Le retrait (`revokeConsent`) est aussi
simple que l'octroi.

## Géolocalisation (MVP)

Pas encore d'intégration Google Maps. Pour le MVP :
- Le donneur d'ouvrage publie avec sa position navigateur (`navigator.geolocation`),
  encodée en geohash (`adresseGeohash`).
- Le déneigeur voit la liste des demandes triée par distance, calculée
  côté client (Haversine) entre sa position et le geohash décodé de chaque demande.
- `quartier` est saisi librement par le donneur d'ouvrage (pas de reverse
  geocoding pour l'instant) — à remplacer par Google Maps Geocoding quand la
  clé API sera intégrée (`VITE_GOOGLE_MAPS_API_KEY`).

## Ce qui reste à construire

Voir l'ordre de construction du handoff. Après ce scaffold (auth + modèle de
données + Snowro X minimal — publication, liste, match) :

1. Frais de mise en relation (Stripe standard) au moment du match.
2. Messagerie in-app post-match (collection `messages`, déjà couverte par les
   Firestore rules mais pas d'UI).
3. Snowro Pro : abonnement Stripe Billing, tableau de bord `zonesStats`.
4. Snowro Pro : UI pour `creerOffreCiblee`.
5. Notifications SMS/push (Twilio + FCM) à l'ouverture d'une demande dans le
   rayon d'un déneigeur.
6. Intégration Google Maps (carte, geocoding, rayons de zone).
