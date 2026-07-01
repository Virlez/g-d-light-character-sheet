import { expect, test } from '@playwright/test';
import { CharacterSheetPage } from './support/character-sheet-page';

test.describe('Character sheet - privacy information', () => {
  test('shows the privacy panel from the sheet footer', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await page.locator('#sheetRoot').getByRole('button', { name: 'Confidentialité' }).click();

    const panel = page.getByTestId('privacy-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Projet personnel, audience réduite');
    await expect(panel).toContainText("Le site n'utilise pas de publicité, d'analytics ou de bouton social de suivi.");
    await expect(panel).toContainText('Supabase');
  });

  test('shows a concise data notice before registration', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await page.evaluate(() => {
      (window as typeof window & { showAuthView?: () => void }).showAuthView?.();
    });
    await page.getByRole('button', { name: 'Inscription' }).click();

    const notice = page.getByTestId('auth-privacy-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('votre e-mail, votre pseudo et vos fiches');
  });

  test('clears local sheet data from the privacy panel', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await page.evaluate(() => {
      localStorage.setItem('swtor_sheets', JSON.stringify({ sheet_test: { id: 'sheet_test' } }));
      localStorage.setItem('swtor_guest_mode', '1');
    });

    await page.locator('#sheetRoot').getByRole('button', { name: 'Confidentialité' }).click();
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByTestId('privacy-panel').getByRole('button', { name: 'Effacer les données locales' }).click();

    await expect(page.getByTestId('privacy-panel-message')).toHaveText('Données locales effacées dans ce navigateur.');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('swtor_sheets'))).toBeNull();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('swtor_guest_mode'))).toBeNull();
  });
});
