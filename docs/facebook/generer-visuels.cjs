const { chromium } = require('playwright');
const fs = require('fs');
const D = __dirname;
const img = (f) => `file://${D}/el/${f}`;
const POLICES = `<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,900&family=Karla:wght@400;500;700&display=swap" rel="stylesheet">`;
const CSS = `
*{box-sizing:border-box;margin:0}
body{font-family:Karla,sans-serif;color:#3B2A1F;background:#F7F1E6}
.f{font-family:Fraunces,serif}
.cadre{position:relative;overflow:hidden;background:#F7F1E6}
.flocons{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle,#E4D7C0 3px,transparent 3.5px),radial-gradient(circle,#EDE0CC 2px,transparent 2.5px);background-size:140px 140px,90px 90px;background-position:20px 30px,70px 60px;opacity:.55}
.logo{display:flex;align-items:center;gap:16px}
.logo img{width:64px;height:64px}
.logo span{font-family:Fraunces,serif;font-weight:900;font-size:40px;letter-spacing:-.01em}
.sur{display:inline-block;font-weight:700;font-size:24px;letter-spacing:.14em;text-transform:uppercase;color:#C1652F}
.titre{font-family:Fraunces,serif;font-weight:600;letter-spacing:-.015em;line-height:1.04}
.texte{font-size:30px;line-height:1.4;color:#6B5445}
.pastille{display:inline-flex;align-items:center;gap:10px;background:#C1652F;color:#FFFDF8;font-weight:700;font-size:28px;padding:16px 30px;border-radius:999px}

.pied-note{color:#6B5445}
.sombre .logo span,.sombre .titre{color:#FFFDF8}
.sombre .texte{color:#E4D7C0}
.sombre .sur{color:#D9A544}
.sombre .pied-note{color:#E4D7C0}
.tel{position:absolute;left:556px;top:330px;width:490px;height:820px;background:#3B2A1F;border-radius:64px;padding:16px;box-shadow:0 40px 80px -30px rgba(59,42,31,.75)}
.tel::before{content:'';position:absolute;inset:16px;background:#F7F1E6;border-radius:50px}
.tel>*{position:relative}
.tel__ile{width:130px;height:34px;background:#3B2A1F;border-radius:20px;margin:16px auto 0}
.tel__tete{display:flex;align-items:center;gap:10px;margin:26px 26px 0}
.tel__tete img{width:34px;height:34px}.tel__tete span{font-family:Fraunces,serif;font-weight:900;font-size:26px}
.tel__carte{margin:20px 18px 0;background:#FFFDF8;border:2px solid #E4D7C0;border-radius:24px;padding:22px 20px;box-shadow:0 14px 30px -20px rgba(59,42,31,.5)}
.tel__pas{font-weight:700;font-size:19px;padding:7px 14px;border-radius:10px;background:#EDE0CC}
.tel__pas--ok{background:#DCE6E8;color:#4F6B72;letter-spacing:.08em;text-transform:uppercase}
.tel__qui{display:flex;align-items:center;gap:14px;margin:22px 26px 0}
.tel__av{width:52px;height:52px;border-radius:50%;background:#D9A544;color:#3B2A1F;display:grid;place-items:center;font-weight:700;font-size:24px}
.tel__bulle{margin:14px 26px 0 92px;background:#FFFDF8;border:2px solid #E4D7C0;border-radius:20px 20px 20px 6px;padding:14px 18px;font-size:21px;line-height:1.35}
.tel__ecrire{margin:22px 18px 0;border:2px solid #E4D7C0;border-radius:999px;padding:14px 22px;font-size:20px;color:#6B5445;background:#FFFDF8}
.carte{background:#FFFDF8;border:2px solid #E4D7C0;border-radius:28px;box-shadow:0 30px 60px -36px rgba(59,42,31,.55)}
`;
const page = (corps, w, h) => `<!doctype html><html><head><meta charset="utf-8">${POLICES}<style>${CSS}</style></head><body><div class="cadre" style="width:${w}px;height:${h}px">${corps}</div></body></html>`;

// Gabarit de publication carrée : logo, surtitre, titre, visuel, pied.
const pub = ({ sur, titre, taille = 78, visuel, texte, fond, sombre }) => `
${fond ?? '<div class="flocons"></div>'}
<div class="${sombre ? 'sombre' : ''}" style="position:absolute;inset:0;padding:72px 80px;display:flex;flex-direction:column">
  <div class="logo"><img src="${img('symbole.png')}"><span>snowro</span></div>
  <div style="margin-top:44px"><span class="sur">${sur}</span></div>
  <h1 class="titre" style="font-size:${taille}px;margin-top:16px">${titre}</h1>
  ${texte ? `<p class="texte" style="margin-top:22px">${texte}</p>` : ''}
  <div style="flex:1;display:flex;align-items:center;justify-content:center;min-height:0;margin-top:30px">${visuel}</div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:28px">
    <span class="pastille">snowro.com</span>
    <span class="pied-note" style="font-size:24px;font-weight:500">Inscription gratuite</span>
  </div>
</div>`;

