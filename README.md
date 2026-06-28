# g-d-light-character-sheet

A lightweight, printable character sheet styled with a Star Wars/tech-holo aesthetic. This repository contains a single-page HTML character sheet that uses Tailwind utility classes plus custom CSS and JavaScript for features like image preview, JSON import/export and print-optimized styles.

**Files of interest:**
- `index.html`: Main page and ordered script loader.
- `styles.css`: All custom styles.
- `script.js`: Thin compatibility layer that exposes the app methods globally.
- `js/`: Modular browser scripts grouped by responsibility.
- `LICENSE`, `README.md`: Repository metadata.

**Quick start (local preview)**

Open `index.html` in your browser.

## End-to-end tests

The repository includes a Playwright E2E suite in TypeScript for desktop and mobile browsers:

- Desktop: Chromium, Firefox, WebKit
- Mobile: Chrome on Pixel 5, Safari on iPhone 13

- Install dependencies: `npm install`
- Install the Playwright browsers: `npx playwright install chromium firefox webkit`
- Run the full suite: `npm run test:e2e`
- Run a single browser project: `npm run test:e2e:chromium`, `npm run test:e2e:firefox`, `npm run test:e2e:webkit`
- Run the mobile projects: `npm run test:e2e:mobile`
- Run a single mobile project: `npm run test:e2e:mobile:chrome`, `npm run test:e2e:mobile:safari`
- Open the HTML report: `npm run test:e2e:report`

Notes:
- Tests use a local static server started from `playwright.config.ts`.
- The suite keeps the current CDN-based app setup (Tailwind, Google Fonts, `html2canvas`, `jspdf`).
- On PowerShell with script policy restrictions, prefer `npm.cmd` and `npx.cmd`.

## Supabase roles and profiles

Apply the Supabase migrations in order before deploying the pseudo/MJ/admin/guild features:

- `supabase/migrations/20260628120000_profiles_roles.sql`
- `supabase/migrations/20260628130000_guilds_and_scoped_mj.sql`
- `supabase/migrations/20260628140000_sheet_list_columns.sql`

They create user profiles, guilds, role-aware RLS policies, and the RPCs used by the app.

After applying it, promote the first admin manually:

```sql
update public.profiles
set role = 'admin'
where email = 'your-email@example.com';
```

Existing users are backfilled with an empty pseudo. On their next login, the app blocks access until they choose a unique pseudo.

## Front-end architecture

The original monolithic `script.js` has been refactored into focused browser modules loaded in order from `index.html`.

- `js/app-logic.js`: pure calculations and data normalization
- `js/app-dom.js`: DOM helpers, selector utilities, steppers, and visibility sync
- `js/app-persistence.js`: JSON export/import/reset flows
- `js/app-weapons.js`: weapon row rendering, wiring, deletion, and totals
- `js/app-image.js`: image upload, drag-and-drop, move/zoom controls, and reset
- `js/app-pdf.js`: PDF preview clone generation and screenshot-to-PDF export
- `js/app-stats.js`: derived stats, Force row computation, armor sync, and init lifecycle
- `js/app-shell.js`: final orchestration layer that composes the modules into one app object
- `script.js`: compatibility bridge that publishes app methods on `window` for inline HTML handlers and Playwright hooks

This split keeps the current no-build browser setup while making the behavior easier to test and maintain.

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
