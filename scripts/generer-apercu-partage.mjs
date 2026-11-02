// Régénère public/og-snowro.png (image Open Graph / Twitter, 1200 x 630) à
// partir du gabarit /apercu-partage servi par `vite dev` (src/pages/ApercuPartage.jsx).
//
//   npm run og
//
// Le script démarre Vite en mode test (variables Firebase publiques de
// snowro-test, nécessaires au démarrage de l'app), capture la page avec
// Playwright en prefers-reduced-motion (illustration figée sur l'écran
// « Je prends la demande »), puis arrête Vite. Playwright n'est pas une
// dépendance du projet : `npx playwright install chromium` au besoin.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sortie = path.join(racine, "public", "og-snowro.png");
const port = 5199;
const url = `http://localhost:${port}/apercu-partage`;

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright introuvable. Installez-le d'abord : npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const vite = spawn("npx", ["vite", "--mode", "test", "--port", String(port), "--strictPort"], {
  cwd: racine,
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise((resoudre, rejeter) => {
  const minuterie = setTimeout(() => rejeter(new Error("Vite n'a pas démarré en 30 s")), 30_000);
  vite.stdout.on("data", (d) => {
    if (String(d).includes("Local:")) {
      clearTimeout(minuterie);
      resoudre();
    }
  });
  vite.on("exit", (code) => rejeter(new Error(`Vite s'est arrêté (code ${code})`)));
});

try {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({ path: sortie, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await navigateur.close();
  console.log(`Image écrite : ${path.relative(racine, sortie)}`);
} finally {
  vite.kill();
}
