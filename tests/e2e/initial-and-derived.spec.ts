import { expect, test } from '@playwright/test';
import { CharacterSheetPage } from './support/character-sheet-page';

test.describe('Character sheet - core derived flows', () => {
  test('loads with expected defaults and hidden conditional UI', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();

    await sheet.expectValues({
      stat_lvl: '0',
      stat_hp: '5',
      stat_init: '1'
    });
    await expect(sheet.forceTalentRow()).toHaveClass(/hidden/);
    await expect(page.locator('#armor_exotic_container')).toHaveClass(/hidden/);
    await expect(sheet.inventoryRow()).toHaveClass(/inventory--checkbox-hidden/);
    await expect(sheet.weaponRows()).toHaveCount(1);
  });

  test('recomputes derived stats, armor sync, and force totals', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();

    await sheet.setNumberFields({
      attr_con: 4,
      attr_con_bonus: 2,
      attr_str: 3,
      attr_str_bonus: 1,
      attr_phy: 5,
      attr_phy_bonus: 1,
      attr_dist: 2,
      attr_dist_bonus: 0,
      attr_know: 1,
      attr_soc: 1,
      attr_pilot: 1,
      attr_expl: 6,
      attr_expl_bonus: 0
    });

    await sheet.expectValues({
      stat_hp: '30',
      stat_res: '3',
      stat_def: '3',
      stat_lvl: '6'
    });

    await sheet.select('armor_type', '60');
    await expect(sheet.inputById('inv_pa')).toHaveValue('60');
    await expect(sheet.inputById('stat_pa')).toHaveValue('60');
    await expect(sheet.inputById('stat_init')).toHaveValue('5');
    await expect(page.locator('#armor_exotic_container')).not.toHaveClass(/hidden/);

    await page.locator('#armor_exotic').check();
    await expect(sheet.inputById('inv_pa')).toHaveValue('66');
    await expect(sheet.inputById('stat_pa')).toHaveValue('66');

    await sheet.toggleForce(true);
    await expect(sheet.forceTalentRow()).not.toHaveClass(/hidden/);
    await sheet.expectValues({ talent_force_base: '7' });
    await sheet.setNumber('talent_force_bonus', 4);
    await sheet.expectValues({ talent_force_total: '11' });
  });
});