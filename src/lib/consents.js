import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const grantConsentCallable = httpsCallable(functions, "grantConsent");
const revokeConsentCallable = httpsCallable(functions, "revokeConsent");

export function grantConsent(type) {
  return grantConsentCallable({ type });
}

export function revokeConsent(type) {
  return revokeConsentCallable({ type });
}
