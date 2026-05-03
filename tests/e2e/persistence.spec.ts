import { expect, test } from '@playwright/test';
import { CharacterSheetPage } from './support/character-sheet-page';
import { legacyCharacterFixture, modernCharacterFixture, portraitFixture } from './support/test-data';

test.describe('Character sheet - persistence flows', () => {
  test('exports the current sheet as JSON with a character-based filename', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await sheet.setText('char_name', 'Revan Test');
    await sheet.setText('player_name', 'QA Bot');
    await sheet.setNumber('attr_phy', 5);
    await sheet.setNumber('attr_phy_bonus', 1);
    await sheet.fillWeapon(0, { name: 'Lance-plasma', base: 8, attr: 'phy', bonus: 2 });
    await sheet.uploadPhoto(portraitFixture);

    const download = await sheet.exportJson();
    expect(download.suggestedFilename()).toBe('Revan Test_swtor.json');

    const content = await download.createReadStream();
    expect(content).not.toBeNull();
  });

  test('imports a modern JSON save and restores computed UI state', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await sheet.importJson(modernCharacterFixture);

    await sheet.expectValues({
      char_name: 'Kara Venn',
      player_name: 'Kara Venn',
      stat_pa: '66',
      stat_bp: '7',
      stat_shield: '12',
      talent_force_total: '11'
    });
    await expect(sheet.forceTalentRow()).not.toHaveClass(/hidden/);
    await expect(sheet.weaponRows()).toHaveCount(2);
    await expect(sheet.weaponRow(0).getByTestId('weapon-name')).toHaveValue('Carabine blaster');
    await expect(sheet.weaponRow(1).getByTestId('weapon-total')).toHaveValue('11');
    await expect(sheet.photoCard()).toHaveClass(/has-image/);
  });

  test('imports a legacy JSON save and converts old weapon keys', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await sheet.importJson(legacyCharacterFixture);

    await expect(sheet.inputById('char_name')).toHaveValue('Ancien Modèle');
    await expect(sheet.weaponRows()).toHaveCount(2);
    await expect(sheet.weaponRow(0).getByTestId('weapon-name')).toHaveValue('Pistolet blaster');
    await expect(sheet.weaponRow(1).getByTestId('weapon-name')).toHaveValue('Vibrolame');
    await expect(sheet.inputById('inv_pa')).toHaveValue('40');
  });

  test('resets the form to defaults after confirmation', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await sheet.importJson(modernCharacterFixture);
    await sheet.confirmReset();

    await sheet.expectValues({
      char_name: '',
      player_name: '',
      armor_type: 'none',
      inv_pa: '',
      stat_pa: ''
    });
    await expect(sheet.forceTalentRow()).toHaveClass(/hidden/);
    await expect(sheet.photoCard()).not.toHaveClass(/has-image/);
    await expect(sheet.weaponRows()).toHaveCount(1);
    await expect(sheet.weaponRow(0).getByTestId('weapon-name')).toHaveValue('');
  });
});