#!/usr/bin/env bash
# Configuration unique du déploiement automatique des fonctions Firebase
# depuis GitHub Actions (.github/workflows/deployer-firebase.yml).
#
# À lancer dans Cloud Shell (console.cloud.google.com, bouton >_ en haut à
# droite), connecté avec un compte propriétaire du projet snowro-app :
#   bash configurer-deploiement-ci.sh
#
# Crée, sans aucune clé à télécharger :
#   - un compte de service « deploiement-github » avec les rôles nécessaires
#     au déploiement (site, fonctions, règles et index Firestore) ;
#   - un pool Workload Identity Federation « github » dont le fournisseur
#     n'accepte QUE la branche main du dépôt jparent-lev/snoworo.
# Peut être relancé sans danger : ce qui existe déjà est conservé.
set -euo pipefail

PROJECT_ID="snowro-app"
DEPOT="jparent-lev/snoworo"
SA_NOM="deploiement-github"
SA_COURRIEL="${SA_NOM}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL="github"
FOURNISSEUR="snoworo"

# Un compte de service tout juste créé met souvent quelques secondes (parfois
# une minute) à être visible du service des permissions : sans nouvelle
# tentative, la première attribution de rôle échoue avec « Service account
# ... does not exist ». On réessaie donc chaque commande IAM jusqu'à 8 fois.
reessayer() {
  local essai
  for essai in 1 2 3 4 5 6 7 8; do
    if "$@" >/dev/null 2>/tmp/erreur-iam; then
      return 0
    fi
    echo "   (pas encore prêt, nouvel essai dans 10 s : $essai/8)"
    sleep 10
  done
  cat /tmp/erreur-iam >&2
  return 1
}

gcloud config set project "$PROJECT_ID" >/dev/null
NUMERO_PROJET="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

echo "== Activation des API"
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  cloudresourcemanager.googleapis.com >/dev/null

echo "== Compte de service ${SA_COURRIEL}"
if ! gcloud iam service-accounts describe "$SA_COURRIEL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NOM" --display-name="Déploiement depuis GitHub Actions" >/dev/null
fi
reessayer gcloud iam service-accounts describe "$SA_COURRIEL"

echo "== Rôles du compte de service"
ROLES=(
  roles/cloudfunctions.admin           # créer, modifier, supprimer les fonctions
  roles/run.admin                      # fonctions 2e génération (services Cloud Run, accès public des callables)
  roles/iam.serviceAccountUser         # déployer en utilisant le compte d'exécution des fonctions
  roles/artifactregistry.admin         # images des fonctions et règle de nettoyage
  roles/secretmanager.admin            # lier les secrets (RESEND_API_KEY, etc.) aux fonctions
  roles/eventarc.admin                 # déclencheurs Firestore 2e génération
  roles/cloudscheduler.admin           # fonctions planifiées (regenererZonesStats)
  roles/firebasehosting.admin          # site web (Firebase Hosting)
  roles/firebaserules.admin            # règles Firestore
  roles/datastore.indexAdmin           # index Firestore
  roles/firebase.viewer                # lecture du projet par la CLI Firebase
  roles/serviceusage.serviceUsageConsumer
)
for ROLE in "${ROLES[@]}"; do
  reessayer gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_COURRIEL}" --role="$ROLE" --condition=None
  echo "   $ROLE"
done

echo "== Pool Workload Identity « ${POOL} »"
if ! gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" --location=global \
    --display-name="GitHub Actions" >/dev/null
fi

echo "== Fournisseur « ${FOURNISSEUR} » (branche main de ${DEPOT} seulement)"
if ! gcloud iam workload-identity-pools providers describe "$FOURNISSEUR" \
  --location=global --workload-identity-pool="$POOL" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$FOURNISSEUR" \
    --location=global --workload-identity-pool="$POOL" \
    --display-name="Dépôt snoworo" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository == '${DEPOT}' && assertion.ref == 'refs/heads/main'" >/dev/null
fi

echo "== Autorisation du dépôt à utiliser le compte de service"
reessayer gcloud iam service-accounts add-iam-policy-binding "$SA_COURRIEL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${NUMERO_PROJET}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${DEPOT}"

cat <<FIN

Terminé. Ajoute ces deux variables dans GitHub : dépôt ${DEPOT} > Settings >
Secrets and variables > Actions > onglet Variables > New repository variable

  GCP_WIF_PROVIDER    projects/${NUMERO_PROJET}/locations/global/workloadIdentityPools/${POOL}/providers/${FOURNISSEUR}
  GCP_SA_DEPLOIEMENT  ${SA_COURRIEL}

(Ce ne sont pas des secrets : sans la branche main de ce dépôt, elles ne
donnent accès à rien.)
FIN
