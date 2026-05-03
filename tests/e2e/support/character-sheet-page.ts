import { expect, type Download, type Locator, type Page } from '@playwright/test';

export class CharacterSheetPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/');
    await expect(this.page.getByTestId('sheet-root')).toBeVisible();
  }

  inputById(id: string): Locator {
    return this.page.locator(`#${id}`);
  }

  testId(id: string): Locator {
    return this.page.getByTestId(id);
  }

  forceTalentRow(): Locator {
    return this.testId('force-talent-row');
  }

  photoCard(): Locator {
    return this.testId('photo-card');
  }

  photoPreview(): Locator {
    return this.testId('photo-preview');
  }

  inventoryRow(): Locator {
    return this.testId('inventory-row');
  }

  exportPdfButton(): Locator {
    return this.testId('export-pdf-button');
  }

  weaponRows(): Locator {
    return this.testId('weapon-row');
  }

  weaponRow(index: number): Locator {
    return this.page.getByTestId('weapon-row').nth(index);
  }

  async setText(id: string, value: string): Promise<void> {
    await this.inputById(id).fill(value);
  }

  async setNumber(id: string, value: number | string): Promise<void> {
    await this.inputById(id).fill(String(value));
  }

  async setTextFields(fields: Record<string, string>): Promise<void> {
    for (const [id, value] of Object.entries(fields)) {
      await this.setText(id, value);
    }
  }

  async setNumberFields(fields: Record<string, number | string>): Promise<void> {
    for (const [id, value] of Object.entries(fields)) {
      await this.setNumber(id, value);
    }
  }

  async expectValues(fields: Record<string, string>): Promise<void> {
    for (const [id, value] of Object.entries(fields)) {
      await expect(this.inputById(id)).toHaveValue(value);
    }
  }

  async valueOf(id: string): Promise<string> {
    return this.inputById(id).inputValue();
  }

  async select(id: string, value: string): Promise<void> {
    await this.inputById(id).selectOption(value);
  }

  async check(id: string): Promise<void> {
    await this.inputById(id).check();
  }

  async toggleForce(enabled: boolean): Promise<void> {
    await this.page.locator(enabled ? '#force_yes' : '#force_no').check();
  }

  async addWeapon(): Promise<void> {
    await this.page.getByTestId('add-weapon-button').click();
  }

  async fillWeapon(
    index: number,
    data: { name?: string; base?: number; attr?: 'none' | 'phy' | 'dist'; bonus?: number }
  ): Promise<void> {
    const row = this.weaponRow(index);

    if (typeof data.name === 'string') {
      await row.getByTestId('weapon-name').fill(data.name);
    }
    if (typeof data.base !== 'undefined') {
      await row.getByTestId('weapon-base').fill(String(data.base));
    }
    if (typeof data.attr !== 'undefined') {
      await row.getByTestId('weapon-attr').selectOption(data.attr);
    }
    if (typeof data.bonus !== 'undefined') {
      await row.getByTestId('weapon-bonus').fill(String(data.bonus));
    }
  }

  async weaponTotal(index: number): Promise<string> {
    return this.weaponRow(index).getByTestId('weapon-total').inputValue();
  }

  async uploadPhoto(filePath: string): Promise<void> {
    await this.page.getByTestId('photo-upload-input').setInputFiles(filePath);
  }

  async preparePdfPreviewForTests(): Promise<void> {
    await this.page.evaluate(async () => {
      await (window as typeof window & { preparePdfExportPreviewForTests?: () => Promise<unknown> }).preparePdfExportPreviewForTests?.();
    });
  }

  async importJson(filePath: string): Promise<void> {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.getByTestId('import-json-input').setInputFiles(filePath)
    ]);
    await dialog.accept();
  }

  async confirmReset(): Promise<void> {
    const dialogHandled = new Promise<void>((resolve) => {
      this.page.once('dialog', async (dialog) => {
        await dialog.accept();
        resolve();
      });
    });

    await this.page.getByTestId('reset-sheet-button').dispatchEvent('click');
    await dialogHandled;
  }

  async exportJson(): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.getByTestId('export-json-button').click();
    return downloadPromise;
  }

  async exportPdf(): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.getByTestId('export-pdf-button').click();
    return downloadPromise;
  }
}