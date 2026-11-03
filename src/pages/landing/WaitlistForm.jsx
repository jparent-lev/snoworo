import { useState } from "react";
import { Link } from "react-router-dom";
import { rejoindreListeAttente } from "../../lib/listeAttente";
import PartageListe from "./PartageListe";
import "./WaitlistForm.css";

const CODE_POSTAL_REGEX = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

// Inscription simple : nom complet, courriel et code postal, puis
// confirmation par un lien envoyé par courriel (anti-pourriel). Une fois inscrite, la
// personne peut préciser ce qu'elle veut faire (faire déneiger, déneiger ou
// les deux) : question facultative, envoyée par le même appel, qui sert à
// compter les déneigeurs par ville. Pro (role « pro », contrôlé par Landing)
// garde son formulaire avec le nom de l'entreprise ; l'offre est retirée du
// site jusqu'à la V2.
const INTENTIONS = [
  ["client", "Faire déneiger"],
  ["deneigeur", "Déneiger"],
  ["les_deux", "Les deux"],
];

export default function WaitlistForm({ role: roleControle = null }) {
  const pro = roleControle === "pro";
  const [entreprise, setEntreprise] = useState("");
  const [nom, setNom] = useState("");
  const [courriel, setCourriel] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [siteWeb, setSiteWeb] = useState(""); // honeypot — reste vide pour un humain
  // null tant que pas inscrit ; ensuite { ville } (ville dérivée par le serveur, peut être absente).
  const [inscription, setInscription] = useState(null);
  const [intention, setIntention] = useState(null);
  const [envoiIntention, setEnvoiIntention] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function preciser(role) {
    setEnvoiIntention(role);
    try {
      await rejoindreListeAttente({ nom: nom.trim(), courriel: courriel.trim(), codePostal: codePostal.trim(), role, siteWeb });
      setIntention(role);
    } catch {
      // Facultatif : en cas d'échec, l'inscription reste valide sans rôle.
      setIntention("non_precise");
    } finally {
      setEnvoiIntention(null);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!CODE_POSTAL_REGEX.test(codePostal.trim())) {
      setErreur("Code postal canadien invalide, format attendu : G1L 2M4.");
      return;
    }
    setErreur(null);
    setEnCours(true);
    try {
      const resultat = await rejoindreListeAttente({
        nom: nom.trim(),
        courriel: courriel.trim(),
        codePostal: codePostal.trim(),
        siteWeb,
        ...(pro ? { role: "pro", entreprise: entreprise.trim() } : {}),
      });
      setInscription({
        ville: resultat.data?.ville ?? null,
        confirmationRequise: resultat.data?.confirmationRequise !== false,
      });
    } catch {
      setErreur(
        pro
          ? "Quelque chose a bloqué. Vérifiez le nom de l'entreprise, le courriel et le code postal, puis réessayez."
          : "Quelque chose a bloqué. Vérifiez votre nom, votre courriel et votre code postal, puis réessayez.",
      );
    } finally {
      setEnCours(false);
    }
  }

  if (inscription && pro) {
    return (
      <div className="waitlist-form waitlist-form--succes">
        <span className="waitlist-form__succes-titre">C'est noté, merci !</span>
        <span className="waitlist-form__succes-texte">
          Votre entreprise est sur la liste Snowro Pro. Nous vous écrirons dès que les détails de l'offre sont prêts.
        </span>
      </div>
    );
  }

  if (inscription) {
    return (
      <div className="waitlist-form waitlist-form--succes">
        {inscription.confirmationRequise ? (
          <>
            <span className="waitlist-form__succes-titre">Vérifiez vos courriels</span>
            <span className="waitlist-form__succes-texte">
              Nous venons d'envoyer un lien à <strong>{courriel.trim()}</strong>. Cliquez dessus pour confirmer
              votre inscription : sans confirmation, elle est effacée après 7 jours.
            </span>
          </>
        ) : (
          <>
            <span className="waitlist-form__succes-titre">C'est noté, merci !</span>
            <span className="waitlist-form__succes-texte">
              Votre inscription est déjà confirmée. Nous vous écrirons dès l'ouverture dans votre secteur.
            </span>
          </>
        )}
        {intention ? (
          <>
            {intention !== "non_precise" && <span className="waitlist-form__intention-ok">✓ Merci, c'est noté.</span>}
            <PartageListe role={intention === "deneigeur" ? "deneigeur" : "client"} ville={inscription.ville} />
          </>
        ) : (
          <div className="waitlist-form__champ waitlist-form__intention">
            <span className="eyebrow waitlist-form__eyebrow">Facultatif : vous voulez plutôt…</span>
            <div className="waitlist-form__role">
              {INTENTIONS.map(([cle, libelle]) => (
                <button
                  key={cle}
                  type="button"
                  className="waitlist-form__role-bouton"
                  disabled={Boolean(envoiIntention)}
                  onClick={() => preciser(cle)}
                >
                  {envoiIntention === cle ? "Un instant…" : libelle}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn--lien waitlist-form__passer" onClick={() => setIntention("non_precise")}>
              Passer
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={onSubmit}>
      {pro && (
        <label className="waitlist-form__label">
          <span className="sr-only">Nom de l'entreprise</span>
          <input
            type="text"
            required
            minLength={2}
            maxLength={120}
            placeholder="Nom de l'entreprise"
            autoComplete="organization"
            value={entreprise}
            onChange={(e) => setEntreprise(e.target.value)}
            className="waitlist-form__input"
          />
        </label>
      )}

      <label className="waitlist-form__label">
        <span className="sr-only">Nom complet</span>
        <input
          type="text"
          required
          minLength={2}
          maxLength={120}
          placeholder="Nom complet"
          autoComplete="name"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="waitlist-form__input"
        />
      </label>

      <label className="waitlist-form__label">
        <span className="sr-only">Courriel</span>
        <input
          type="email"
          required
          placeholder="votre@courriel.com"
          value={courriel}
          onChange={(e) => setCourriel(e.target.value)}
          className="waitlist-form__input"
        />
      </label>

      <label className="waitlist-form__label">
        <span className="sr-only">{pro ? "Code postal de votre secteur principal" : "Code postal"}</span>
        <input
          type="text"
          required
          placeholder={pro ? "Code postal de votre secteur principal" : "Code postal (ex. G1L 2M4)"}
          value={codePostal}
          onChange={(e) => setCodePostal(e.target.value)}
          className="waitlist-form__input"
        />
      </label>

      {/* Honeypot anti-spam : masqué visuellement, un lecteur d'écran ne l'annonce
          pas (aria-hidden + tabIndex -1) — un bot qui remplit tous les champs le
          remplira, un humain ne le voit jamais. */}
      <label className="waitlist-form__honeypot" aria-hidden="true">
        Site web
        <input
          type="text"
          name="siteWeb"
          tabIndex={-1}
          autoComplete="off"
          value={siteWeb}
          onChange={(e) => setSiteWeb(e.target.value)}
        />
      </label>

      {erreur && <p className="message-erreur" role="alert">{erreur}</p>}

      <button type="submit" className="waitlist-form__bouton landing__bouton-neige landing__bouton-neige--f" disabled={enCours}>
        {enCours ? "Envoi…" : pro ? "Être averti pour Pro" : "Rejoindre la liste"}
      </button>
      <p className="waitlist-form__mention">
        {pro
          ? "Nous demandons votre secteur pour vous présenter en premier les données de votre région."
          : "Nous demandons votre code postal uniquement pour savoir quelle ville ouvrir en premier."}{" "}
        Détails dans la{" "}
        <Link to="/confidentialite">politique de confidentialité</Link>.
      </p>
    </form>
  );
}
