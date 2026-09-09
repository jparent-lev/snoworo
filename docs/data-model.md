# Modèle de données Firestore

## `users/{userId}`

```
role: ["donneur_ouvrage" | "deneigeur_x" | "deneigeur_pro"]
displayName, phone, email
addressGeohash, postalCodePrefix
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
garantir que `consents` existe toujours avec sa forme complète.

## `demandes/{demandeId}`

```
donneurOuvrageId, donneurPrenom       // prénom dénormalisé pour l'affichage carte (évite un join)
statut: "ouverte" | "matchee" | "completee" | "annulee"
adresseGeohash, postalCodePrefix, quartier   // quartier : saisie libre en attendant Google Maps
titre, description                     // copie affichée sur la carte de demande (écran X)
dateHeureSouhaitee, typeService, remunerationOfferte, createdAt

deneigeurId, matchedAt
fraisMiseEnRelation: { montant, statutPaiement, stripePaymentIntentId } | null   // pas encore implémenté
```

`donneurPrenom`, `quartier`, `titre`, `description` sont des ajouts au schéma du
handoff d'origine, nécessaires pour reproduire l'écran X (carte de demande) tel
que livré par le design sans faire de jointure supplémentaire par carte.

## `zonesStats/{postalCodePrefix}_{semaineISO}`

Régénéré par `regenererZonesStats` (Cloud Function planifiée, hebdomadaire).

```
postalCodePrefix, semaineDebut
nbDemandesOuvertes, nbDemandesCompletees, remunerationMoyenne
// Aucune référence à un userId ou demandeId.
```

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
- `demandes` : (`statut`, `createdAt`) — utilisé par `ecouterDemandesOuvertes` (liste temps réel de l'écran X)
- `offresCiblees` : (`utilisateurCibleId`, `statut`)
