import { expect, test } from '@playwright/test';
import { CharacterSheetPage } from './support/character-sheet-page';
import {
  guildKnownCharacterFixture,
  guildTypoCharacterFixture,
  guildUnknownCharacterFixture,
  legacyCharacterFixture,
  modernCharacterFixture,
  portraitFixture
} from './support/test-data';

async function readDownloadAsJson(download: Awaited<ReturnType<CharacterSheetPage['exportJson']>>): Promise<Record<string, unknown>> {
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

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
    await expect(sheet.inputById('talent_solid')).not.toBeChecked();
    await expect(sheet.inputById('talent_inexpugnable')).not.toBeChecked();
    await expect(sheet.forceTalentRow()).not.toHaveClass(/hidden/);
    await expect(sheet.weaponRows()).toHaveCount(2);
    await expect(sheet.weaponRow(0).getByTestId('weapon-name')).toHaveValue('Carabine blaster');
    await expect(sheet.weaponRow(1).getByTestId('weapon-total')).toHaveValue('11');
    await expect(sheet.photoCard()).toHaveClass(/has-image/);
  });

  test('exports and imports special defense talents with derived stats intact', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await sheet.setText('char_name', 'Talent Check');
    await sheet.setNumber('attr_con', 2);
    await sheet.setNumber('inv_bp', 7);
    await page.getByTestId('special-talents-toggle').click();
    await sheet.check('talent_solid');
    await sheet.check('talent_inexpugnable');

    await sheet.expectValues({
      stat_hp: '25',
      stat_bp: '12',
      inv_bp: '7'
    });

    const exported = await readDownloadAsJson(await sheet.exportJson());
    expect(exported.talent_solid).toBe(true);
    expect(exported.talent_inexpugnable).toBe(true);

    await sheet.confirmReset();
    const dialogPromise = page.waitForEvent('dialog');
    await page.setInputFiles('#importFile', {
      name: 'talent-check.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(exported))
    });
    const dialog = await dialogPromise;
    await dialog.accept();

    await expect(sheet.inputById('talent_solid')).toBeChecked();
    await expect(sheet.inputById('talent_inexpugnable')).toBeChecked();
    await sheet.expectValues({
      char_name: 'Talent Check',
      stat_hp: '25',
      stat_bp: '12',
      inv_bp: '7'
    });
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

  test('normalizes guild names from imported JSON saves', async ({ page }) => {
    const sheet = new CharacterSheetPage(page);

    await sheet.goto();
    await sheet.importJson(guildKnownCharacterFixture);
    await expect(sheet.inputById('guild_name')).toHaveValue('Ordo Augustus');

    await sheet.importJson(guildTypoCharacterFixture);
    await expect(sheet.inputById('guild_name')).toHaveValue('Arcanum Astralis');

    await sheet.importJson(guildUnknownCharacterFixture);
    await expect(sheet.inputById('guild_name')).toHaveValue('');
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
