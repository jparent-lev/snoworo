import SnowroSymbol from "../../components/brand/SnowroSymbol";
import "./HeroIllustration.css";

// Illustration animée du héros : un déneigeur citoyen pellette devant un
// triplex de Limoilou pendant que son téléphone raconte la même job. Une seule
// boucle de 8 s (--hero-cycle) pilote la scène ET les écrans du téléphone, pour
// que les deux restent raccord :
//   0 à 33 %   demande reçue, puis acceptée (le bouton passe à « C'est à toi »)
//   34 à 63 %  pelletage : quatre coups de pelle, l'amas fond, barre de progression
//   64 à 80 %  paiement versé : bulle $ au-dessus du personnage
//   81 à 97 %  appréciation 5 étoiles, étincelles au-dessus de l'immeuble
// Les pourcentages sont repris tels quels dans HeroIllustration.css : en
// changer un, c'est le changer des deux côtés. Purement décoratif (aria-hidden).
// Montants cohérents avec le calculateur (45 $, frais 2 $ + 8 % = 5,60 $).

const FLOCONS = [
  { x: 30, r: 2.2, duree: 7, delai: -1 },
  { x: 92, r: 1.6, duree: 9, delai: -5 },
  { x: 150, r: 2.6, duree: 8, delai: -3 },
  { x: 214, r: 1.8, duree: 10, delai: -7 },
  { x: 262, r: 2.2, duree: 7.5, delai: -2 },
  { x: 318, r: 1.6, duree: 9.5, delai: -6 },
  { x: 372, r: 2.4, duree: 8.5, delai: -4 },
  { x: 430, r: 1.8, duree: 7, delai: -0.5 },
  { x: 488, r: 2.2, duree: 9, delai: -8 },
];

