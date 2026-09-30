import "./Decors.css";

// Éléments graphiques des sections du site vitrine, dans le même style plat
// que l'illustration du héros (HeroIllustration) : palette de marque, neige
// posée sur les choses, triplex de Limoilou. Tous décoratifs (aria-hidden) :
// le texte des sections porte déjà le sens.

/* ---- Neige posée ---- */

// Suite fixe (pas de Math.random) pour que le rendu soit identique à chaque
// chargement et d'un navigateur à l'autre.
const BOSSES = [7, 3, 9, 4, 11, 5, 2, 8, 6, 10, 3, 7, 5, 9, 4, 8, 2, 6, 10, 5];
const COULURES = { 3: 13, 8: 9, 13: 15, 17: 8 };

// Amas de neige posé sur un bord : bosses sur le dessus (sauf si plat) et
// quelques coulures qui descendent. S'étire en largeur (preserveAspectRatio
// none), ce qui reste naturel pour de la neige.
export function CapNeige({ plat = false, className = "" }) {
  const n = BOSSES.length;
  const pas = 1000 / n;
  let d = plat ? "M0 0 H1000" : `M0 16`;
  if (!plat) {
    BOSSES.forEach((h, i) => {
      const x = (i + 1) * pas;
      d += ` Q${x - pas / 2} ${14 - h} ${x} ${16 - (h % 4)}`;
    });
  }
  d += " L1000 22";
  for (let i = n - 1; i >= 0; i--) {
    const x = i * pas;
    const coulure = COULURES[i];
    d += coulure ? ` Q${x + pas / 2} ${22 + coulure * 2} ${x} 22` : ` Q${x + pas / 2} ${25} ${x} 22`;
  }
  d += " Z";
  return (
    <svg className={`decor-cap ${plat ? "decor-cap--plat" : ""} ${className}`} viewBox="0 0 1000 52" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/* ---- Flocons ---- */

function Flocon({ x, y, r, className }) {
  const branches = [0, 60, 120].map((a) => (
    <g key={a} transform={`rotate(${a})`}>
      <line x1={-r} y1="0" x2={r} y2="0" />
      <path d={`M${r * 0.55} 0 l${r * 0.22} ${-r * 0.2} M${r * 0.55} 0 l${r * 0.22} ${r * 0.2}`} />
      <path d={`M${-r * 0.55} 0 l${-r * 0.22} ${-r * 0.2} M${-r * 0.55} 0 l${-r * 0.22} ${r * 0.2}`} />
    </g>
  ));
  return (
    <g transform={`translate(${x} ${y})`} className={className}>
      {branches}
    </g>
  );
}

// Grands flocons en filigrane, posés dans un coin d'un bloc coloré.
export function FloconsFiligrane({ className = "" }) {
  return (
    <svg className={`decor-filigrane ${className}`} viewBox="0 0 300 300" aria-hidden="true">
      <Flocon x={220} y={70} r={58} />
      <Flocon x={90} y={200} r={30} />
      <Flocon x={250} y={230} r={20} />
    </svg>
  );
}

// Petits flocons qui tombent en continu sur un fond sombre.
const CHUTE = [
  { x: 4, t: 9, d: -2 }, { x: 13, t: 12, d: -8 }, { x: 22, t: 10, d: -5 },
  { x: 31, t: 13, d: -1 }, { x: 42, t: 11, d: -9 }, { x: 51, t: 9.5, d: -4 },
  { x: 60, t: 12.5, d: -7 }, { x: 69, t: 10.5, d: -3 }, { x: 78, t: 11.5, d: -10 },
  { x: 87, t: 9, d: -6 }, { x: 95, t: 13, d: -2.5 },
];

export function ChuteDeNeige() {
  return (
    <div className="decor-chute" aria-hidden="true">
      {CHUTE.map((f, i) => (
        <span
          key={f.x}
          className="decor-chute__flocon"
          style={{
            left: `${f.x}%`,
            animationDuration: `${f.t}s`,
            animationDelay: `${f.d}s`,
            width: `${4 + (i % 3) * 2}px`,
            height: `${4 + (i % 3) * 2}px`,
          }}
        />
      ))}
    </div>
  );
}

/* ---- Comment ça marche : une scène par étape ---- */

function Toit({ x, w, h, fill }) {
  return (
    <g>
      <rect x={x} y={70 - h} width={w} height={h} fill={fill} />
      <rect x={x - 1.5} y={68 - h} width={w + 3} height="4.5" rx="2.2" className="decor-neige" />
      <rect x={x + w * 0.22} y={78 - h} width={w * 0.2} height="7" rx="1" className="decor-vitre" />
      <rect x={x + w * 0.58} y={78 - h} width={w * 0.2} height="7" rx="1" className="decor-vitre" />
    </g>
  );
}

export function IllustrationEtape({ etape }) {
  return (
    <svg className={`decor-etape decor-etape--${etape}`} viewBox="0 0 96 72" aria-hidden="true">
      <circle cx="48" cy="38" r="33" className="decor-etape__fond" />
      {etape === 1 && (
        <g>
          <rect x="31" y="10" width="34" height="56" rx="7" className="decor-terre" />
          <rect x="34.5" y="17" width="27" height="42" rx="3.5" className="decor-ecran" />
          <rect x="38" y="36" width="20" height="3" rx="1.5" className="decor-ligne" />
          <rect x="38" y="42" width="14" height="3" rx="1.5" className="decor-ligne" />
          <rect x="38" y="49" width="20" height="6" rx="3" className="decor-argile" />
          <g className="decor-epingle-tombe">
            <path d="M48 32 C42 25 41 21 41 19 A7 7 0 0 1 55 19 C55 21 54 25 48 32 Z" className="decor-argile" />
            <circle cx="48" cy="19" r="2.6" className="decor-ecran" />
          </g>
        </g>
      )}
      {etape === 2 && (
        <g>
          <circle cx="48" cy="26" r="9" className="decor-onde" />
          <circle cx="48" cy="26" r="9" className="decor-onde decor-onde--2" />
          <path d="M48 36 C42 29 41 25 41 23 A7 7 0 0 1 55 23 C55 25 54 29 48 36 Z" className="decor-argile" />
          <circle cx="48" cy="23" r="2.6" className="decor-ecran" />
          <Toit x={16} w={20} h={24} fill="var(--color-argile-foncee)" />
          <Toit x={37} w={22} h={30} fill="var(--color-argile)" />
          <Toit x={60} w={20} h={22} fill="var(--color-ardoise)" />
        </g>
      )}
      {etape === 3 && (
        <g>
          <line x1="64" y1="12" x2="44" y2="44" className="decor-manche" />
          <g transform="translate(44 44) rotate(122)">
            <path d="M2 -3 L9 -11.5 Q11 -13 12.5 -11.5 H17 Q19.5 -11.5 19.5 -9 V9 Q19.5 11.5 17 11.5 H12.5 Q11 13 9 11.5 L2 3 Z" className="decor-ocre" />
            <rect x="9" y="-5" width="8.5" height="2" rx="1" className="decor-lame-bord" />
            <rect x="9" y="3" width="8.5" height="2" rx="1" className="decor-lame-bord" />
            <rect x="-2.5" y="-2.5" width="7" height="5" rx="1.5" className="decor-terre" />
          </g>
          <ellipse cx="34" cy="64" rx="15" ry="4" className="decor-neige-sol" />
          <g className="decor-pastille-pop">
            <circle cx="66" cy="46" r="11" className="decor-ardoise" />
            <path d="M61 46 L64.5 49.5 L71 42.5" className="decor-crochet" />
          </g>
        </g>
      )}
    </svg>
  );
}

/* ---- Icônes (bloc « Ce qui te protège », profils de déneigeurs) ---- */

const ICONES = {
  note: (
    <path
      d="M12 3.2 L14.6 8.9 L20.8 9.5 L16.1 13.6 L17.5 19.7 L12 16.5 L6.5 19.7 L7.9 13.6 L3.2 9.5 L9.4 8.9 Z"
      className="decor-icone__plein-ocre"
    />
  ),
  entente: (
    <g className="decor-icone__trait">
      <path d="M6.5 3.5 H14.5 L18.5 7.5 V20.5 H6.5 Z" />
      <path d="M14.5 3.5 V7.5 H18.5" />
      <path d="M9 11 H16 M9 14.5 H13" />
      <path d="M11 17.8 L12.8 19.4 L16.4 15.8" className="decor-icone__trait-argile" />
    </g>
  ),
  cadenas: (
    <g className="decor-icone__trait">
      <rect x="5.5" y="10.5" width="13" height="10" rx="2.5" />
      <path d="M8.5 10.5 V8 A3.5 3.5 0 0 1 15.5 8 V10.5" />
      <circle cx="12" cy="15.3" r="1.4" className="decor-icone__plein-terre" />
    </g>
  ),
  etudiant: (
    <g className="decor-icone__trait">
      <path d="M2.8 9.5 L12 5.2 L21.2 9.5 L12 13.8 Z" />
      <path d="M7 11.6 V15.6 Q12 19 17 15.6 V11.6" />
      <path d="M21.2 9.5 V14.5" />
    </g>
  ),
  souffleuse: (
    <g className="decor-icone__trait">
      <path d="M4 17 V11 H13 V17 Z" />
      <path d="M13 13 H16 L19.5 5.5" />
      <path d="M17.5 5 L21 6.5" />
      <circle cx="7" cy="19" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
      <path d="M2.5 16 H4" />
    </g>
  ),
  camion: (
    <g className="decor-icone__trait">
      <path d="M8 16.5 V8.5 H15 L18 12 H20.5 V16.5 Z" />
      <path d="M8 16.5 H6.5 L3 18.5 V12.5 L6.5 13 H8" />
      <circle cx="11" cy="17.5" r="1.8" />
      <circle cx="17.5" cy="17.5" r="1.8" />
    </g>
  ),
};

export function Icone({ nom, className = "" }) {
  return (
    <span className={`decor-icone ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24">{ICONES[nom]}</svg>
    </span>
  );
}

/* ---- Villes émergentes : le fleuve et les épingles ---- */

function Epingle({ x, y, nom, delai, fantome = false }) {
  return (
    <g className={fantome ? "decor-villes__fantome" : "decor-villes__epingle"} style={{ animationDelay: `${delai}s` }}>
      {fantome && <circle cx={x} cy={y - 9} r="13" className="decor-villes__halo" />}
      <path
        d={`M${x} ${y} C${x - 6} ${y - 7} ${x - 7} ${y - 11} ${x - 7} ${y - 13} A7 7 0 0 1 ${x + 7} ${y - 13} C${x + 7} ${y - 11} ${x + 6} ${y - 7} ${x} ${y} Z`}
      />
      <circle cx={x} cy={y - 13} r="2.6" className="decor-villes__centre" />
      <text x={x} y={y + 14} textAnchor="middle" className="decor-villes__nom">
        {nom}
      </text>
    </g>
  );
}

export function CarteVilles() {
  return (
    <svg className="decor-villes" viewBox="0 0 320 124" aria-hidden="true">
      <path d="M-5 112 C60 102 92 88 132 78 S212 56 252 42 S300 24 325 16" className="decor-villes__fleuve" />
      <Epingle x={62} y={92} nom="Montréal" delai={0} />
      <Epingle x={152} y={66} nom="Trois-Rivières" delai={0.5} />
      <Epingle x={258} y={34} nom="Québec" delai={1} />
      <Epingle x={214} y={104} nom="la tienne ?" delai={0} fantome />
    </svg>
  );
}

/* ---- Snowro Pro : aperçu d'un tableau de zones ---- */

// Intensité de la demande par zone (0 à 4), valeurs d'exemple.
const ZONES = ["01122100", "12343210", "01244321", "00123210", "00011100"];
const HEX = "M0 -15 L13 -7.5 L13 7.5 L0 15 L-13 7.5 L-13 -7.5 Z";

export function ApercuZonesPro() {
  const hexes = [];
  ZONES.forEach((ligne, r) => {
    [...ligne].forEach((v, c) => {
      const x = 22 + c * 26 + (r % 2) * 13;
      const y = 22 + r * 22.5;
      hexes.push({ x, y, v: Number(v), cle: `${r}-${c}` });
    });
  });
  const vedette = { x: 22 + 3 * 26, y: 22 + 2 * 22.5 };

  return (
    <div className="decor-zones" aria-hidden="true">
      <div className="decor-zones__entete">
        <span className="eyebrow decor-zones__eyebrow">Demande cette semaine</span>
        <span className="decor-zones__exemple">Exemple</span>
      </div>
      <svg viewBox="0 0 232 140" className="decor-zones__carte">
        {hexes.map((h) => (
          <path
            key={h.cle}
            d={HEX}
            transform={`translate(${h.x} ${h.y})`}
            className={`decor-zones__hex decor-zones__hex--${h.v}`}
          />
        ))}
        <path d={HEX} transform={`translate(${vedette.x} ${vedette.y})`} className="decor-zones__vedette" />
      </svg>
      <div className="decor-zones__bulle">
        <span className="decor-zones__bulle-code">G1L · Limoilou</span>
        <span className="decor-zones__bulle-chiffre">42 demandes</span>
        <span className="decor-zones__bulle-tendance">+18 % vs semaine passée</span>
      </div>
      <div className="decor-zones__legende">
        <span>Moins</span>
        <span className="decor-zones__degrade" />
        <span>Plus</span>
      </div>
    </div>
  );
}

/* ---- Pied de page : toits enneigés ---- */

const LARGEURS = [118, 92, 134, 104, 124, 88, 142, 98, 116, 130, 94, 120, 108, 136, 100];
const HAUTEURS = [56, 70, 48, 76, 60, 52, 72, 58, 66, 50, 74, 62, 54, 68, 58];

export function SilhouetteToits() {
  const blocs = [];
  let x = -20;
  let i = 0;
  while (x < 1460) {
    const w = LARGEURS[i % LARGEURS.length];
    const h = HAUTEURS[i % HAUTEURS.length];
    blocs.push({ x, w, h, i });
    x += w;
    i += 1;
  }
  return (
    <svg className="decor-toits" viewBox="0 0 1440 90" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {blocs.map(({ x: bx, w, h, i: n }) => (
        <g key={n}>
          <rect x={bx} y={90 - h} width={w + 1} height={h} className="decor-toits__bati" />
          <rect x={bx - 2} y={90 - h - 4} width={w + 4} height="6" rx="3" className="decor-toits__neige" />
          {/* Cheminée dessinée après la neige du toit pour qu'elle y soit posée. */}
          {n % 3 === 1 && <rect x={bx + w * 0.7} y={90 - h - 16} width="10" height="14" className="decor-toits__bati" />}
          {n % 3 === 1 && <rect x={bx + w * 0.7 - 1.5} y={90 - h - 19} width="13" height="4.5" rx="2.2" className="decor-toits__neige" />}
          {[0.2, 0.46, 0.72].map((p, k) =>
            (n + k) % 4 === 0 ? (
              <rect key={p} x={bx + w * p} y={90 - h + 16} width="12" height="15" rx="1.5" className="decor-toits__fenetre" />
            ) : null,
          )}
        </g>
      ))}
    </svg>
  );
}
