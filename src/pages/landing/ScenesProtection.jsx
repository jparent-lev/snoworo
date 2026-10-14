import "./ScenesProtection.css";

// Scènes du bloc « Ce qui vous protège » : le personnage de l'illustration du
// héros (tuque au S, foulard ocre) en buste, avec l'accessoire de chaque
// garantie : une note à étoiles, une entente écrite, un paiement sécurisé.
// Les coordonnées du personnage sont celles de HeroIllustration (corps entre
// x 259–294 et y 198–294) ; chaque scène le place et l'agrandit.

function Personnage({ x, y, echelle = 1.15, bras }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${echelle}) translate(-276 -294)`}>
      <path d="M262 252 Q262 244 276 243 Q292 244 292 254 L294 294 H260 Z" fill="var(--color-ardoise)" />
      <path d="M288 250 Q300 256 302 270 L304 280" className="scene__pan" />
      <rect x="261" y="244" width="32" height="9" rx="4.5" fill="var(--color-ocre)" />
      <circle cx="274" cy="232" r="13" fill="#E7C39E" />
      <circle cx="267" cy="231" r="1.6" fill="var(--color-terre)" />
      <path d="M270 237 Q274 240 278 237" className="scene__sourire" />
      <path d="M261 222 Q262 205 276 205 Q289 206 288 222 Z" fill="var(--color-argile)" />
      <rect x="259" y="219" width="31" height="6" rx="3" fill="var(--color-argile-foncee)" />
      <text x="269" y="218.6" textAnchor="middle" className="scene__s">S</text>
      <circle cx="276" cy="203" r="5" fill="var(--color-surface-carte)" />
      {bras}
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
  return (
    <>
      <Personnage
        x={52}
        y={118}
        bras={<path d="M286 258 Q300 270 312 268" fill="none" stroke="var(--color-ardoise)" strokeWidth="8" strokeLinecap="round" />}
      />
      {/* L'entente écrite : feuille tenue devant soi, avec sa coche. */}
      <g className="scene__feuille">
        <rect x="100" y="20" width="66" height="84" rx="8" fill="var(--color-surface-carte)" />
        <rect x="111" y="34" width="38" height="5" rx="2.5" fill="var(--color-lin)" />
        <rect x="111" y="46" width="44" height="4" rx="2" fill="var(--color-lin)" />
        <rect x="111" y="56" width="30" height="4" rx="2" fill="var(--color-lin)" />
        <circle cx="146" cy="84" r="11" fill="var(--color-argile)" />
        <path d="M140 84 L144.5 88.5 L152 80" className="scene__coche" />
        <path d="M110 90 q5 -8 10 0 t10 0" className="scene__signature" />
      </g>
    </>
  );
}

function ScenePaiement() {
  return (
    <>
      <Personnage x={52} y={118} />
      {/* Le paiement retenu : cadenas, pièce qui flotte, jusqu'à confirmation. */}
      <g className="scene__cadenas">
        <path d="M112 62 V50 a19 19 0 0 1 38 0 V62" className="scene__anse" />
        <rect x="102" y="60" width="58" height="46" rx="11" fill="var(--color-surface-carte)" />
        <circle cx="131" cy="80" r="5.5" fill="var(--color-argile)" />
        <rect x="128.5" y="82" width="5" height="12" rx="2.5" fill="var(--color-argile)" />
      </g>
      <g className="scene__piece">
        <circle cx="172" cy="30" r="14" fill="var(--color-ocre)" />
        <circle cx="172" cy="30" r="10" className="scene__piece-bord" />
        <text x="172" y="35" textAnchor="middle" className="scene__piece-texte">$</text>
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
