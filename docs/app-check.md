# App Check (reCAPTCHA Enterprise)

Bloque les appels aux API Firebase qui ne viennent pas du vrai site
(inscriptions automatisées de novembre 2026, voir `functions/src/robots.js`).
Invisible pour les vraies personnes : aucun casse-tête.

Code : `src/lib/firebase.js` (actif seulement si `VITE_RECAPTCHA_CLE` est
rempli, jamais sur les émulateurs). La clé de site est publique.

## Mise en place (d'abord `snowro-test`, puis `snowro-app`)

1. Console Google Cloud, projet visé, **Sécurité > reCAPTCHA** (activer l'API
   reCAPTCHA Enterprise si demandé), **Créer une clé** :
   - nom : « Snowro web » ;
   - plateforme : **Site Web** ;
   - domaines : `test.snowro.com`, `snowro-test.web.app`,
     `snowro-test.firebaseapp.com` (test) ou `snowro.com`, `www.snowro.com`,
     `snowro-app.web.app`, `snowro-app.firebaseapp.com` (production) ;
   - pas de case à cocher (clé à score).
   Copier l'**ID de la clé**.
2. Console Firebase, même projet, **App Check > Applications**, l'application
   web, **reCAPTCHA Enterprise** : coller l'ID de la clé, enregistrer.
3. Mettre l'ID dans `VITE_RECAPTCHA_CLE` (`.env.test` ou `.env.production`),
   déployer.
4. Surveiller un jour ou deux : **App Check > API**, les requêtes doivent être
   « vérifiées ». Puis **Appliquer** pour Authentication et Cloud Firestore.
   Les fonctions appelables pourront suivre (`enforceAppCheck: true`).

Retour en arrière : **Annuler l'application** dans la console (immédiat), ou
vider `VITE_RECAPTCHA_CLE`.
