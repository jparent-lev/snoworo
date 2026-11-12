# Mesure d'audience (Google Analytics 4)

Code : `src/lib/mesure.js`, bandeau `src/components/BandeauMesure.jsx`, lien
« Témoins » `src/components/LienTemoins.jsx`.

## Principe (Loi 25)

- Désactivée par défaut. Rien n'est chargé ni envoyé à Google avant un clic
  sur « Accepter » dans le bandeau. « Refuser » a le même poids visuel.
- Le choix est gardé dans le navigateur (`localStorage`, clé `snowro-mesure`,
  avec sa date et la version du texte). Changer `VERSION` dans
  `src/lib/mesure.js` redemande le consentement à tout le monde.
- Retrait en tout temps : lien « Témoins » au pied des pages. Les témoins
  `_ga` sont effacés et l'envoi est coupé.
- Aucun renseignement identifiant : ni nom, courriel, adresse, ni identifiant
  de compte ou de demande. L'adresse de page envoyée ne garde que les
  paramètres `utm_*` et `gclid` (un lien de confirmation contient un courriel).
- Fonctions publicitaires coupées : `ad_storage`, `ad_user_data`,
  `ad_personalization` refusés, Google Signals désactivé.

## Mise en route (console, à faire une fois)

Fait pour la propriété G-62SJDTB2KX (avenant accepté le 11 novembre 2026).

1. analytics.google.com : créer une propriété « Snowro » (fuseau
   America/Toronto, devise CAD), puis un flux Web pour `snowro.com`.
   Copier l'identifiant de mesure `G-…`.
2. Admin, Collecte et conservation des données :
   - Conservation des données : **2 mois** (ce qu'annonce la politique).
   - Google Signals : **désactivé**.
   - Collecte de données détaillées sur l'emplacement et l'appareil : désactivée.
3. Admin, Paramètres du compte : accepter l'avenant sur le traitement des
   données (Data Processing Terms) et noter la date dans
   `docs/loi25/evaluation-transferts.md`.
4. Flux Web, Mesure améliorée : garder pages vues et défilement ; **désactiver
   « Interactions avec les formulaires »** et « Recherche sur le site » (le site
   envoie ses propres événements, sans contenu de formulaire). « Vidéos »
   ne concerne que YouTube : sans effet ici.
5. Flux Web, Configurer les paramètres de balise, Définir les domaines
   internes / Liste des sites référents exclus : ajouter `checkout.stripe.com`
   et `connect.stripe.com` pour ne pas compter le retour de Stripe comme une
   nouvelle visite.
6. Mettre l'identifiant dans `.env.production` (`VITE_GA_ID=G-…`) et
   déployer. Pour le site de test, une propriété distincte (ou rien) dans
   `.env.test` : ne jamais mélanger les données de test et de production.
7. Admin, Événements : marquer comme **événements clés** `sign_up`,
   `demande_publiee`, `demande_acceptee` et `demande_confirmee`.
8. Admin, Définitions personnalisées : créer les dimensions `emplacement`,
   `type_service`, `role` (portée utilisateur), `video_title`,
   `video_percent`, `destination`.

## Événements envoyés

| Événement | Quand | Paramètres |
|---|---|---|
| `page_view` | Chaque changement de page | `page_location` (nettoyée), `page_title` |
| `cta_clic` | Clic sur un appel à l'action de l'accueil (`data-mesure`) | `emplacement` (entete, heros_publier, heros_deneiger, section_deneigeur, appel_final), `destination` |
| `sign_up` | Compte créé | `method` |
| `login` | Connexion | `method` |
| `choix_role` | Premier choix client / déneigeur | `role` |
| `demande_publiee` | Demande publiée | `type_service`, `value`, `currency` |
| `demande_acceptee` | Un déneigeur s'engage | `type_service`, `value`, `currency` |
| `travail_fait` | « C'est fait » envoyé | `photos` |
| `demande_confirmee` | Le client confirme et verse | `value`, `currency` |
| `video_ouverte` | Clic sur une vidéo | `video_title`, `emplacement` (vedette, vignette) |
| `video_start`, `video_progress`, `video_complete` | Lecture, 25/50/75 %, fin | `video_title`, `video_percent` |
| `credit_*` | Page crédit d'impôt | voir `src/pages/creditImpot` |

Propriété utilisateur : `role` (client, deneigeur, les_deux, aucun).

## Liens de campagne

Toujours ajouter des paramètres UTM aux liens publiés, par exemple pour la
bio Instagram :

`https://snowro.com/?utm_source=instagram&utm_medium=social&utm_campaign=lancement`

Une publication payante : `utm_medium=paid_social`. Un dépliant : un code QR
vers `?utm_source=depliant&utm_medium=print&utm_campaign=limoilou`.
