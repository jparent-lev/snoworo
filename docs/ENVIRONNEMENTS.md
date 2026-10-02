# Snowro : environnements, services et suivi

Source de vérité pour l'état des environnements de Snowro. À mettre à jour à
chaque changement d'infrastructure, de configuration ou de déploiement.
**Aucun secret ici** : seulement les identifiants non secrets et l'endroit où
les secrets sont rangés.

Dernière mise à jour : 2026-10-01 (soir : domaine test.snowro.com et webhook
Stripe de test).

## 1. Vue d'ensemble

| Environnement | Projet Firebase / GCP | Hébergement | Domaine | Branche Git |
|---|---|---|---|---|
| Production | `snowro-app` | Firebase Hosting | https://snowro.com (DNS chez GoDaddy) | `main` |
| Test | `snowro-test` | Firebase Hosting (premier déploiement le 2026-10-01) | https://test.snowro.com (certificat en génération) et https://snowro-test.web.app | `test` |
| Ancien hébergement | Netlify, site « snowro » | **supprimé** le 2026-10-01 | | |

Les deux environnements sont complètement séparés : comptes, demandes et
messages créés en test n'existent pas en production.

Stack : React (Vite), Firebase (Auth, Firestore, Functions, Hosting), Stripe
Connect (Accounts v2), Resend.

