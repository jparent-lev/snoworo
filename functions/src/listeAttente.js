// Liste d'attente de pré-lancement : fermée depuis l'ouverture de Snowro.
// L'inscription, la confirmation par courriel et leurs fonctions sont
// retirées. Il reste les entrées déjà dans Firestore (listeAttente/{id}),
// purgées par appliquerConservation et effacées à la fermeture d'un compte
// (compte.js), jusqu'à l'effacement complet de la collection.
//
// Identifiant d'une entrée : le courriel, ou « pro:{courriel} » pour une
// entreprise intéressée par Snowro Pro.
export const idListeAttente = (courriel, role) => (role === "pro" ? `pro:${courriel}` : courriel);
