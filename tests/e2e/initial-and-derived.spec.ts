import { expect, test } from '@playwright/test';
import { CharacterSheetPage } from './support/character-sheet-page';

test.describe('Character sheet - core derived flows', () => {
  test('loads with expected defaults and hidden conditional UI', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();

    await expect(sheet.inputById('stat_lvl')).toHaveValue('0');
    await expect(sheet.inputById('stat_hp')).toHaveValue('5');
    await expect(sheet.inputById('stat_init')).toHaveValue('1');
    await expect(page.getByTestId('force-talent-row')).toHaveClass(/hidden/);
    await expect(page.locator('#armor_exotic_container')).toHaveClass(/hidden/);
    await expect(page.getByTestId('inventory-row')).toHaveClass(/inventory--checkbox-hidden/);
    await expect(page.getByTestId('weapon-row')).toHaveCount(1);
  });

  test('recomputes derived stats, armor sync, and force totals', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();

    await sheet.setNumber('attr_con', 4);
    await sheet.setNumber('attr_con_bonus', 2);
    await sheet.setNumber('attr_str', 3);
    await sheet.setNumber('attr_str_bonus', 1);
    await sheet.setNumber('attr_phy', 5);
    await sheet.setNumber('attr_phy_bonus', 1);
    await sheet.setNumber('attr_dist', 2);
    await sheet.setNumber('attr_dist_bonus', 0);
    await sheet.setNumber('attr_know', 1);
    await sheet.setNumber('attr_soc', 1);
    await sheet.setNumber('attr_pilot', 1);
    await sheet.setNumber('attr_expl', 6);
    await sheet.setNumber('attr_expl_bonus', 0);

    await expect(sheet.inputById('stat_hp')).toHaveValue('30');
    await expect(sheet.inputById('stat_res')).toHaveValue('3');
    await expect(sheet.inputById('stat_def')).toHaveValue('3');
    await expect(sheet.inputById('stat_lvl')).toHaveValue('6');

    await sheet.select('armor_type', '60');
    await expect(sheet.inputById('inv_pa')).toHaveValue('60');
    await expect(sheet.inputById('stat_pa')).toHaveValue('60');
    await expect(sheet.inputById('stat_init')).toHaveValue('5');
    await expect(page.locator('#armor_exotic_container')).not.toHaveClass(/hidden/);

    await page.locator('#armor_exotic').check();
    await expect(sheet.inputById('inv_pa')).toHaveValue('66');
    await expect(sheet.inputById('stat_pa')).toHaveValue('66');

    await sheet.toggleForce(true);
    await expect(page.getByTestId('force-talent-row')).not.toHaveClass(/hidden/);
    await expect(sheet.inputById('talent_force_base')).toHaveValue('7');
    await sheet.setNumber('talent_force_bonus', 4);
    await expect(sheet.inputById('talent_force_total')).toHaveValue('11');
  });
});