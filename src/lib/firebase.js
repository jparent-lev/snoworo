import { initializeApp } from "firebase/app";
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from "firebase/app-check";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// App Check (reCAPTCHA Enterprise, invisible) : prouve à Firebase que chaque
// appel vient du vrai site, pas d'un robot qui appelle les API directement.
// Inactif tant que VITE_RECAPTCHA_CLE est vide, et toujours sur les émulateurs.
// La clé de site est publique (elle est servie dans la page).
if (import.meta.env.VITE_RECAPTCHA_CLE && import.meta.env.VITE_UTILISER_EMULATEURS !== "1") {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_CLE),
    isTokenAutoRefreshEnabled: true,
  });
}
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "northamerica-northeast1");

// Développement local : `VITE_UTILISER_EMULATEURS=1` dans .env branche l'app
// sur les émulateurs Firebase (firebase emulators:start) au lieu de la
// production. Toujours vide dans .env.production.
if (import.meta.env.VITE_UTILISER_EMULATEURS === "1") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
