import { expect, test } from '@playwright/test';
import { CharacterSheetPage } from './support/character-sheet-page';

test.describe('Character sheet - PDF export', () => {
  test('exports a PDF and restores button state', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await sheet.setText('char_name', 'Export PDF QA');
    await sheet.setText('player_name', 'Chromium Bot');
    await sheet.setText('talents', 'Projection\nDétection\nPersuasion');

    const download = await sheet.exportPdf();
    expect(download.suggestedFilename()).toBe('Export PDF QA.pdf');

    await expect(page.getByTestId('export-pdf-button')).toBeEnabled();
    await expect(page.getByTestId('export-pdf-button')).toContainText('Exporter en PDF');
  });

  test('forces a desktop-like render width for PDF export on mobile', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile-'), 'Mobile-only PDF export coverage');

    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await sheet.setText('char_name', 'Export Mobile PDF');
    await sheet.setText('player_name', 'Mobile QA');
    await sheet.setText('talents', 'Projection\nDétection\nPersuasion');

    const download = await sheet.exportPdf();
    expect(download.suggestedFilename()).toBe('Export Mobile PDF.pdf');

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
    await sheet.setText('char_name', 'Vyndor Vyn Andorra');
    await sheet.setText('player_name', 'Sirkeoso');
    await sheet.setText('guild_name', 'Arcanum Astrolis');
    await sheet.setText('char_alias', 'Darth Notius');
    await sheet.setText('char_race', 'Tsis');
    await sheet.setText('char_sex', '18 cm');
    await sheet.setText('char_age', '1m86 / 44 ans');
    await sheet.setText('race_details', 'Tsis (kisso) +1 bonus en Force');
    await sheet.setText('lang_live', 'Basic, Sith, Hout sith, binaire, huttese');
    await sheet.setText('lang_dead', 'Sith ancien, Hout Tsis ancien');
    await sheet.setText('talents', 'Vigoureux : (+1) en valeur bonus de Constitution\nDisciple martial : (+1) en physique\nArtiste martial : (+1) en valeur bonus Physique\nMaître obscur : augmente de +2 les dégâts de l\'utilisation de la Force obscure.');
    await sheet.toggleForce(true);
    await sheet.setNumber('attr_con', 6);
    await sheet.setNumber('attr_con_bonus', 2);
    await sheet.setNumber('attr_str', 6);
    await sheet.setNumber('attr_str_bonus', 3);
    await sheet.setNumber('attr_phy', 7);
    await sheet.setNumber('attr_phy_bonus', 2);
    await sheet.setNumber('attr_dist', 2);
    await sheet.setNumber('attr_dist_bonus', 0);
    await sheet.setNumber('attr_know', 6);
    await sheet.setNumber('attr_know_bonus', 0);
    await sheet.setNumber('attr_soc', 5);
    await sheet.setNumber('attr_soc_bonus', 1);
    await sheet.setNumber('attr_pilot', 2);
    await sheet.setNumber('attr_pilot_bonus', 0);
    await sheet.setNumber('attr_expl', 5);
    await sheet.setNumber('attr_expl_bonus', 0);
    await sheet.select('armor_type', '60');
    await page.locator('#armor_exotic').check();
    await sheet.setNumber('inv_bp', 5);
    await sheet.setNumber('inv_shield', 3);
    await sheet.fillWeapon(0, { name: 'Sabre laser', base: 5, attr: 'phy', bonus: 2 });
    await sheet.setText('inv_misc', 'Kits : Medipock, Stimpock, repackock\nArmure noire : bouclier psychique intégré et résistant aux armes énergétique');
    await sheet.setNumber('talent_force_bonus', 2);

    await sheet.uploadPhoto('c:/Users/pauli/OneDrive/Documents/g-d-light-character-sheet/tests/fixtures/portrait.svg');

    await page.evaluate(async () => {
      await (window as typeof window & { preparePdfExportPreviewForTests?: () => Promise<unknown> }).preparePdfExportPreviewForTests?.();
    });

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