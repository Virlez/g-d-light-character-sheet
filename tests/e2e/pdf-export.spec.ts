import { expect, test } from '@playwright/test';
import { CharacterSheetPage } from './support/character-sheet-page';

const PDF_SMOKE_FIELDS = {
  char_name: 'Export PDF QA',
  player_name: 'Chromium Bot',
  talents: 'Projection\nDétection\nPersuasion'
};

const MOBILE_PDF_FIELDS = {
  char_name: 'Export Mobile PDF',
  player_name: 'Mobile QA',
  talents: 'Projection\nDétection\nPersuasion'
};

const VISUAL_PREVIEW_TEXT_FIELDS = {
  char_name: 'Vyndor Vyn Andorra',
  player_name: 'Sirkeoso',
  guild_name: 'Arcanum Astrolis',
  char_alias: 'Darth Notius',
  char_race: 'Tsis',
  char_sex: '18 cm',
  char_age: '1m86 / 44 ans',
  race_details: 'Tsis (kisso) +1 bonus en Force',
  lang_live: 'Basic, Sith, Hout sith, binaire, huttese',
  lang_dead: 'Sith ancien, Hout Tsis ancien',
  talents:
    'Vigoureux : (+1) en valeur bonus de Constitution\n' +
    'Disciple martial : (+1) en physique\n' +
    'Artiste martial : (+1) en valeur bonus Physique\n' +
    "Maître obscur : augmente de +2 les dégâts de l'utilisation de la Force obscure."
};

const VISUAL_PREVIEW_NUMBER_FIELDS = {
  attr_con: 6,
  attr_con_bonus: 2,
  attr_str: 6,
  attr_str_bonus: 3,
  attr_phy: 7,
  attr_phy_bonus: 2,
  attr_dist: 2,
  attr_dist_bonus: 0,
  attr_know: 6,
  attr_know_bonus: 0,
  attr_soc: 5,
  attr_soc_bonus: 1,
  attr_pilot: 2,
  attr_pilot_bonus: 0,
  attr_expl: 5,
  attr_expl_bonus: 0,
  inv_bp: 5,
  inv_shield: 3,
  talent_force_bonus: 2
};

const VISUAL_PREVIEW_WEAPON = { name: 'Sabre laser', base: 5, attr: 'phy' as const, bonus: 2 };

test.describe('Character sheet - PDF export', () => {
  test('exports a PDF and restores button state', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await sheet.setTextFields(PDF_SMOKE_FIELDS);

    const download = await sheet.exportPdf();
    expect(download.suggestedFilename()).toBe('Fiche Export PDF QA.pdf');

    await expect(sheet.exportPdfButton()).toBeEnabled();
    await expect(sheet.exportPdfButton()).toHaveAttribute('title', 'Exporter en PDF');
  });

  test('forces a desktop-like render width for PDF export on mobile', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile-'), 'Mobile-only PDF export coverage');

    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await sheet.setTextFields(MOBILE_PDF_FIELDS);

    const download = await sheet.exportPdf();
    expect(download.suggestedFilename()).toBe('Fiche Export Mobile PDF.pdf');

    const exportMeta = await page.evaluate(() => (window as typeof window & { __lastPdfExportMeta?: Record<string, number | boolean> }).__lastPdfExportMeta);
    expect(exportMeta?.forcedDesktopLayout).toBe(true);
    expect(Number(exportMeta?.renderWindowWidth)).toBeGreaterThanOrEqual(1280);
    expect(Number(exportMeta?.renderWidth)).toBeGreaterThanOrEqual(1280);
    expect(Number(exportMeta?.sourceViewportWidth)).toBeLessThan(Number(exportMeta?.renderWindowWidth));
  });

  test('keeps a stable visual PDF preview on mobile', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile-'), 'Mobile-only PDF visual regression');

    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await sheet.setTextFields(VISUAL_PREVIEW_TEXT_FIELDS);
    await sheet.toggleForce(true);
    await sheet.setNumberFields(VISUAL_PREVIEW_NUMBER_FIELDS);
    await sheet.select('armor_type', '60');
    await sheet.check('armor_exotic');
    await sheet.fillWeapon(0, VISUAL_PREVIEW_WEAPON);
    await sheet.setText('inv_misc', 'Kits : Medipock, Stimpock, repackock\nArmure noire : bouclier psychique intégré et résistant aux armes énergétique');

    await sheet.uploadPhoto('c:/Users/pauli/OneDrive/Documents/g-d-light-character-sheet/tests/fixtures/portrait.svg');
    await sheet.preparePdfPreviewForTests();

    const preview = page.getByTestId('pdf-export-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveScreenshot('pdf-export-mobile-desktop-layout.png', {
      animations: 'disabled',
      scale: 'css',
      caret: 'hide',
      maxDiffPixelRatio: 0.02
    });
  });
});