const prix = (l, p) => `<div class="carte" style="padding:34px 40px;width:410px"><div style="font-weight:700;font-size:26px;color:#4F6B72;letter-spacing:.1em;text-transform:uppercase">${l}</div><div class="f" style="font-weight:900;font-size:76px;margin-top:10px">${p}</div></div>`;
const video = (f, h = 430) => `<div style="position:relative;border-radius:28px;overflow:hidden;box-shadow:0 30px 60px -30px rgba(59,42,31,.6)"><img src="${img(f)}" style="display:block;height:${h}px"><div style="position:absolute;inset:0;display:grid;place-items:center"><div style="width:120px;height:120px;border-radius:50%;background:rgba(255,253,248,.92);display:grid;place-items:center"><div style="width:0;height:0;border-left:40px solid #C1652F;border-top:25px solid transparent;border-bottom:25px solid transparent;margin-left:10px"></div></div></div></div>`;

const visuels = {
  'profil': [page(`<div style="position:absolute;inset:0;background:#EDE0CC;display:grid;place-items:center"><img src="${img('symbole.png')}" style="width:620px"></div>`, 720, 720), 720, 720],
  'couverture': [page(`<div class="flocons"></div>
    <div style="position:absolute;left:290px;top:0;bottom:0;width:470px;display:flex;flex-direction:column;justify-content:center;gap:20px">
      <div class="logo"><img src="${img('symbole.png')}"><span>snowro</span></div>
      <h1 class="titre" style="font-size:64px;line-height:1.02">Trouvez<br>un déneigeur<br>de quartier.</h1>
      <p class="texte" style="font-size:26px">Ou déneigez près de chez vous<br>et soyez rémunéré.</p>
    </div>
    <div style="position:absolute;right:270px;top:147px"><div style="border-radius:28px;overflow:hidden;box-shadow:0 30px 60px -30px rgba(59,42,31,.6)"><img src="${img('video-bref.jpg')}" style="display:block;height:330px"></div></div>`, 1640, 624), 1640, 624],
  '01-lancement': [`
    <div class="flocons"></div>
    <div style="position:absolute;left:0;right:0;top:360px;bottom:0;background:url('${img('video-bref.jpg')}') -240px 0/1280px 720px no-repeat"></div>
    <div style="position:absolute;left:0;right:0;top:355px;height:170px;background:linear-gradient(#F7F1E6 10%,rgba(247,241,230,0))"></div>
    <div style="position:absolute;left:80px;top:72px;right:80px">
      <div class="logo"><img src="${img('symbole.png')}"><span>snowro</span></div>
      <div style="margin-top:34px"><span class="sur">Inscrivez-vous</span></div>
      <h1 class="titre" style="font-size:70px;margin-top:12px">Trouvez un déneigeur<br>de quartier.</h1>
    </div>
    <div class="tel">
      <div class="tel__ile"></div>
      <div class="tel__tete"><img src="${img('symbole.png')}"><span>snowro</span></div>
      <div class="tel__carte">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div><div class="f" style="font-weight:700;font-size:29px;white-space:nowrap">Entrée + balcon</div><div style="font-size:22px;color:#6B5445;margin-top:4px">Limoilou, à 400 m</div></div>
          <div style="text-align:right"><div class="f" style="font-weight:900;font-size:42px;line-height:1">45 $</div><div style="font-size:19px;color:#6B5445;margin-top:6px;white-space:nowrap">39,40 $ pour vous</div></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px"><span class="tel__pas">Avant 9 h</span><span class="tel__pas tel__pas--ok">Acceptée</span></div>
      </div>
      <div class="tel__qui">
        <div class="tel__av">J</div>
        <div style="flex:1"><div style="font-weight:700;font-size:23px">Julie, votre voisine</div><div style="font-size:19px;color:#6B5445">a publié la demande</div></div>
      </div>
      <div class="tel__bulle">Merci ! L'entrée est du côté gauche.</div>
      <div class="tel__ecrire">Écrire à Julie…</div>
    </div>
    <div style="position:absolute;left:80px;bottom:64px"><span class="pastille" style="box-shadow:0 14px 30px -14px rgba(59,42,31,.7)">snowro.com</span></div>
  `],
  '02a-comment-1': [pub({ sur: 'Comment ça marche · 1 sur 3', titre: 'Vous publiez votre demande.', visuel: `<img src="${img('etape1.png')}" style="height:600px">` })],
  '02b-comment-2': [pub({ sur: 'Comment ça marche · 2 sur 3', titre: 'Un voisin accepte.', visuel: `<img src="${img('etape2.png')}" style="height:600px">` })],
  '02c-comment-3': [pub({ sur: 'Comment ça marche · 3 sur 3', titre: "C'est pelleté, c'est payé.", visuel: `<img src="${img('etape3.png')}" style="height:600px">` })],
  '03-deneiger': [pub({ sur: 'Vous avez une pelle et du temps ?', titre: "Gagnez de l'argent avec la tempête.", texte: 'Vos heures, vos demandes. Aucune entreprise requise.', visuel: `<img src="${img('revenus.png')}" style="height:390px">`, fond: '<div style="position:absolute;inset:0;background:#3B2A1F"></div>', sombre: true })],
  '04-combien-offrir': [pub({ sur: 'Autour de Québec', titre: 'Combien offrir pour un déneigement ?', visuel: `<div style="display:flex;gap:28px">${prix('Entrée simple', '25 à 35 $')}${prix('Double + balcon', '45 à 60 $')}</div>`, texte: "C'est vous qui décidez. Personne n'accepte ? Augmentez votre offre en tout temps." })],
  '05-confiance': [pub({ sur: 'Mieux que le groupe du quartier', titre: 'Vous savez avec qui vous traitez.', taille: 66, visuel: `<div style="display:flex;flex-direction:column;gap:10px">${[1,2,3].map(i => `<img src="${img(`protection${i}.png`)}" style="height:196px">`).join('')}</div>` })],
  '06-photos': [pub({ sur: 'Fini les doutes', titre: "C'est fait ? Les photos le prouvent.", taille: 60, visuel: `<div style="display:flex;align-items:center;gap:36px"><img src="${img('carte.png')}" style="height:540px;border-radius:24px"><p class="texte" style="width:360px">De 1 à 3 photos du travail terminé. Vous avez <b style="color:#3B2A1F">12 heures</b> pour confirmer ou signaler un problème.</p></div>` })],
  '07-bordee': [pub({ sur: 'Bordée annoncée', titre: 'Publiez votre demande dès ce soir.', taille: 88, texte: 'Les déneigeurs de quartier la voient tout de suite et la prennent avant la tempête.', visuel: `<div style="display:flex;gap:40px;align-items:flex-end">${[150,220,150].map(t => `<div style="font-size:${t}px;line-height:1;color:#FFFDF8;font-family:Fraunces,serif">❄</div>`).join('')}</div>`, fond: '<div style="position:absolute;inset:0;background:#4F6B72"></div><div class="flocons" style="opacity:.25"></div>', sombre: true })],
  '08-proche': [pub({ sur: 'Pour un proche', titre: "Vos parents ont du mal avec l'escalier cet hiver ?", taille: 70, texte: "Publiez une demande pour l'adresse d'un proche et suivez tout depuis votre téléphone.", visuel: `<div style="border-radius:28px;overflow:hidden;box-shadow:0 30px 60px -30px rgba(59,42,31,.6)"><img src="${img('video-faire.jpg')}" style="display:block;height:330px"></div>` })],
  '09-frais': [pub({ sur: 'Aucune surprise', titre: 'Nos frais, en toutes lettres.', texte: 'Pour vous qui faites déneiger : le montant offert, rien de plus. Aucun abonnement.', visuel: `<img src="${img('frais.png')}" style="width:840px">` })],
  '10-partout': [pub({ sur: 'Partout au Québec', titre: 'Votre ville sur la carte ?', texte: "Votre ville apparaît dès qu'une personne s'y inscrit. Partagez à un voisin qui a une pelle !", visuel: `<div class="carte" style="padding:30px 40px"><img src="${img('villes.png')}" style="width:760px;display:block"></div>` })],
};

(async () => {
  const b = await chromium.launch();
  const seul = process.argv[2];
  for (const [nom, [html, w = 1080, h = 1080]] of Object.entries(visuels)) {
    if (seul && !nom.startsWith(seul)) continue;
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    fs.writeFileSync(`${D}/sortie/${nom}.html`, html.startsWith('<!doctype') ? html : page(html, w, h));
    await p.goto(`file://${D}/sortie/${nom}.html`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${D}/sortie/${nom}.png` });
    await p.close();
    console.log('ok', nom);
  }
  await b.close();
})();
