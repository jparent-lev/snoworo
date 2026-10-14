import "./ScenesProtection.css";

// Scènes du bloc « Ce qui vous protège » : le personnage de l'illustration du
// héros (tuque au S, foulard ocre) en buste, avec l'accessoire de chaque
// garantie : une note à étoiles, une entente écrite, un paiement sécurisé.
// Les coordonnées du personnage sont celles de HeroIllustration (corps entre
// x 259–294 et y 198–294) ; chaque scène le place et l'agrandit.

// Le déneigeur (tuque au S, foulard ocre) ou le client (tuque ardoise, foulard
// lin), éventuellement retourné pour regarder vers la droite.
const VARIANTES = {
  deneigeur: { manteau: "var(--color-ardoise)", foulard: "var(--color-ocre)", tuque: "var(--color-argile)", rebord: "var(--color-argile-foncee)", s: true },
  client: { manteau: "var(--color-argile-foncee)", foulard: "var(--color-lin)", tuque: "var(--color-ardoise)", rebord: "var(--color-terre)", s: false },
};

function Personnage({ x, y, echelle = 1.15, variante = "deneigeur", miroir = false }) {
  const v = VARIANTES[variante];
  const sens = miroir ? -1 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${echelle * sens} ${echelle}) translate(-276 -294)`}>
      <path d="M262 252 Q262 244 276 243 Q292 244 292 254 L294 294 H260 Z" fill={v.manteau} />
      <path d="M288 250 Q300 256 302 270 L304 280" className="scene__pan" stroke={v.foulard} />
      <rect x="261" y="244" width="32" height="9" rx="4.5" fill={v.foulard} />
      <circle cx="274" cy="232" r="13" fill="#E7C39E" />
      <circle cx="267" cy="231" r="1.6" fill="var(--color-terre)" />
      <path d="M270 237 Q274 240 278 237" className="scene__sourire" />
      <path d="M261 222 Q262 205 276 205 Q289 206 288 222 Z" fill={v.tuque} />
      <rect x="259" y="219" width="31" height="6" rx="3" fill={v.rebord} />
      {v.s && (
        <text x="269" y="218.6" textAnchor="middle" className="scene__s">S</text>
      )}
      <circle cx="276" cy="203" r="5" fill="var(--color-surface-carte)" />
    </g>
  );
}

const ETOILE = "M0 -8 L2.4 -2.5 L8 -2 L3.8 1.8 L5 7.6 L0 4.6 L-5 7.6 L-3.8 1.8 L-8 -2 L-2.4 -2.5 Z";

function SceneNotes() {
  return (
    <>
      {/* La note publique : carte d'appréciation à côté du déneigeur. */}
      <g className="scene__carte-note">
        <rect x="88" y="26" width="92" height="58" rx="12" fill="var(--color-surface-carte)" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`translate(${104 + i * 17} 46)`}>
            <path d={ETOILE} className="scene__etoile" style={{ animationDelay: `${i * 0.18}s` }} />
          </g>
        ))}
        <text x="134" y="73" textAnchor="middle" className="scene__note-texte">4,8 · 23 demandes</text>
      </g>
      <Personnage x={52} y={118} />
    </>
  );
}

function SceneEntente() {
  const bras = { fill: "none", strokeWidth: 8, strokeLinecap: "round" };
  return (
    <>
      {/* Le déneigeur (à gauche) et le client (à droite) de part et d'autre du contrat. */}
      <Personnage x={36} y={118} miroir />
      <Personnage x={164} y={118} variante="client" />
      <path d="M46 72 Q62 76 78 66" stroke="var(--color-ardoise)" {...bras} />
      <path d="M154 72 Q138 76 122 66" stroke="var(--color-argile-foncee)" {...bras} />
      <g className="scene__feuille">
        <rect x="72" y="24" width="56" height="74" rx="7" fill="var(--color-surface-carte)" />
        <rect x="81" y="35" width="32" height="4.5" rx="2.25" fill="var(--color-lin)" />
        <rect x="81" y="45" width="38" height="3.5" rx="1.75" fill="var(--color-lin)" />
        <rect x="81" y="53" width="26" height="3.5" rx="1.75" fill="var(--color-lin)" />
        <path d="M81 72 q4 -7 8 0 t8 0" className="scene__signature" />
        <path d="M105 72 q4 -7 8 0 t8 0" className="scene__signature scene__signature--client" />
        <circle cx="100" cy="88" r="8" fill="var(--color-argile)" />
        <path d="M95.5 88 L99 91.5 L105 84.5" className="scene__coche" />
      </g>
      {/* Poignée de main : les mains se rejoignent sous le contrat. */}
      <circle cx="100" cy="104" r="6" fill="#E7C39E" />
    </>
  );
}

function ScenePaiement() {
  return (
    <>
      <text x="30" y="19" textAnchor="middle" className="scene__etiquette">Vous payez</text>
      <text x="100" y="19" textAnchor="middle" className="scene__etiquette">Snowro retient</text>
      <text x="170" y="19" textAnchor="middle" className="scene__etiquette">Versé après</text>

      {/* Vous : la carte enregistrée. */}
      <g className="scene__carte-bancaire">
        <rect x="8" y="46" width="44" height="30" rx="6" fill="var(--color-surface-carte)" />
        <rect x="8" y="53" width="44" height="6" fill="var(--color-terre)" />
        <rect x="14" y="66" width="16" height="3" rx="1.5" fill="var(--color-lin)" />
        <rect x="14" y="71" width="10" height="2.5" rx="1.25" fill="var(--color-lin)" />
      </g>

      {/* Snowro : le montant est retenu en lieu sûr. */}
      <g className="scene__coffre">
        <path d="M100 34 L124 42 V62 C124 78 113 88 100 94 C87 88 76 78 76 62 V42 Z" fill="var(--color-ardoise)" />
        <path d="M100 41 L118 47 V62 C118 74 110 82 100 87 C90 82 82 74 82 62 V47 Z" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" />
        <rect x="90" y="58" width="20" height="16" rx="4" fill="var(--color-surface-carte)" />
        <path d="M94 58 V54 a6 6 0 0 1 12 0 V58" fill="none" stroke="var(--color-surface-carte)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="66" r="2.6" fill="var(--color-argile)" />
      </g>

      {/* Le déneigeur reçoit le paiement une fois la demande confirmée. */}
      <Personnage x={168} y={118} echelle={1} miroir />
      <circle cx="184" cy="48" r="10" fill="var(--color-ardoise)" />
      <path d="M179 48 L183 52 L190 44" className="scene__coche" />

      <path d="M56 62 H72" className="scene__trajet" />
      <path d="M128 62 H146" className="scene__trajet" />
      <g className="scene__voyage">
        <circle cx="38" cy="62" r="7" fill="var(--color-ocre)" />
        <text x="38" y="65.5" textAnchor="middle" className="scene__piece-texte scene__piece-texte--petit">$</text>
      </g>
    </>
  );
}

const SCENES = { notes: SceneNotes, entente: SceneEntente, paiement: ScenePaiement };

export default function SceneProtection({ nom }) {
  const Scene = SCENES[nom];
  return (
    <svg className={`scene scene--${nom}`} viewBox="0 0 200 124" aria-hidden="true">
      <rect width="200" height="124" rx="18" className="scene__fond" />
      <ellipse cx="100" cy="116" rx="84" ry="9" className="scene__neige" />
      <Scene />
    </svg>
  );
}
