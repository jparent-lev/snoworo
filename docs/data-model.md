# Modèle de données Firestore

## `users/{userId}`

Lisible **par son propriétaire seulement** (courriel, téléphone : Loi 25). Ce que
les autres doivent voir (prénom, note) est recopié dans la demande. `role`
est choisi à l'inscription et modifiable dans Paramètres ; `ratingAvg`,
`ratingCount` et `nbJobsCompletees` ne sont écrits que par les Cloud Functions.


```
role: ["donneur_ouvrage" | "deneigeur_x" | "deneigeur_pro"]
displayName, phone, email
addressGeohash, postalCodePrefix
ville, villeGeoId            // 🔒 dérivés par géocodage serveur, voir plus bas
ratingAvg, ratingCount
createdAt

proSubscription: { stripeCustomerId, status, plan, currentPeriodEnd } | null

stripeConnectAccountId: string | null   // 🔒 compte Stripe Connect Express du déneigeur
stripeCustomerId: string | null         // 🔒 client Stripe (carte du client)
carte: { paymentMethodId, marque, derniers4, expMois, expAnnee } | null   // 🔒 écrit par enregistrerCarte
carteMiseAJourAt                        // 🔒
connectStatus: "non_demarre" | "en_attente" | "actif" | "restreint"   // 🔒 voir plus bas

consents: {                 // 🔒 écrit uniquement via grantConsent/revokeConsent
  zonesAgregees:    { granted, grantedAt, version, revokedAt? },
  offresCiblees:    { granted, grantedAt, version, revokedAt? },
  notificationsSMS: { granted, grantedAt, version, revokedAt? },
}
```

Créé par `onUserCreate` (trigger Auth) — jamais par le client directement, pour
garantir que `consents` existe toujours avec sa forme complète (`ville`/`villeGeoId`
sont initialisés à `null` dès la création, remplis plus tard quand le déneigeur
enregistre son adresse de service).

### `ville` / `villeGeoId` — intégrité du matching géographique

Un déneigeur n'a **aucun** sélecteur de ville : `ville` (texte d'affichage,
ex. "Québec") et `villeGeoId` (place_id Google Maps du composant `locality`,
identifiant stable pour les comparaisons — jamais de comparaison de chaînes)
sont dérivés par géocodage inverse du `addressGeohash`, via la Cloud Function
callable `mettreAJourAdresseUtilisateur` (`functions/src/adresse.js`).
Ces deux champs sont dans `champsProteges()` (`firestore.rules`) : écriture
directe côté client bloquée, au même titre que `consents`. Un géocodage qui ne
trouve pas de localité fait échouer l'appel plutôt que d'écrire une ville
incertaine (voir `functions/src/geocoding.js`).

### `stripeConnectAccountId` / `connectStatus` — paiement Stripe Connect

Voir `docs/architecture.md` § Paiement pour la décision complète
(`snowro-changements-claude-code.md` § 1). `connectStatus` vaut `"non_demarre"`
à la création du compte, et n'est ensuite modifié que par une Cloud Function
recevant la confirmation Stripe (webhook `account.updated`) — jamais par le
client, même titre que `consents`/`ville`. Un déneigeur dont `connectStatus`
n'est pas `"actif"` ne peut accepter aucune demande (vérifié par
`accepterDemande` quand le paiement est réel).

## `demandes/{demandeId}`

Écrit **uniquement** par les Cloud Functions du cycle de vie
(`functions/src/cycleDemande.js`) ; les Firestore rules refusent toute
écriture client. Lisible par tout utilisateur connecté (nécessaire au
matching) : ne contient donc ni l'adresse exacte ni de coordonnées précises.

```
donneurOuvrageId, donneurPrenom
statut: "ouverte" | "matchee" | "faite" | "completee" | "signalee" | "annulee" | "paiement_refuse"
adresseGeohash          // 7 caractères (~150 m) : distance affichée, jamais l'adresse
postalCodePrefix, quartier, ville, villeGeoId   // dérivés du géocodage de l'adresse
titre, description, typeService, outilsFournis
dateHeureSouhaitee, remunerationOfferte, createdAt

deneigeurId, deneigeurPrenom, deneigeurNote: { moyenne, nombre }, matchedAt
faiteAt, confirmationAutoAt     // confirmationAutoAt = faiteAt + 12 h
confirmeeAt, confirmationAuto   // true si confirmée par confirmerJobsEchues
annuleeAt                       // seulement depuis « ouverte »
signalement: { par: "client" | "deneigeur", motif, details, statutPrecedent, at } | null
dernierMessage: { at, par } | null   // recopié par notifierNouveauMessage
paiementRefuse: { at, raison } | null   // carte refusée à l'acceptation (paiement réel)
paiement: { montantTotal, fraisSnowro, montantDeneigeur, statutPaiement,
            stripePaymentIntentId, stripeChargeId, stripeTransferId, verseAt, erreurVersement }
// statutPaiement simulé : simule_retenu | simule_verse | simule_bloque
// statutPaiement réel   : prelevement_en_cours | retenu | a_verser | verse | bloque
photo, nbPhotos, photoExpireAt   // photos « c'est fait » (1 à 3, obligatoires) dans prive/photo-0…, effacées à photoExpireAt
evaluee                 // true une fois le déneigeur évalué (note dans prive/evaluation)

paiement: {              // posé à l'acceptation ; SIMULÉ tant que Stripe n'est pas branché
  montantTotal, fraisSnowro, montantDeneigeur,   // config/frais : fraisFixe + fraisPct %
  statutPaiement: "simule_retenu" | "simule_verse" | "simule_bloque"
                  // (Stripe : "en_attente" | "paye" | "echoue" | "rembourse")
  stripePaymentIntentId, stripeTransferId        // null en simulation
} | null
```

