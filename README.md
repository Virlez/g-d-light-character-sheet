# g-d-light-character-sheet

A lightweight, printable character sheet styled with a Star Wars/tech-holo aesthetic. This repository contains a single-page HTML character sheet that uses Tailwind utility classes plus custom CSS and JavaScript for features like image preview, JSON import/export and print-optimized styles.

**Status:** Basic UI and data export/import implemented. CSS and JS have been extracted to separate files for better maintainability.

**Files of interest:**
- `index.html`: Main page. References external CSS/JS and Tailwind CDN.
- `styles.css`: All custom styles (extracted from the original inline `<style>` block).
- `script.js`: All interactive behavior (image preview, export/import JSON, reset logic).
- `LICENSE`, `README.md`: Repository metadata.

**Quick start (local preview)**

Open `index.html` in your browser (recommended via a local server above to ensure file APIs behave consistently).

**What I changed recently**
- Extracted inline CSS from `index.html` into `styles.css`.
- Extracted inline JavaScript from `index.html` into `script.js`.
- Updated `index.html` to reference the new files (`<link rel="stylesheet" href="styles.css">` and `<script src="script.js"></script>`).

**Notes & next steps**
- If you plan to use this in production, consider bundling/minifying assets and pinning or self-hosting external dependencies (Tailwind CDN, Google Fonts).
- Add a small test or manual checklist to verify import/export behavior across browsers.
- If you want, I can create a `package.json` and add a dev script to serve the folder, and make a git commit with these changes.

---
Made with care for tabletop roleplaying fans. If you'd like the README changed or expanded (installation, contributing, screenshots), tell me what to add.