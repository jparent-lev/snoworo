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

stripeConnectAccountId: string | null   // 🔒 compte Stripe Connect Express du déneigeur
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
n'est pas `"actif"` ne doit jamais apparaître dans le matching. **Pas encore
appliqué** dans les requêtes/règles actuelles : voir le TODO dans
`firestore.rules` et `src/lib/demandes.js` — l'onboarding Stripe Connect n'est
pas encore construit, activer ce filtre avant qu'il existe bloquerait tout
matching.

## `demandes/{demandeId}`

```
donneurOuvrageId, donneurPrenom       // prénom dénormalisé pour l'affichage carte (évite un join)
statut: "ouverte" | "matchee" | "completee" | "annulee"
adresseGeohash, postalCodePrefix, quartier   // quartier : saisie libre en attendant Google Maps
ville, villeGeoId                      // 🔒 calculés par calculerVilleDemande (trigger Firestore)
titre, description                     // copie affichée sur la carte de demande (écran X)
dateHeureSouhaitee, typeService, remunerationOfferte, createdAt

deneigeurId, matchedAt

paiement: {              // 🔒 calculé par la Cloud Function de match — pas encore implémenté
  montantTotal: number,          // valeur du contrat (== remunerationOfferte au moment du match)
  fraisSnowro: number,           // config/frais : fraisFixe + fraisPct * montantTotal
  montantDeneigeur: number,      // montantTotal - fraisSnowro
  statutPaiement: "en_attente" | "paye" | "echoue" | "rembourse",
  stripePaymentIntentId: string,
  stripeTransferId: string | null,
} | null
```

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
fraisFixe: number    // en $, ex. 2 — valeurs non finalisées, voir le classeur financier
fraisPct: number      // décimal, ex. 0.08 pour 8 %
```

Document unique, lu uniquement côté serveur (Admin SDK) par la Cloud Function
de match — jamais exposé au client (`allow read, write: if false` dans
`firestore.rules`). Existe pour ajuster la structure de frais sans
redéploiement de code, voir `docs/architecture.md` § Paiement. **Pas encore
créé** : à seeder une fois la Cloud Function de paiement construite.

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
