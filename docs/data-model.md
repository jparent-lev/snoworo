# Modèle de données Firestore

## `users/{userId}`

```
role: ["donneur_ouvrage" | "deneigeur_x" | "deneigeur_pro"]
displayName, phone, email
addressGeohash, postalCodePrefix
ville, villeGeoId            // 🔒 dérivés par géocodage serveur, voir plus bas
ratingAvg, ratingCount
createdAt

proSubscription: { stripeCustomerId, status, plan, currentPeriodEnd } | null

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

## `demandes/{demandeId}`

```
donneurOuvrageId, donneurPrenom       // prénom dénormalisé pour l'affichage carte (évite un join)
statut: "ouverte" | "matchee" | "completee" | "annulee"
adresseGeohash, postalCodePrefix, quartier   // quartier : saisie libre en attendant Google Maps
ville, villeGeoId                      // 🔒 calculés par calculerVilleDemande (trigger Firestore)
titre, description                     // copie affichée sur la carte de demande (écran X)
dateHeureSouhaitee, typeService, remunerationOfferte, createdAt

deneigeurId, matchedAt
fraisMiseEnRelation: { montant, statutPaiement, stripePaymentIntentId } | null   // pas encore implémenté
```

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

## `offresCiblees/{offreId}`

```
deneigeurProId, utilisateurCibleId
message, remunerationProposee, statut, createdAt
```

Créé uniquement via `creerOffreCiblee` (valide `consents.offresCiblees.granted`
avant l'écriture).

## `messages/{conversationId}/messages/{messageId}`

`conversationId == demandeId`. Visible uniquement aux deux parties d'un match
confirmé (voir `firestore.rules`, `participantAuMatch`). Les coordonnées réelles
ne sont jamais insérées automatiquement dans `contenu`.

## Index composites

Voir `firestore.indexes.json` :
- `demandes` : (`statut`, `postalCodePrefix`, `dateHeureSouhaitee`)
- `demandes` : (`donneurOuvrageId`, `createdAt`)
- `demandes` : (`villeGeoId`, `statut`, `createdAt`) — utilisé par `ecouterDemandesOuvertes`
  (liste temps réel de l'écran X) : filtre dur par ville, tri par date à l'intérieur
- `offresCiblees` : (`utilisateurCibleId`, `statut`)
