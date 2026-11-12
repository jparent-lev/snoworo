# Paiements Stripe : mise en place

Le code est dans `functions/src/paiements.js` (serveur) et
`src/components/CarteDePaiement.jsx` (champ de carte de Stripe dans l'app).
Tant que l'interrupteur n'est pas activé (étape 5), le paiement reste simulé.

## 1. Compte Stripe

1. Créer le compte sur https://dashboard.stripe.com/register (pays : Canada,
   entreprise Snowro).
2. Rester en **mode test** (bascule « Mode test » en haut) pour tout ce qui
   suit ; les clés `sk_test_…` / `pk_test_…` ne déplacent aucun argent.
3. Connect > Commencer : plateforme de type **marketplace**, comptes
   **Express**, pays des comptes connectés : Canada. Renseigner l'image de
   marque (Connect > Paramètres > Image de marque) : nom Snowro, icône, couleur
   `#C1652F`.

## 2. Secrets (Cloud Shell, projet `snowro-app`)

Les deux secrets doivent exister **avant** de fusionner le code Stripe : le
déploiement des fonctions les exige, même en paiement simulé.

```bash
gcloud config set project snowro-app
read -rs CLE && printf '%s' "$CLE" | gcloud secrets create STRIPE_SECRET_KEY --data-file=- ; unset CLE
# Collé : la clé secrète de test (Développeurs > Clés API > Clé secrète, sk_test_…)

printf 'a-remplacer' | gcloud secrets create STRIPE_WEBHOOK_SECRET --data-file=-
# Valeur provisoire : la vraie arrive à l'étape 4.
```

Le compte de service `deploiement-github` a déjà `secretmanager.admin` : le
déploiement donne lui-même l'accès aux fonctions.

## 3. Fusion et déploiement

Après la fusion dans `main`, le déploiement automatique crée les fonctions
`preparerCarte`, `enregistrerCarte`, `relancerDemande`, `lienCompteDeneigeur`,
`synchroniserCompteDeneigeur` et `webhookStripe`.

## 4. Webhook

1. Stripe > Développeurs > Webhooks > Ajouter une destination :
   - URL : `https://northamerica-northeast1-snowro-app.cloudfunctions.net/webhookStripe`
   - Événements : `account.updated`, en cochant « Comptes connectés » (les
     événements viennent des comptes Express des déneigeurs).
     Les comptes sont créés avec Accounts v2 ; `account.updated` reste émis
     pour eux, et le webhook relit le compte pour en tirer le statut (il
     accepte aussi les événements `v2.core.account…`).
2. Copier le **secret de signature** (`whsec_…`) et l'enregistrer :

```bash
read -rs CLE && printf '%s' "$CLE" | gcloud secrets versions add STRIPE_WEBHOOK_SECRET --data-file=- ; unset CLE
```

3. Relancer le déploiement (Actions > Déployer Snowro > Run workflow) pour que
   `webhookStripe` lise la nouvelle valeur.

## 5. Activer le paiement réel

Une seule PR, qui doit changer les deux côtés ensemble :
- `.env.production` : `VITE_STRIPE_CLE_PUBLIQUE=pk_test_…` (clé publiable,
  pas un secret) ;
- `functions/.env.snowro-app` : `PAIEMENT_REEL=true` (fichier versionné, déjà présent avec `false` : la CLI Firebase exige une valeur pour chaque paramètre au déploiement).

Dès lors : carte obligatoire pour publier, compte de versement actif
obligatoire pour accepter, bandeaux « Période de test » retirés.

## Tester (mode test)

- Carte qui fonctionne : `4242 4242 4242 4242`, date future, CVC au choix.
- Carte acceptée à l'enregistrement mais refusée au prélèvement (pour voir
  « Carte refusée ») : `4000 0000 0000 0341`.
- Inscription Express en mode test : Stripe propose des valeurs de test
  (téléphone `000 000 0000`, code SMS `000000`, compte bancaire de test).

## Passer en production (argent réel)

Le test (`snowro-test`) reste en mode test ; seule la production change.

