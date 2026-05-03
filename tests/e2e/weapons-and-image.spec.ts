import { expect, test } from '@playwright/test';
import { CharacterSheetPage } from './support/character-sheet-page';
import { portraitFixture } from './support/test-data';

test.describe('Character sheet - weapons and image interactions', () => {
  test('adds, recalculates, and deletes weapon rows', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();

    await sheet.setNumber('attr_phy', 4);
    await sheet.setNumber('attr_phy_bonus', 1);
    await sheet.setNumber('attr_dist', 3);
    await sheet.setNumber('attr_dist_bonus', 2);

    await sheet.fillWeapon(0, {
      name: 'Sabre d\'entraînement',
      base: 5,
      attr: 'phy',
      bonus: 2
    });
    await expect(sheet.weaponRow(0).getByTestId('weapon-total')).toHaveValue('12');

    await sheet.addWeapon();
    await expect(page.getByTestId('weapon-row')).toHaveCount(2);

    await sheet.fillWeapon(1, {
      name: 'Carabine',
      base: 6,
      attr: 'dist',
      bonus: 1
    });
    await expect(sheet.weaponRow(1).getByTestId('weapon-total')).toHaveValue('12');

    await sheet.weaponRow(1).getByTestId('delete-weapon-button').click();
    await expect(page.getByTestId('weapon-row')).toHaveCount(1);
  });

  test('uploads an image and exposes move controls', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await sheet.uploadPhoto(portraitFixture);

    const photoCard = page.getByTestId('photo-card');
    await expect(photoCard).toHaveClass(/has-image/);
    await expect(page.getByTestId('photo-preview')).not.toHaveClass(/hidden/);
    await expect(page.locator('.move-handle')).toBeVisible();
    await expect(page.locator('.zoom-controls')).toBeVisible();

    const backgroundImage = await page.getByTestId('photo-preview').evaluate((element) => {
      return window.getComputedStyle(element).backgroundImage;
    });
    expect(backgroundImage).toContain('data:image/svg+xml');
  });
});