function Etoile({ x, y, taille = 1 }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${taille})`}
      d="M0 -9 L2.6 -2.8 L9.2 -2.8 L3.9 1.2 L5.9 7.6 L0 3.8 L-5.9 7.6 L-3.9 1.2 L-9.2 -2.8 L-2.6 -2.8 Z"
    />
  );
}

function Fenetre({ x, y }) {
  return (
    <g>
      <rect x={x} y={y} width="38" height="50" rx="3" className="hero-illu__vitre" />
      <line x1={x + 19} y1={y} x2={x + 19} y2={y + 50} className="hero-illu__meneau" />
      <rect x={x - 4} y={y + 49} width="46" height="6" rx="3" className="hero-illu__neige" />
    </g>
  );
}

function Balcon({ y }) {
  const barreaux = [];
  for (let x = 84; x <= 290; x += 12) barreaux.push(x);
  return (
    <g className="hero-illu__balcon">
      <rect x="76" y={y} width="220" height="6" rx="2" />
      <rect x="76" y={y - 28} width="220" height="4" rx="2" />
      {barreaux.map((x) => (
        <rect key={x} x={x} y={y - 26} width="2.4" height="26" />
      ))}
      <rect x="80" y={y - 33} width="212" height="5" rx="2.5" className="hero-illu__neige" />
    </g>
  );
}

export default function HeroIllustration() {
  return (
    <div className="hero-illu" aria-hidden="true">
      <svg className="hero-illu__scene" viewBox="0 0 520 400" preserveAspectRatio="xMinYMid slice">
        <defs>
          <clipPath id="hero-illu-cadre">
            <rect width="520" height="400" rx="22" />
          </clipPath>
        </defs>
        <g clipPath="url(#hero-illu-cadre)">
          <rect width="520" height="400" className="hero-illu__fond" />

          {/* Voisins attachés (rangée) */}
          <rect x="-10" y="96" width="82" height="240" className="hero-illu__voisin-gauche" />
          <rect x="12" y="130" width="34" height="46" rx="3" className="hero-illu__vitre hero-illu__vitre--voisin" />
          <rect x="12" y="214" width="34" height="46" rx="3" className="hero-illu__vitre hero-illu__vitre--voisin" />
          <rect x="300" y="110" width="240" height="226" className="hero-illu__voisin-droite" />
          <rect x="-10" y="84" width="86" height="8" rx="4" className="hero-illu__neige" />
          <rect x="296" y="104" width="244" height="8" rx="4" className="hero-illu__neige" />

          {/* Triplex principal */}
          <rect x="70" y="72" width="230" height="264" className="hero-illu__brique" />
          <rect x="64" y="62" width="242" height="14" rx="2" className="hero-illu__corniche" />
          <path d="M62 64 Q64 54 78 55 Q120 50 170 54 Q230 49 290 54 Q306 54 308 64 Z" className="hero-illu__neige" />

          <Fenetre x={96} y={94} />
          <Fenetre x={236} y={94} />
          <Fenetre x={96} y={180} />
          <Fenetre x={236} y={180} />
          <Fenetre x={96} y={266} />

          {/* Portes du rez-de-chaussée et de l'étage */}
          <rect x="166" y="100" width="36" height="58" rx="3" className="hero-illu__porte" />
          <rect x="166" y="186" width="36" height="58" rx="3" className="hero-illu__porte" />
          <rect x="150" y="272" width="30" height="60" rx="3" className="hero-illu__porte" />
          <rect x="190" y="272" width="30" height="60" rx="3" className="hero-illu__porte" />
          <rect x="236" y="266" width="38" height="50" rx="3" className="hero-illu__vitre" />

          <Balcon y={160} />
          <Balcon y={246} />

          {/* Escalier extérieur, typique de Limoilou */}
          <g className="hero-illu__escalier">
            <path d="M80 332 L140 250 L148 250 L88 332 Z" />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <rect key={i} x={86 + i * 8.2} y={318 - i * 11.4} width="16" height="3.4" rx="1" />
            ))}
          </g>

          {/* Étincelles de l'appréciation, au-dessus de l'immeuble */}
          <g className="hero-illu__etincelles">
            <Etoile x={124} y={34} taille={0.9} />
            <Etoile x={186} y={22} taille={1.2} />
            <Etoile x={246} y={36} taille={0.8} />
          </g>

          {/* Sol enneigé et amas devant les portes */}
          <rect x="0" y="330" width="520" height="80" className="hero-illu__sol" />
          <line x1="0" y1="330.5" x2="520" y2="330.5" className="hero-illu__ligne-sol" />
          <path
            d="M146 332 Q148 312 164 308 Q176 298 190 304 Q206 298 218 308 Q232 314 232 332 Z"
            className="hero-illu__neige hero-illu__amas"
          />

          {/* Personnage : tuque au S de Snowro, foulard, pelle à lame ocre (clin d'oeil au symbole) */}
          <g className="hero-illu__perso">
            <rect x="262" y="320" width="13" height="11" rx="3" className="hero-illu__botte" />
            <rect x="279" y="320" width="13" height="11" rx="3" className="hero-illu__botte" />
            <path d="M264 290 H290 V322 H279 V300 H276 V322 H264 Z" className="hero-illu__pantalon" />

            <g className="hero-illu__torse">
              <path d="M288 250 Q300 256 302 270 L304 280" className="hero-illu__foulard-pan" />
              <path d="M262 252 Q262 244 276 243 Q292 244 292 254 L294 294 H260 Z" className="hero-illu__manteau" />
              <rect x="261" y="244" width="32" height="9" rx="4.5" className="hero-illu__foulard" />
              <circle cx="274" cy="232" r="13" className="hero-illu__peau" />
              <circle cx="267" cy="231" r="1.6" className="hero-illu__oeil" />
              <path d="M261 222 Q262 205 276 205 Q289 206 288 222 Z" className="hero-illu__tuque" />
              <rect x="259" y="219" width="31" height="6" rx="3" className="hero-illu__tuque-rebord" />
              {/* S du symbole sur le devant de la tuque (le personnage regarde à gauche) */}
              <text x="269" y="218.6" textAnchor="middle" className="hero-illu__tuque-s">S</text>
              <circle cx="276" cy="203" r="5" className="hero-illu__pompon" />

              <g className="hero-illu__pelle">
                <line x1="282" y1="258" x2="243" y2="300" className="hero-illu__manche" />
                {/* Lame dans l'axe du manche (angle 132,7deg), fixée au bout par une
                    douille : dessinée à plat puis tournée autour de l'extrémité. */}
                <g transform="translate(243 300) rotate(132.7)">
                  {/* Lame de pelle à neige : col qui s'évase depuis la douille, rebord
                      arrière, puis la palette large qui s'avance vers le sol. */}
                  <path d="M3 -4 L12 -15.5 Q15 -17.5 17 -15.5 H24 Q27 -15.5 27 -12.5 V12.5 Q27 15.5 24 15.5 H17 Q15 17.5 12 15.5 L3 4 Z" className="hero-illu__lame" />
                  <rect x="15" y="-15.5" width="3" height="31" rx="1.5" className="hero-illu__lame-bord" />
                  <rect x="-3" y="-3" width="9" height="6" rx="2" className="hero-illu__douille" />
                </g>
              </g>
              <path d="M286 258 Q272 274 256 286" className="hero-illu__bras" />
              <path d="M280 256 Q270 264 264 277" className="hero-illu__bras" />
            </g>

            {/* Neige projetée, un jet par coup de pelle */}
            {[0, 1, 2, 3].map((i) => (
              <g key={i} className="hero-illu__jet" style={{ animationDelay: `${i * 0.56}s` }}>
                <circle cx="210" cy="312" r="3.2" />
                <circle cx="218" cy="307" r="2.4" />
                <circle cx="204" cy="305" r="2" />
              </g>
            ))}

            <g className="hero-illu__bulle">
              <path d="M258 192 L252 204 L266 196 Z" />
              <circle cx="262" cy="178" r="17" />
              <text x="262" y="185" textAnchor="middle">$</text>
            </g>
          </g>

          {FLOCONS.map((f) => (
            <circle
              key={f.x}
              cx={f.x}
              cy="-10"
              r={f.r}
              className="hero-illu__flocon"
              style={{ animationDuration: `${f.duree}s`, animationDelay: `${f.delai}s` }}
            />
          ))}
        </g>
      </svg>

      {/* Téléphone du déneigeur : ses écrans suivent la même boucle que la scène */}
      <div className="landing__hero-phone hero-illu__phone">
        <div className="landing__hero-phone-ecran">
          <div className="landing__hero-phone-entete">
            <div className="landing__hero-phone-logo">
              <SnowroSymbol variant="x" neige surTuile size={32} />
              <span>snowro</span>
            </div>
            <span className="landing__hero-phone-x">X</span>
          </div>

          <div className="landing__hero-phone-corps hero-illu__ecrans">
            {/* 1. Demande reçue, puis acceptée */}
            <div className="hero-illu__ecran hero-illu__ecran--demande">
              <div className="landing__hero-phone-carte">
                <span className="landing__hero-phone-surtitre">À 400 M · LIMOILOU</span>
                <span className="landing__hero-phone-titre">Entrée double + balcon</span>
                <span className="landing__hero-phone-desc">Avant 8 h demain matin.</span>
                <div className="landing__hero-phone-prix-ligne">
                  <span className="landing__hero-phone-prix">45 $</span>
                  <span className="landing__hero-phone-par">offert par Mireille G.</span>
                </div>
              </div>
              <div className="hero-illu__boutons">
                <span className="landing__hero-phone-bouton hero-illu__bouton hero-illu__bouton--prendre">Je prends la job</span>
                <span className="landing__hero-phone-bouton hero-illu__bouton hero-illu__bouton--prise">C'est à toi ✓</span>
              </div>
            </div>

            {/* 2. Pelletage en cours */}
            <div className="hero-illu__ecran hero-illu__ecran--cours">
              <div className="landing__hero-phone-carte">
                <span className="landing__hero-phone-surtitre">EN COURS · LIMOILOU</span>
                <span className="landing__hero-phone-titre">Entrée double + balcon</span>
                <div className="hero-illu__progression">
                  <span className="hero-illu__progression-barre" />
                </div>
                <span className="landing__hero-phone-desc">Mireille est avertie quand c'est fini.</span>
              </div>
              <span className="landing__hero-phone-note">Paiement gardé par Snowro jusqu'à ce que ce soit fait.</span>
            </div>

            {/* 3. Paiement versé */}
            <div className="hero-illu__ecran hero-illu__ecran--paye">
              <div className="landing__hero-phone-carte hero-illu__carte-centree">
                <span className="hero-illu__pastille">✓</span>
                <span className="landing__hero-phone-prix">39,40 $</span>
                <span className="landing__hero-phone-desc">versé dans ton compte</span>
                <span className="landing__hero-phone-par">45 $ moins les frais Snowro (5,60 $)</span>
              </div>
            </div>

            {/* 4. Appréciation */}
            <div className="hero-illu__ecran hero-illu__ecran--note">
              <div className="landing__hero-phone-carte hero-illu__carte-centree">
                <span className="landing__hero-phone-surtitre">JOB CONFIRMÉE FAITE</span>
                <svg className="hero-illu__etoiles" viewBox="0 0 110 20">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Etoile key={i} x={11 + i * 22} y={10.5} />
                  ))}
                </svg>
                <span className="landing__hero-phone-desc">Mireille t'a donné 5 étoiles.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
