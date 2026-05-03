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
});