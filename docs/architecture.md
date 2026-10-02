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
- Courriel de confirmation à la première inscription
  (`confirmerInscriptionListeAttente`, déclenché à la création du document),
  expédié depuis `allo@snowro.com`.
- Partage après l'inscription (`src/pages/landing/PartageListe.jsx`) :
  message prêt à partager adapté au rôle et à la ville, partage natif du
  téléphone, copie du message ou du lien, raccourcis Facebook, WhatsApp,
  texto et courriel. **Partage simple, sans suivi** : le même lien
  (`https://snowro.com`) pour tout le monde, on ne note pas qui a invité qui
  (décision produit ; ajouter un suivi demanderait une mise à jour de la
  politique de confidentialité). Aperçu des liens partagés : balises Open
  Graph et Twitter (`twitter:title`, `twitter:description`, `twitter:image`)
  dans `index.html`, image `public/og-snowro.png` (1200 x 630) ; icône
  `public/apple-touch-icon.png` (180 x 180, fond plein) pour iOS.

## Stack

| Couche | Choix |
|---|---|
| Frontend | React 19 (Vite), React Router |
| Hébergement frontend | Firebase Hosting (projet `snowro-app`), déployé par GitHub Actions avec le reste |
| Backend/DB/Auth | Firebase (Firestore + Auth + Cloud Functions v2) |
| Paiements Snowro X | Stripe Connect (comptes Express) — pas encore implémenté, voir ci-dessous |
| Paiements Snowro Pro | Stripe Billing (abonnement) — pas encore implémenté |
| Cartes / zones | Géolocalisation navigateur + geohash (`ngeohash`) pour le MVP ; Google Maps API à intégrer pour la carte visuelle |
| Courriels transactionnels | Resend, appelé directement depuis les Cloud Functions (`functions/src/courriels.js`) ; pas l'extension Trigger Email, le service Firebase Extensions fermant le 31 mars 2027 |
| Notifications | Twilio (SMS) + FCM, pas encore implémenté |

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
  "restreint") : un déneigeur dont le statut n'est pas "actif" ne peut pas
  accepter de demande (refus du serveur, en mode paiement réel).
- `demandes/{demandeId}.paiement` (remplace l'ancien `fraisMiseEnRelation`) :
  `{ montantTotal, fraisSnowro, montantDeneigeur, statutPaiement, stripePaymentIntentId, stripeChargeId, stripeTransferId, verseAt, erreurVersement }`.
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

**Construit** (`functions/src/paiements.js`, mode d'emploi : `docs/stripe.md`),
modèle « charges et virements séparés » plutôt que la destination charge
envisagée au départ : le prélèvement a lieu à l'acceptation, mais le virement
au déneigeur n'est fait qu'à la confirmation, ce qui garde l'argent chez
Snowro tant que la job n'est pas confirmée (et bloqué si elle est signalée).
- Publication : le client enregistre une carte (SetupIntent hors session,
  Payment Element de Stripe dans l'app). Rien n'est prélevé.
- Acceptation : prélèvement du montant offert sur cette carte
  (PaymentIntent hors session, `transfer_group` = demandeId). Carte refusée :
  la demande passe à `paiement_refuse`, le déneigeur est libéré et le client
  averti par courriel ; une nouvelle carte puis `relancerDemande` la remet en
  ligne.
- Confirmation (client ou automatique) : virement de `montantDeneigeur` au
  compte Express du déneigeur (Transfer avec `source_transaction`), clé
  d'idempotence par demande ; un échec reste `a_verser` et est réessayé par
  `confirmerJobsEchues` toutes les 15 minutes.
- Signalement : `bloque`, aucun virement ; remboursement à la main dans le
  tableau de bord Stripe.
- Déneigeur : compte Connect créé avec **Accounts v2** (exigé par Stripe pour
  une nouvelle intégration : configuration « recipient », tableau de bord
  Express, frais et pertes assumés par Snowro), inscription par
  `lienCompteDeneigeur`, statut mis à jour
  au retour (`synchroniserCompteDeneigeur`) et par le webhook
  `account.updated` (`webhookStripe`). Accepter une job exige
  `connectStatus == "actif"` (vérifié par le serveur ; le bouton est aussi
  désactivé dans l'app). Les demandes restent visibles : il voit ce qu'il
  pourrait prendre, ce qui l'incite à finir l'inscription.

Interrupteur : `PAIEMENT_REEL` (fonctions) et `VITE_STRIPE_CLE_PUBLIQUE`
(site). Sans eux, le paiement reste simulé (`simule_*`) avec le bandeau
« Période de test ».

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
- Un déneigeur enregistre son adresse de service dans Paramètres, envoyée à
  `mettreAJourAdresseUtilisateur` : soit choisie dans les suggestions
  d'adresses (`placeId`, même champ que pour une demande), soit écrite au
  complet (refusée sans numéro civique), soit par sa position navigateur
  (geohash).
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

## Tableaux de bord et cycle d'une job

Après connexion : `/tableau-de-bord` (`src/pages/tableau/`). Un seul compte,
deux modes (Client, Déneigeur) ; la bascule de l'en-tête n'apparaît qu'avec les
deux rôles, choisis à l'inscription (`users.role`). Chaque section est une
rangée défilante (`src/components/Rangee.jsx`) avec filtres par état et, pour
les demandes près de soi, un tri (distance, montant, urgence, récence).
Accepter une job passe par une fenêtre d'engagement : **aucune annulation
possible une fois acceptée**. Cycle complet et transitions :
`docs/data-model.md` § demandes.

Fin de job : « C'est fait » exige de 1 à 3 photos prises sur place (visibles du
client et du déneigeur seulement, effacées après 30 jours). En confirmant,
le client peut donner de 1 à 5 étoiles et un mot que seul le déneigeur lit ;
il peut aussi évaluer plus tard, pendant 7 jours. Pas d'avis publics.

Messagerie : une fois la job acceptée, le client et le déneigeur s'écrivent
depuis la carte de la job (« Écrire à Marc », pastille « Nouveau message »),
dans une fenêtre de conversation en temps réel (`Conversation.jsx`). L'autre
personne reçoit un avis par courriel, au plus une fois par 15 minutes. Écriture
fermée une fois la job confirmée ; la conversation reste lisible. Détails :
`docs/data-model.md` § messages.

Paiement **simulé** tant que Stripe Connect n'est pas branché (bandeau
« Période de test » dans les deux tableaux de bord).

## Ce qui reste à construire

Prochaines étapes, dans l'ordre convenu :

1. Passer les paiements en réel : compte Stripe, secrets, webhook, puis
   `PAIEMENT_REEL` et `VITE_STRIPE_CLE_PUBLIQUE` (voir `docs/stripe.md`) ;
   créer `config/frais` avec les montants définitifs.
2. Snowro Pro : abonnement Stripe Billing, tableau de bord `zonesStats`.
3. Snowro Pro : UI pour `creerOffreCiblee`.
4. Notifications SMS/push (Twilio + FCM) à l'ouverture d'une demande dans la
   ville d'un déneigeur (filtrer par `villeGeoId`, comme `ecouterDemandesOuvertes`).
5. Intégration Google Maps côté client (carte visuelle, autocomplétion
   d'adresse) — le géocodage inverse serveur pour `ville`/`villeGeoId` est fait.
