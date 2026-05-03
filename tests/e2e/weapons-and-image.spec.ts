import { expect, test } from '@playwright/test';
import { CharacterSheetPage } from './support/character-sheet-page';
import { portraitFixture } from './support/test-data';

const TRAINING_SABER = {
  name: "Sabre d'entraînement",
  base: 5,
  attr: 'phy' as const,
  bonus: 2
};

const CARBINE = {
  name: 'Carabine',
  base: 6,
  attr: 'dist' as const,
  bonus: 1
};

test.describe('Character sheet - weapons and image interactions', () => {
  test('adds, recalculates, and deletes weapon rows', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();

    await sheet.setNumber('attr_phy', 4);
    await sheet.setNumber('attr_phy_bonus', 1);
    await sheet.setNumber('attr_dist', 3);
    await sheet.setNumber('attr_dist_bonus', 2);

    await sheet.fillWeapon(0, TRAINING_SABER);
    await expect(sheet.weaponRow(0).getByTestId('weapon-total')).toHaveValue('12');

    await sheet.addWeapon();
    await expect(sheet.weaponRows()).toHaveCount(2);

    await sheet.fillWeapon(1, CARBINE);
    await expect(sheet.weaponRow(1).getByTestId('weapon-total')).toHaveValue('12');

    await sheet.weaponRow(1).getByTestId('delete-weapon-button').click();
    await expect(sheet.weaponRows()).toHaveCount(1);
  });

  test('uploads an image and exposes move controls', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await sheet.uploadPhoto(portraitFixture);

    await expect(sheet.photoCard()).toHaveClass(/has-image/);
    await expect(sheet.photoPreview()).not.toHaveClass(/hidden/);
    await expect(page.locator('.move-handle')).toBeVisible();
    await expect(page.locator('.zoom-controls')).toBeVisible();

    const backgroundImage = await sheet.photoPreview().evaluate((element) => {
      return window.getComputedStyle(element).backgroundImage;
    });
    expect(backgroundImage).toContain('data:image/svg+xml');
  });
});