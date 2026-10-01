import "./BandeauTest.css";

// Visible sur toutes les pages de l'environnement de test (test.snowro.com,
// `vite build --mode test`), jamais en production.
export default function BandeauTest() {
  if (import.meta.env.MODE !== "test") return null;
  return (
    <div className="bandeau-test" role="note">
      Environnement de test : comptes, demandes et paiements fictifs. Carte de test : 4242 4242 4242 4242.
    </div>
  );
}
