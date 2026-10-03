# Évaluation des facteurs relatifs à la vie privée : communication de renseignements hors du Québec

> **Modèle à compléter et à signer.** Ce document répond à l'article 17 de la
> Loi sur la protection des renseignements personnels dans le secteur privé
> (Loi 25) : avant de communiquer des renseignements personnels à l'extérieur
> du Québec, Snowro doit évaluer si la protection offerte sera adéquate. Les
> faits techniques ci-dessous viennent du code et de `docs/ENVIRONNEMENTS.md`.
> Les cases « À compléter » sont à remplir par la personne responsable. Une
> révision par un professionnel ou une professionnelle du droit est
> recommandée.

| | |
|---|---|
| Entreprise | Snowro |
| Personne responsable de la protection des renseignements personnels | Jonathan Parent |
| Date de l'évaluation | À compléter |
| Prochaine révision | Au plus tard dans 12 mois, ou dès l'ajout d'un fournisseur ou d'un nouvel usage |

## 1. Renseignements visés et finalités

| Renseignements | Finalité | Sensibilité |
|---|---|---|
| Nom d'affichage, courriel, téléphone (facultatif) | Compte, avis par courriel | Moyenne |
| Adresse à déneiger, numéro d'appartement, adresse de service du déneigeur, position | Mise en relation dans la même ville ; adresse exacte montrée au déneigeur qui accepte | Élevée (lieu de résidence) |
| Messages entre client et déneigeur, photos de fin de job (sans métadonnées GPS) | Exécution de la job, preuve | Moyenne ; effacés 30 jours après la job |
| Paiement : identifiants Stripe, montants ; identité et compte bancaire du déneigeur (chez Stripe seulement) | Paiement et versement | Élevée (financière), mais détenue par Stripe |
| Liste d'attente : courriel, code postal, rôle | Choisir les villes à ouvrir | Faible ; effacée après 24 mois |
| « Nous écrire » : nom, courriel, message | Répondre | Faible à moyenne ; effacé après 24 mois |

## 2. Fournisseurs et lieux de traitement

| Fournisseur | Service utilisé | Où sont les renseignements | Encadrement contractuel |
|---|---|---|---|
| Google (Firebase) | Hébergement du site, authentification, base de données Firestore, fonctions serveur | Fonctions : `northamerica-northeast1` (Montréal). Firestore : Montréal pour `snowro-test` ; **à confirmer pour `snowro-app`** (console Firebase, Firestore, emplacement). Authentification et Hosting : infrastructure mondiale de Google, dont les États-Unis | Conditions de Google Cloud et Firebase, avenant sur le traitement des données (Data Processing and Security Terms). À compléter : date d'acceptation dans la console |
| Google Maps Platform | Géocodage, suggestions d'adresses (texte tapé envoyé à Google) | États-Unis et autres pays | Conditions de Google Maps Platform et avenant sur le traitement des données |
| Stripe | Paiements, vérification d'identité et versements aux déneigeurs | Canada et États-Unis | Contrat de services Stripe et avenant sur la protection des données (DPA) ; certification PCI DSS niveau 1 |
| Resend | Envoi des courriels transactionnels | États-Unis | Conditions et avenant sur le traitement des données de Resend. À compléter : confirmer l'acceptation du DPA |

## 3. Analyse (article 17)

Pour chaque fournisseur, évaluer et noter :

1. **Sensibilité des renseignements** : voir le tableau 1. Les renseignements
   financiers les plus sensibles (carte, compte bancaire, pièce d'identité) ne
   passent jamais par Snowro : ils sont saisis directement chez Stripe.
2. **Finalité** : chaque communication est nécessaire au service demandé par
   la personne (hébergement, paiement, courriel). Aucune vente ni usage
   publicitaire.
3. **Mesures de protection** :
   - chiffrement en transit (HTTPS) et au repos chez chaque fournisseur ;
   - règles Firestore : adresse exacte, photos et messages lisibles seulement
     par les deux personnes de la job ; champs sensibles écrits seulement par
     les fonctions serveur ;
   - clés d'API conservées dans Secret Manager, jamais dans le site ;
   - minimisation : position arrondie dans les demandes publiques, métadonnées
     retirées des photos, durées de conservation appliquées automatiquement ;
   - engagements contractuels de confidentialité et de sécurité de chaque
     fournisseur (avenants DPA).
4. **Régime juridique du lieu de destination** : les États-Unis n'offrent pas
   une protection équivalente à la Loi 25 (accès possible des autorités
   américaines). Ce risque est atténué par les engagements contractuels, la
   minimisation et le chiffrement. À compléter : appréciation de la personne
   responsable.

## 4. Conclusion

À compléter, par exemple : « Compte tenu des mesures ci-dessus, la protection
offerte par Google, Stripe et Resend est jugée adéquate au sens de
l'article 17. Une entente écrite (conditions et avenants DPA de chaque
fournisseur) encadre chaque communication. »

| | |
|---|---|
| Décision | À compléter |
| Signature de la personne responsable | |
| Date | |

## 5. Suivi

- [ ] Confirmer l'emplacement Firestore de `snowro-app`.
- [ ] Vérifier que l'avenant DPA est accepté chez Google Cloud, Stripe et Resend.
- [ ] Refaire cette évaluation avant d'ajouter un fournisseur (SMS, analytique, etc.).