**Avant (dans Stripe, mode production)**
1. Activer le compte : vérification de l'entreprise (identité du
   représentant, NEQ, compte bancaire de Snowro pour les frais encaissés).
2. Connect en mode production : profil de plateforme (marketplace, comptes
   Express, Canada), image de marque (nom, icône, couleur `#C1652F`),
   confirmation de conformité du marchand.
3. Paramètres > Moyens de paiement : même tri qu'en sandbox (Cartes, Link au
   besoin ; moyens européens et asiatiques désactivés).
4. Webhook de production : Développeurs > Webhooks > Ajouter une destination,
   URL `https://northamerica-northeast1-snowro-app.cloudfunctions.net/webhookStripe`,
   événement `account.updated` (comptes connectés). Garder le secret
   `whsec_…`.
5. TPS/TVQ sur les frais Snowro : validé avec le comptable (inscription,
   affichage sur les reçus).

**Pièges rencontrés le 12 novembre 2026 (passage en production)**
- Paiements et virements actifs ne suffisent pas : tant qu'une exigence reste
  sur le compte de la plateforme, la création de comptes connectés est refusée
  avec `account_create_activation_required` (code absent de la documentation).
  Ici : `person_….verification.document_live_capture`, une pièce d'identité
  du représentant photographiée en direct (Paramètres > Entreprise > État du
  compte). Le processus d'identité a dû être repris plusieurs fois avant de
  passer. Vérifier `requirements` du compte plateforme (connecteur Stripe ou
  `GET /v1/accounts/{id}`) : vide partout, sinon le régler d'abord.
- Le refus est aussi rejoué par la clé d'idempotence : depuis la PR #112, la
  clé de création porte un numéro de tentative (`tentativeCompteStripe`),
  augmenté à chaque échec.
- Le tableau de bord Express (connect.stripe.com) n'a pas de lien de retour :
  « Voir mes versements » l'ouvre dans un nouvel onglet.

**Secrets (Cloud Shell, `snowro-app`)**, sans jamais afficher les valeurs :

```bash
read -rs CLE && printf '%s' "$CLE" | gcloud secrets versions add STRIPE_SECRET_KEY --project=snowro-app --data-file=- ; unset CLE      # sk_live_…
read -rs CLE && printf '%s' "$CLE" | gcloud secrets versions add STRIPE_WEBHOOK_SECRET --project=snowro-app --data-file=- ; unset CLE  # whsec_… du webhook de production
```

**PR de bascule (une seule, vers `main`)**
- `.env.production` : `VITE_STRIPE_CLE_PUBLIQUE=pk_live_…` ;
- `functions/.env.snowro-app` : `STRIPE_MODE=live`.

Les secrets doivent être en place avant la fusion : le déploiement fige la
version des secrets lue à ce moment, et `stripe()` refuse une clé qui ne
correspond pas à `STRIPE_MODE`.

**Ce qui se passe pour les comptes existants** : les cartes et comptes de
versement créés en mode test (`stripeMode` absent ou `test`) sont ignorés en
mode réel. Le client doit ajouter une vraie carte, le déneigeur refaire son
inscription de versement ; le profil est marqué `stripeMode: "live"` à la
première opération. Faire la bascule quand aucune demande n'est acceptée ou
faite en mode test (sinon son virement échouerait).

**Retour arrière** : remettre `pk_test_…`, `STRIPE_MODE=test` et une version
`sk_test_…` du secret ; les identifiants du mode réel seront alors ignorés à
leur tour.

## Moyens de paiement offerts

Le formulaire de carte affiche la carte en premier (`paymentMethodOrder` dans
`src/components/CarteDePaiement.jsx`). Les autres moyens proposés viennent des
réglages du tableau de bord : Paramètres > Moyens de paiement. Pour le marché
canadien, garder **Cartes** (Apple Pay et Google Pay en découlent) et, au
besoin, **Link** ; désactiver les moyens européens ou asiatiques (BLIK,
Bancontact, iDEAL, EPS, Przelewy24, etc.), à refaire en mode production.
