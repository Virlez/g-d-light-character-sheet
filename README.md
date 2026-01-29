# g-d-light-character-sheet

A lightweight, printable character sheet styled with a Star Wars/tech-holo aesthetic. This repository contains a single-page HTML character sheet that uses Tailwind utility classes plus custom CSS and JavaScript for features like image preview, JSON import/export and print-optimized styles.

**Files of interest:**
- `index.html`: Main page. References external CSS/JS and Tailwind CDN.
- `styles.css`: All custom styles (extracted from the original inline `<style>` block).
- `script.js`: All interactive behavior (image preview, export/import JSON, reset logic).
- `LICENSE`, `README.md`: Repository metadata.

**Quick start (local preview)**

Open `index.html` in your browser.

## How to use — Sauvegarder et charger / Save & Load (FR / EN)

### Français

- Sauvegarder (exporter) : utilisez le bouton "Sauvegarder (JSON)" en bas de la page. Cela télécharge un fichier JSON contenant toutes les données de la fiche, y compris l'image (encodée en base64). Conservez ce fichier pour le restaurer plus tard.
- Charger (importer) : cliquez sur "Charger (JSON)" puis choisissez un fichier JSON précédemment exporté. Avant d'importer, le formulaire sera vidé pour que les valeurs du fichier remplacent celles actuellement affichées.
- Remplacer l'image : si une photo est déjà chargée, l'icône et le texte de l'espace photo disparaissent pour laisser place à l'image. Cliquez sur la zone photo pour ouvrir le dialogue de fichier et sélectionner une nouvelle image.
- Réinitialiser : le bouton "Réinitialiser" remet la fiche à ses valeurs par défaut et supprime l'image actuellement chargée.
- Compatibilité : l'import accepte les anciennes versions JSON contenant `wep_main` / `wep_sec` et les convertit en nouveau format d'armes.

### English

- Save (export): use the "Sauvegarder (JSON)" button at the bottom of the page. This downloads a JSON file that contains all sheet data, including the character image (encoded as base64). Keep that file to restore the sheet later.
- Load (import): click "Charger (JSON)" and pick a previously exported JSON file. The form is cleared before importing so the file's values replace current values.
- Replace image: when a photo is loaded the placeholder icon/text will disappear and the picture is shown. Click the photo area to open the file picker and select a new image.
- Reset: the "Réinitialiser" button restores default values and removes the current image.
- Compatibility: the importer supports older JSON exports that used `wep_main` / `wep_sec` and will convert them to the new weapons array format.

If you want these instructions shortened, translated differently, or expanded with screenshots, I can update them.