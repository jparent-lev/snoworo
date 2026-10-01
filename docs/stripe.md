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
- `functions/.env.snowro-app` : `PAIEMENT_REEL=true`.

Dès lors : carte obligatoire pour publier, compte de versement actif
obligatoire pour accepter, bandeaux « Période de test » retirés.

## Tester (mode test)

- Carte qui fonctionne : `4242 4242 4242 4242`, date future, CVC au choix.
- Carte acceptée à l'enregistrement mais refusée au prélèvement (pour voir
  « Carte refusée ») : `4000 0000 0000 0341`.
- Inscription Express en mode test : Stripe propose des valeurs de test
  (téléphone `000 000 0000`, code SMS `000000`, compte bancaire de test).

## Passer en production

Refaire les étapes 2, 4 et 5 avec les clés du **mode production**
(`sk_live_…`, `pk_live_…`) et un nouveau webhook en mode production. Prévoir
avant : conditions d'utilisation à jour (paiement, remboursement), et
validation fiscale des frais Snowro (TPS/TVQ) avec le comptable.
