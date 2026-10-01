// Photo « c'est fait » : réduite et réencodée en JPEG dans le navigateur avant
// l'envoi. Le réencodage par <canvas> retire les métadonnées EXIF (position
// GPS, appareil). La limite correspond à PHOTO_MAX_CARACTERES côté serveur
// (functions/src/cycleDemande.js).
const COTE_MAX = 1280;
const CARACTERES_MAX = 650_000;

function chargerImage(fichier) {
  return new Promise((resoudre, rejeter) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resoudre(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rejeter(new Error("Ce fichier n'est pas une image lisible."));
    };
    img.src = url;
  });
}

export async function preparerPhoto(fichier) {
  if (!fichier.type.startsWith("image/")) throw new Error("Choisis une photo.");
  const img = await chargerImage(fichier);
  let cote = COTE_MAX;
  for (let essai = 0; essai < 6; essai++) {
    const echelle = Math.min(1, cote / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * echelle);
    canvas.height = Math.round(img.naturalHeight * echelle);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const donnees = canvas.toDataURL("image/jpeg", essai < 3 ? 0.78 - essai * 0.1 : 0.6);
    if (donnees.length <= CARACTERES_MAX) return donnees;
    if (essai >= 2) cote = Math.round(cote * 0.75);
  }
  throw new Error("Photo trop lourde, même réduite. Essaie-en une autre.");
}
