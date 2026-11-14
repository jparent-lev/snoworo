# Jeunes déneigeurs : projet pilote (test seulement)

Activé par `JEUNES_PILOTE=true` (functions/.env.snowro-test, .env.local) et
`VITE_JEUNES_PILOTE=1` (.env.test, .env.emulateurs). Absent de la production.

## Pourquoi le parent est titulaire

Stripe refuse un mineur comme titulaire d'un compte de versement au Canada
(test du 14 novembre 2026 : « Nous ne prenons actuellement pas en charge les
mineurs. Cependant, votre tuteur légal peut ouvrir un compte pour vous. »).
Le parent est donc déneigeur avec son propre compte Stripe ; les paiements du
jeune lui sont versés (`demande.deneigeurParentId`, `verser`).

## Parcours

1. Le parent (déneigeur, courriel confirmé, adresse de la maison, compte de
   versement actif en paiement réel) invite son jeune dans Paramètres :
   prénom, courriel, année de naissance (14 à 17 ans), règles (heures, rayon
   autour de la maison, demandes par jour) et attestation d'autorité
   parentale (`inviterJeune`, `invitationsJeunes/{id}`).
2. Le jeune ouvre le lien `/jeune/rejoindre?i=…&j=…`, crée son accès avec
   l'adresse invitée, accepte les règles de sécurité
   (`accepterInvitationJeune`) : `users/{jeune}.parentId`, `jeune`, secteur
   copié de la maison ; courriel confirmé par le lien.
3. Le jeune accepte des demandes : `verifierJeune` applique les règles.
4. Le parent est avisé (courriel, texto s'il y a consenti) avec un lien
   `/jeune/annuler?d=…` : droit de veto tant que le travail n'est pas fait
   (`annulerParParent` : remboursement, demande remise en ligne, nouvelle clé
   de prélèvement `-r{n}`).
5. Le parent peut mettre en pause ou retirer son accord (`reglerJeune`).

Le client voit « Jeune déneigeur, accompagné d'un parent ».

Filtrage : la liste du tableau de bord du jeune et les avis de nouvelles
demandes ne montrent que les demandes qui respectent ses règles
(`horsRegles` côté serveur, `respecteRegles` côté site) ; aucune en pause.

Signalement : si un problème est signalé sur une demande du jeune (par le
client ou par le jeune), le parent reçoit un courriel avec le motif, les
détails et le verbatim des messages échangés, plus un texto s'il y a consenti
(`avertirParentSignalement`).

## Limites connues du pilote

- Le parent ne voit pas les messages en continu : seulement lors d'un
  signalement. À mentionner dans la Confidentialité (le client échange avec
  un jeune dont le parent peut lire la conversation en cas de problème).
- À valider avant la production : avis juridique (Jessica), traitement fiscal
  du revenu versé au parent (comptable), Conditions et Confidentialité.
