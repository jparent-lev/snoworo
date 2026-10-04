import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { META as META_CREDIT, faqSchema } from './src/pages/creditImpot/contenu.js'

function commitCourt() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// Environnement de test (`vite build --mode test`, configuration dans
// .env.test) : jamais indexé par les moteurs de recherche.
function bloquerIndexationEnTest(mode) {
  return {
    name: 'snowro-noindex-test',
    transformIndexHtml(html) {
      if (mode !== 'test') return html
      return html.replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow" />')
    },
  }
}

// Page /credit-impot : copie statique de index.html avec son propre titre,
// sa description, son aperçu de partage et le balisage FAQPage. Firebase
// Hosting (cleanUrls) sert dist/credit-impot.html pour /credit-impot avant la
// réécriture vers index.html : les robots qui n'exécutent pas JavaScript
// (aperçus Facebook, Messenger) voient donc les bonnes balises.
function echapperAttribut(texte) {
  return texte.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function pageStatiqueCreditImpot() {
  return {
    name: 'snowro-page-credit-impot',
    apply: 'build',
    writeBundle(options) {
      const dossier = options.dir
      const titre = echapperAttribut(META_CREDIT.titre)
      const description = echapperAttribut(META_CREDIT.description)
      const url = 'https://snowro.com/credit-impot'
      let html = readFileSync(join(dossier, 'index.html'), 'utf8')
      // Remplacements par fonction : les textes contiennent des « $ ».
      const remplacer = (motif, valeur) => {
        if (!motif.test(html)) throw new Error(`credit-impot.html : balise introuvable ${motif}`)
        html = html.replace(motif, (_, avant = '', apres = '') => `${avant}${valeur}${apres}`)
      }
      remplacer(/(<title>)[^<]*(<\/title>)/, titre)
      remplacer(/(<meta\s+name="description"\s+content=")[^"]*(")/, description)
      remplacer(/(<link rel="canonical" href=")[^"]*(")/, url)
      remplacer(/(<meta property="og:url" content=")[^"]*(")/, url)
      remplacer(/(<meta property="og:title" content=")[^"]*(")/, titre)
      remplacer(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, description)
      remplacer(/(<meta name="twitter:title" content=")[^"]*(")/, titre)
      remplacer(/(<meta name="twitter:description" content=")[^"]*(")/, description)
      const schema = JSON.stringify(faqSchema()).replace(/</g, '\\u003c')
      remplacer(/()(<\/head>)/, `  <script type="application/ld+json">${schema}</script>\n  `)
      writeFileSync(join(dossier, 'credit-impot.html'), html)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), bloquerIndexationEnTest(mode), pageStatiqueCreditImpot()],
  define: {
    __SNOWRO_VERSION__: JSON.stringify(commitCourt()),
    __SNOWRO_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
}))
