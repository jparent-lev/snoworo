# Environnement de test

| | Production | Test |
|---|---|---|
| Projet Firebase | `snowro-app` | `snowro-test` |
| Adresse | https://snowro.com | https://test.snowro.com |
| Branche qui déploie | `main` | `test` |
| Configuration du site | `.env.production` | `.env.test` (bandeau « Environnement de test », non indexé) |
| Paramètres des fonctions | `functions/.env.snowro-app` | `functions/.env.snowro-test` |
| Courriels | normaux | sujet préfixé « [Test] » |
| Stripe | sandbox (pour l'instant) | sandbox |

## Façon de travailler

1. Une PR vers **`test`** : sa fusion déploie sur test.snowro.com.
2. On essaie sur test.snowro.com (carte `4242 4242 4242 4242`).
3. Une PR de **`test` vers `main`** : sa fusion déploie en production.

Les données (comptes, demandes) des deux environnements sont complètement
séparées : un compte créé en test n'existe pas en production.

## Mise en place (une seule fois)

1. Console Firebase : projet `snowro-test`, forfait Blaze, Authentication
   (courriel/mot de passe, domaine autorisé `test.snowro.com`), Firestore
   (`northamerica-northeast1`), application web `snowro-test-web` dont la
   configuration va dans `.env.test`.
2. Cloud Shell, secrets copiés de la production sans les afficher :

   ```bash
   gcloud services enable secretmanager.googleapis.com --project=snowro-test
   for S in RESEND_API_KEY GOOGLE_GEOCODING_API_KEY STRIPE_SECRET_KEY; do
     gcloud secrets versions access latest --secret=$S --project=snowro-app \
       | gcloud secrets create $S --data-file=- --project=snowro-test
   done
   printf 'a-remplacer' | gcloud secrets create STRIPE_WEBHOOK_SECRET --data-file=- --project=snowro-test
   ```

3. Déploiement automatique :
   `PROJECT_ID=snowro-test BRANCHE=test bash scripts/configurer-deploiement-ci.sh`,
   puis les variables GitHub `GCP_WIF_PROVIDER_TEST` et
   `GCP_SA_DEPLOIEMENT_TEST` affichées à la fin.
4. Après le premier déploiement : Hosting > domaine personnalisé
   `test.snowro.com` (enregistrements chez GoDaddy), et un deuxième webhook
   Stripe vers
   `https://northamerica-northeast1-snowro-test.cloudfunctions.net/webhookStripe`
   (secret dans `STRIPE_WEBHOOK_SECRET` du projet `snowro-test`).