Dépôt : `github.com/jparent-lev/snoworo`. Le nom porte un « o » de trop, c'est
voulu : ne pas le renommer sans mettre à jour les fournisseurs Workload
Identity (ils n'acceptent que ce dépôt).

Comptes à ne pas confondre : les projets Google Cloud et Firebase sont sous
jonathan.parent@gmail.com (pas jparent@limoilouenvrac.com). Le compte Stripe
est ouvert sous allo@snowro.com (alias de la boîte Google Workspace Numino).

| | Production | Test |
|---|---|---|
| Configuration du site | `.env.production` | `.env.test` (bandeau « Environnement de test », balise `noindex`) |
| Paramètres des fonctions | `functions/.env.snowro-app` | `functions/.env.snowro-test` |
| Paiement | réel, sandbox Stripe (pour l'instant) | réel, sandbox Stripe |
| Courriels | normaux | sujet préfixé « [Test] » |

## 2. Déploiement continu (GitHub Actions)

Un seul workflow, `.github/workflows/deployer-firebase.yml`, déploie Hosting,
Functions, règles et index Firestore (avec `--force` : règle de nettoyage des
images et suppression des fonctions retirées du code). La branche poussée
choisit l'environnement :

| Branche | Projet | Mode Vite | Variables GitHub |
|---|---|---|---|
| `main` | `snowro-app` | `production` | `GCP_WIF_PROVIDER`, `GCP_SA_DEPLOIEMENT` |
| `test` | `snowro-test` | `test` | `GCP_WIF_PROVIDER_TEST`, `GCP_SA_DEPLOIEMENT_TEST` |

Sans les variables d'un environnement, le job est ignoré pour sa branche.
Authentification par Workload Identity Federation (aucune clé) ; le
fournisseur de chaque projet n'accepte que sa branche.

**Façon de travailler** : PR vers `test` (sa fusion déploie sur
test.snowro.com), essais, puis PR de `test` vers `main` (sa fusion déploie en
production). Le pied de page affiche le commit court déployé.

En local : `npm run build:test`, alias Firebase CLI dans `.firebaserc`
(`prod` et `default` : `snowro-app` ; `test` : `snowro-test`).

### Mise en place d'un projet (une fois, dans Cloud Shell)

```bash
# Production (par défaut)
bash scripts/configurer-deploiement-ci.sh
# Test
PROJECT_ID=snowro-test BRANCHE=test bash scripts/configurer-deploiement-ci.sh
```

Le script lit des **variables** (pas d'argument) : appelé avec un argument
seulement, il reconfigurerait la production. Il crée le compte
`deploiement-github`, ses rôles, le fournisseur Workload Identity limité à la
branche, active les API nécessaires (dont `cloudbilling`) et accorde les
autorisations des agents de service exigées au premier déploiement
(Pub/Sub : `iam.serviceAccountTokenCreator` ; compte Compute : `run.invoker`,
`eventarc.eventReceiver`). Il affiche à la fin les deux variables GitHub à
créer.

## 3. Production : `snowro-app`

- Région des Cloud Functions : `northamerica-northeast1` (Montréal)
- Facturation : « Paiement de Firebase », `012286-0A43F5-565200`
- Paramètres des fonctions (`functions/.env.snowro-app`) : `PAIEMENT_REEL=true`,
  `URL_SITE=https://snowro.com`
- Secrets (Secret Manager, projet `snowro-app`) :
  - `GOOGLE_GEOCODING_API_KEY` (2026-09-09) : clé « Snowro-Geo » du projet
    `snowro-app`, restreinte aux API Geocoding et Places API (New) (cette
    dernière ajoutée le 2026-10-02). Clé **serveur** seulement (Cloud
    Functions), jamais envoyée au navigateur : une restriction par site web
    ne s'applique pas, la restriction par API est la bonne.
  - `RESEND_API_KEY` (2026-09-30)
  - `STRIPE_SECRET_KEY` (2026-10-01) : clé secrète de la **sandbox** Stripe,
    107 caractères vérifiés
  - `STRIPE_WEBHOOK_SECRET` (2026-10-01) : version 1 provisoire
    (`a-remplacer`), version 2 = secret de signature du webhook de production
- Courriels : Resend, domaine `snowro.com` (expéditeur `allo@snowro.com`)

**Attention** : les clés Stripe de la production sont des clés de **test**
(sandbox). Avant le lancement, ajouter une version avec les clés live et créer
un webhook en mode production (voir `docs/stripe.md`).

### État du code des paiements

Stripe Connect est **intégré et actif** (PR #25 à #32, en production depuis le
2026-10-01) : carte enregistrée à la publication (SetupIntent), prélèvement à
l'acceptation (PaymentIntent hors session), virement au déneigeur à la
confirmation (Transfer), comptes des déneigeurs créés avec Accounts v2
(particulier, tableau de bord Express), fonction `webhookStripe`
(`account.updated`). Détails : `functions/src/paiements.js`, `docs/stripe.md`.

## 4. Test : `snowro-test` (créé le 2026-10-01)

- Numéro du projet : `515068086679`
- Forfait Blaze, même compte de facturation que la production, alerte de
  budget 25 $ CAD
- Paramètres des fonctions (`functions/.env.snowro-test`) :
  `PAIEMENT_REEL=true`, `URL_SITE=https://test.snowro.com`
- Authentication : courriel et mot de passe ; domaines autorisés `localhost`,
  `snowro-test.firebaseapp.com`, `snowro-test.web.app`, `test.snowro.com`
- Firestore : `(default)`, `northamerica-northeast1`, règles et index déployés
  par le workflow
- Application web `snowro-test-web` : `1:515068086679:web:a7a794e716c6ca31119cd2`
  (configuration dans `.env.test`)
- Secrets (Secret Manager, projet `snowro-test`) : `RESEND_API_KEY`,
  `GOOGLE_GEOCODING_API_KEY` et `STRIPE_SECRET_KEY` copiés de la production
  (mêmes valeurs : le géocodage et les suggestions d'adresses du test sont
  donc facturés au projet `snowro-app`) ; `STRIPE_WEBHOOK_SECRET` version 1 provisoire
  (`a-remplacer`, 17 h 11 UTC), version 2 = secret de signature de la
  destination `upbeat-spark` (17 h 42 UTC)
- Domaine : CNAME `test` vers `snowro-test.web.app` chez GoDaddy (TTL
  1/2 heure, seul enregistrement ajouté) ; vérifié par Firebase, certificat
  en génération

### Réglages faits à la main au premier déploiement

Désormais inclus dans le script de mise en place, sauf le dernier :
- autorisations des agents de service (Pub/Sub, Compute) ;
- activation de l'API `cloudbilling` ;
- `roles/serviceusage.serviceUsageAdmin` donné à `deploiement-github` dans
  `snowro-test` seulement (lui permet d'activer les API lui-même).

## 5. Stripe (compte ouvert le 2026-10-01, allo@snowro.com)

Deux environnements de test coexistent sur ce compte. **Toute la configuration
Connect et toutes les clés utilisées par Snowro viennent de la sandbox**, pas
du « Mode test » classique.

| Environnement Stripe | Compte | Usage |
|---|---|---|
| Sandbox « environnement de test Snowro » | `acct_1UKYSpPPqLGXXv6l` | Connect, clés API, webhooks : celui à utiliser |
| Mode test classique | `acct_1ULjSvAMNf3EBd4H` | Compte principal ; engagements de plateforme confirmés ici |
| Mode production | `acct_1ULjSvAMNf3EBd4H` | Non activé (vérification d'entreprise à faire) |

- Modèle Connect : marketplace (les clients paient Snowro, Snowro reverse aux
  déneigeurs) ; frais et pertes assumés par la plateforme
- Comptes connectés : créés par le code avec **Accounts v2**
  (`dashboard: "express"`, pays CA, particulier, configuration
  « recipient ») ; rien à régler dans le tableau de bord pour ça
- Image de marque Connect : nom Snowro, couleur `#C1652F`, pas encore d'icône
- Moyens de paiement (configuration Default de la sandbox, 2026-10-02) :
  activés Cartes, Cartes bancaires (réseau CB, lié aux cartes), Apple Pay,
  Google Pay, Link, Solde Stripe ; tous les moyens européens et asiatiques
  désactivés (BLIK, Bancontact, EPS, MB WAY, Satispay, Pix, Pay by Bank,
  Affirm, Klarna, etc.). **À refaire en mode production** : la configuration
  ne s'y transfère pas. Le formulaire affiche la carte en premier.
- Clé publiable (sandbox) : dans `.env.production` et `.env.test`
  (`VITE_STRIPE_CLE_PUBLIQUE`)
- Clé secrète : `STRIPE_SECRET_KEY` dans les deux projets

Une destination webhook par environnement, même configuration : point de
terminaison, événements des **comptes connectés**, `account.updated`
seulement, API `2026-08-26.dahlia`.

| Environnement | Destination | Nom | URL | Secret |
|---|---|---|---|---|
| Production | `we_1ULl6vPPqLGXXv6lXI5TjE0C` | `charismatic-brilliance` | `https://northamerica-northeast1-snowro-app.cloudfunctions.net/webhookStripe` | `snowro-app` > `STRIPE_WEBHOOK_SECRET` v2 |
| Test | `we_1ULnyKPPqLGXXv6lBJ4tRssi` | `upbeat-spark` | `https://northamerica-northeast1-snowro-test.cloudfunctions.net/webhookStripe` | `snowro-test` > `STRIPE_WEBHOOK_SECRET` v2 |

Cartes de test : `4242 4242 4242 4242` (fonctionne), `4000 0000 0000 0341`
(enregistrée, puis refusée au prélèvement).

## 6. Points en suspens

| # | Sujet | Où | Détail |
|---|---|---|---|
| 1 | Informations publiques de l'entreprise | Stripe, mode production | Nom public, site, courriel de soutien, téléphone, adresse ; impossible en test |
| 2 | Confirmation de conformité permanente du marchand | Stripe > Paramètres > Connect > Profil de la plateforme | Affiche encore « Confirmer » |
| 3 | Icône et logo Connect | Stripe > Connect > Image de marque | Fichiers à fournir |
| 4 | Désactiver la version 1 provisoire de `STRIPE_WEBHOOK_SECRET` | `snowro-app` et `snowro-test` | `gcloud secrets versions disable 1 --secret=STRIPE_WEBHOOK_SECRET --project=<projet>` |
| 5 | Tester les deux webhooks de bout en bout | Stripe | « Envoyer des événements de test » (`account.updated`) : livraison attendue 200 |
| 6 | Certificat de `test.snowro.com` | Firebase Hosting | Attendre, puis tester https://test.snowro.com |
| 7 | Passage de Stripe en production | Stripe et GCP | Vérification d'entreprise, clés live, webhook de production, nouvelles versions des secrets, TPS/TVQ avec le comptable |
| 9 | Clé Google propre au projet de test (facultatif) | GCP `snowro-test` | Aujourd'hui, le test utilise la clé de production (`Snowro-Geo`). Pour séparer quotas et facturation : créer une clé dans `snowro-test`, y activer Geocoding API et Places API (New) (déjà activée), puis une nouvelle version de `GOOGLE_GEOCODING_API_KEY` dans `snowro-test` |
| 10 | Moyens de paiement en mode production | Stripe, mode production | Refaire le tri fait dans la sandbox le 2026-10-02 |
| 8 | DKIM Google Workspace, puis DMARC `quarantine` | Console Workspace, GoDaddy | `google._domainkey` encore absent |

## 7. Journal

- 2026-10-01 : Netlify supprimé ; snowro.com et www sur Firebase Hosting.
  Compte Stripe (Canada, allo@snowro.com), Connect marketplace dans la
  sandbox, secrets Stripe et webhook de production. Paiements réels activés en
  mode test (PR #27), comptes des déneigeurs en Accounts v2 comme particuliers
  (PR #29, #31), carte sans `payment_method_types` (PR #32).
- 2026-10-01 : projet `snowro-test` créé (Blaze, Auth, Firestore Montréal,
  application web). Branche `test`, workflow à deux environnements, script
  paramétré (PR #30). Premier déploiement réussi après les réglages de la
  section 4 (PR #33, commit `aa0187a`).
- 2026-10-01 (soir) : `test.snowro.com` (CNAME chez GoDaddy, vérifié, certificat
  en génération). Webhook de test `upbeat-spark` et son secret (version 2).
  Ce document réunit l'ancien `docs/environnement-test.md` et la note
  `ENVIRONNEMENTS.md` tenue par Cowork.
- 2026-10-02 : suggestions d'adresses (PR #39) ; Places API (New) activée
  dans `snowro-app` et `snowro-test`, ajoutée aux API permises de la clé
  « Snowro-Geo ». Moyens de paiement de la sandbox triés (Canada).
