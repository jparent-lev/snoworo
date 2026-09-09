// Version du texte de consentement présenté à l'utilisateur pour chaque type de
// traitement (Loi 25 : le retrait/octroi doit être traçable au texte exact consenti).
// Incrémenter uniquement quand le texte affiché à l'utilisateur change.
export const CONSENT_VERSIONS = {
  zonesAgregees: 1,
  offresCiblees: 1,
  notificationsSMS: 1,
};

export const CONSENT_TYPES = Object.keys(CONSENT_VERSIONS);
