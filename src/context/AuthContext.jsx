import { createContext, useContext, useEffect, useState } from "react";
import { definirProfilMesure } from "../lib/mesure";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Le compte Firebase est un objet modifié sur place (reload) : ce compteur
  // force un nouveau rendu quand courrielConfirme change.
  const [, setVersion] = useState(0);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
      }
    });
  }, []);

  // Courriel confirmé dans un autre onglet ou sur le téléphone : on le voit au
  // retour sur la page, sans recharger.
  useEffect(() => {
    if (!user || user.emailVerified) return;
    const verifier = () => {
      if (document.visibilityState !== "visible") return;
      user
        .reload()
        .then(async () => {
          if (!user.emailVerified) return;
          await user.getIdToken(true);
          setVersion((v) => v + 1);
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", verifier);
    window.addEventListener("focus", verifier);
    return () => {
      document.removeEventListener("visibilitychange", verifier);
      window.removeEventListener("focus", verifier);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    return onSnapshot(doc(db, "users", user.uid), (snap) => {
      setProfile(snap.exists() ? snap.data() : null);
      if (snap.exists()) definirProfilMesure(snap.data().role);
      setLoading(false);
    });
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        courrielConfirme: Boolean(user?.emailVerified),
        signalerChangementCompte: () => setVersion((v) => v + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé sous AuthProvider");
  return ctx;
}
