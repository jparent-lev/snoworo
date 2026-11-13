# Trousse médias (snowro.com/medias)

Page `src/pages/Medias.jsx`, donnée seulement de façon ciblée (communiqués,
courriels aux journalistes) : aucun lien sur le site, `noindex`.

- Contact médias : constante `CONTACT` en tête du fichier.
- Logos : `public/medias/snowro-logo.png` (couleur, sur tuile lin),
  `snowro-logo-inverse.png` (fond foncé), `snowro-symbole.png` (1024 px).
  Ils sont rendus à partir des composants de marque sur la route de
  développement `/medias/planche` (`PlancheLogos`), capturés par Playwright
  avec un fond transparent (`omitBackground`, deviceScaleFactor 3).
- Captures : `snowro-accueil.png` (1280 × 800 à 2x) et
  `snowro-accueil-mobile.png` (iPhone 13), animations réduites, bandeau de
  mesure refusé.
- Vidéos : celles de `public/videos/` (MP4, image, sous-titres).

Refaire les PNG après un changement de logo ou de l'accueil.