Transitions (toutes dans des transactions) :

| De | Vers | Qui | Fonction |
|---|---|---|---|
| (rien) | ouverte | client | `publierDemande` (géocode l'adresse) |
| ouverte | matchee | déneigeur de la même ville, premier arrivé | `accepterDemande` |
| ouverte | annulee | client | `annulerDemande` |
| ouverte | ouverte (offre plus haute) | client | `augmenterOffre` |
| matchee | faite | déneigeur choisi | `marquerFaite` |
| faite | completee | client, ou automatiquement après 12 h | `confirmerJob`, `confirmerJobsEchues` (toutes les 15 min) |
| matchee, faite | signalee | client ou déneigeur choisi | `signalerProbleme` |

**Pas d'annulation une fois acceptée**, ni par le client ni par le
déneigeur (décision produit) : le seul recours est de signaler un problème.

### `demandes/{demandeId}/prive/adresse`

```
adresse, geohash        // adresse saisie et geohash pleine précision
```

Lisible seulement par le client et, après acceptation, par le déneigeur
choisi. Jamais écrit côté client.

`paiement` remplace l'ancien `fraisMiseEnRelation` (frais de mise en relation
fixe, modèle abandonné — voir `docs/architecture.md` § Paiement). Renommé pour
éviter toute confusion entre les deux modèles.

`donneurPrenom`, `quartier`, `titre`, `description` sont des ajouts au schéma du
handoff d'origine, nécessaires pour reproduire l'écran X (carte de demande) tel
que livré par le design sans faire de jointure supplémentaire par carte.

`ville`/`villeGeoId` sont absents à la création (écriture client bloquée par
`champsProtegesDemande()`) et posés quelques instants plus tard par le trigger
`calculerVilleDemande` (`functions/src/demandeVille.js`). Tant qu'ils ne sont pas
posés, la demande n'apparaît dans la requête d'aucun déneigeur — voir
"Index composites" plus bas et l'addendum "intégrité du matching géographique" :
un filtre de ville absent ou incertain ne doit jamais être traité comme "assez proche".

## `zonesStats/{postalCodePrefix}_{semaineISO}` / `zonesStatsParVille/{villeGeoId}_{semaineISO}`

Régénérés ensemble par `regenererZonesStats` (Cloud Function planifiée, hebdomadaire) —
même agrégation, une fois par préfixe postal, une fois par ville.

```
// zonesStats
postalCodePrefix, semaineDebut
nbDemandesOuvertes, nbDemandesCompletees, remunerationMoyenne

// zonesStatsParVille
villeGeoId, ville, semaineDebut
nbDemandesOuvertes, nbDemandesCompletees, remunerationMoyenne
```

Aucune référence à un `userId` ou `demandeId` dans les deux cas.

## `config/frais`

```
fraisFixe: number   // en $, ex. 2 — valeurs non finalisées, voir le classeur financier
fraisPct: number     // points de pourcentage, ex. 8 pour 8 % (pas 0.08)
```

