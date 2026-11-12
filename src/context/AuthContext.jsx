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

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
      }
    });
  }, []);

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
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé sous AuthProvider");
  return ctx;
}