Document unique. **Lecture publique** (`allow read: if true`) — ce ne sont pas
des données sensibles, et le calculateur de frais du site vitrine
(`src/pages/landing/FeeCalculator.jsx`) doit afficher exactement les mêmes
chiffres que l'app, voir `design_handoff_snowro_site/README.md` § Frais.
Écriture jamais côté client (`allow write: if false`) — ajusté uniquement par
la future Cloud Function de paiement ou la console Firebase, voir
`docs/architecture.md` § Paiement. **Pas encore créé** : tant que le document
n'existe pas, `src/lib/config.js` sert des valeurs de secours (`fraisFixe: 2,
fraisPct: 8`, identiques aux valeurs par défaut de la maquette).

## `listeAttente/{courriel}`

```
courriel, codePostal, role: "client" | "deneigeur"
ville, villeGeoId       // dérivés par géocodage serveur du codePostal
createdAt
confirmation: {         // écrit par confirmerInscriptionListeAttente
  statut: "envoyee" | "echec",
  resendId: string | null,
  envoyeeAt: timestamp | null,
  erreur: string | null
}
```

Le courriel de confirmation part à la **création** du document seulement
(`functions/src/confirmationListeAttente.js`, envoi par Resend via
`functions/src/courriels.js`) : une réinscription ne renvoie rien. Un envoi
en échec n'annule jamais l'inscription ; les documents avec
`confirmation.statut == "echec"` sont à relancer à la main.

Site vitrine de pré-lancement (`design_handoff_snowro_site`) — collecte
d'inscriptions à la liste d'attente. Le document est identifié par le
courriel normalisé (une réinscription met à jour l'entrée plutôt que d'en
créer une deuxième). Écrit uniquement par la Cloud Function callable
publique `rejoindreListeAttente` (`functions/src/listeAttente.js`), qui
valide le format du courriel/code postal, filtre les soumissions de bots
(honeypot) et géocode le code postal — jamais lu ni écrit directement par le
client (`allow read, write: if false`).

## `messagesContact/{messageId}`

```
nom | null, courriel, sujet: "question" | "deneigeur" | "pro" | "renseignements" | "autre"
message                 // 5000 caractères max
userId | null           // rempli seulement si la personne était connectée
traite: boolean         // à basculer à la main une fois répondu
createdAt
```

Formulaire « Nous écrire » du site vitrine (`src/pages/NousEcrire.jsx`).
Écrit uniquement par la Cloud Function callable publique
`envoyerMessageContact` (`functions/src/contact.js`) — même principe que
`listeAttente` : validation et honeypot côté serveur, jamais lu ni écrit
directement par le client (`allow read, write: if false`). Aucun courriel
n'est envoyé : les messages se consultent dans la console Firebase.
Conservation annoncée dans la politique de confidentialité : 24 mois après le
dernier échange.

## `offresCiblees/{offreId}`

```
deneigeurProId, utilisateurCibleId
message, remunerationProposee, statut, createdAt
```

Créé uniquement via `creerOffreCiblee` (valide `consents.offresCiblees.granted`
avant l'écriture).

### Sous-collection `prive` (client et déneigeur choisi seulement)

- `adresse` : `{ adresse, geohash }`, écrite par `publierDemande`.
- `photo-0`, `photo-1`, `photo-2` : `{ donnees, ajouteeAt, expireAt }`, de 1 à
  3 photos **obligatoires** envoyées avec `marquerFaite` (anciennes jobs : un
  seul document `photo`). L'app la réduit (1280 px) et la réencode en JPEG, ce qui
  retire les métadonnées EXIF dont la position GPS ; le serveur n'accepte qu'un
  JPEG de 700 000 caractères au plus (en base64, loin de la limite de 1 Mio
  d'un document). `purgerPhotos` (tous les jours) l'efface 30 jours après la
  job, sauf tant que la job est `signalee`.
- `evaluation` : `{ note, commentaire, at }`, 1 à 5 étoiles et un mot
  facultatif (500 caractères) lu par le déneigeur seulement. Donnée par le
  client en confirmant (`confirmerJob`) ou après coup (`evaluerJob`, une seule
  fois, dans les 7 jours suivant la confirmation, utile après une confirmation
  automatique). `ratingAvg`/`ratingCount` du déneigeur sont recalculés dans la
  même transaction.
- `avis` : heure du dernier courriel « nouveau message » par destinataire.

## `messages/{conversationId}/messages/{messageId}`

```
expediteurId            // == request.auth.uid
contenu                 // 1 à 1000 caractères, pas seulement des espaces
createdAt               // heure du serveur (request.time), obligatoire
```

`conversationId == demandeId`. Écrit directement par l'app, mais seulement par
les deux personnes du match, et seulement pendant la job (`matchee`, `faite`,
`signalee`) ; lisible par elles deux aussi après `completee` (voir
`firestore.rules`). Ni modification ni suppression. Les coordonnées réelles ne
sont jamais insérées automatiquement dans `contenu`.

`notifierNouveauMessage` (`functions/src/messagerie.js`, déclenché à chaque
message) :
- recopie `dernierMessage: { at, par }` dans la demande, pour l'indicateur
  « Nouveau message » des tableaux de bord ;
- avertit l'autre personne par courriel (Resend), au plus une fois par
  15 minutes et par conversation ; l'heure du dernier avis par destinataire
  est dans `demandes/{id}/prive/avis`. Le lien du courriel
  (`/tableau-de-bord?conversation=<id>&mode=client|deneigeur`) ouvre la
  conversation dans le bon mode.

## `users/{userId}/lectures/{demandeId}`

```
luAt                    // heure du serveur, à l'ouverture de la conversation
```

Privé au propriétaire. « Nouveau message » = `dernierMessage.at > luAt` et
`dernierMessage.par` n'est pas soi.

## Index composites

Voir `firestore.indexes.json` :
- `demandes` : (`statut`, `postalCodePrefix`, `dateHeureSouhaitee`)
- `demandes` : (`donneurOuvrageId`, `createdAt`)
- `demandes` : (`villeGeoId`, `statut`, `createdAt`) — utilisé par `ecouterDemandesOuvertes`
  (liste temps réel de l'écran X) : filtre dur par ville, tri par date à l'intérieur
- `offresCiblees` : (`utilisateurCibleId`, `statut`)
