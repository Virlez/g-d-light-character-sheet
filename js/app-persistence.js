(function (global) {
    const AppLogic = global.CharacterSheetLogic;
    const AppDom = global.CharacterSheetDom;

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(String(event?.target?.result || ''));
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    function collectExportData(options) {
        const toNumber = options.toNumber;
        const data = {};

        document.querySelectorAll('input[id], textarea[id], select[id]').forEach((element) => {
            if (element.type === 'file') return;

            if (element.type === 'radio') {
                if (element.checked) data[element.name] = element.value;
                return;
            }

            if (element.type === 'checkbox') {
                data[element.id] = element.checked;
                return;
            }

            data[element.id] = element.value;
        });

        const weapons = [];
        document.querySelectorAll('.weapon-item').forEach((item) => {
            weapons.push({
                name: item.querySelector('.weapon-name')?.value || '',
                base: toNumber(item.querySelector('.weapon-base')?.value),
                attr: item.querySelector('.weapon-attr')?.value || 'phy',
                bonus: toNumber(item.querySelector('.weapon-bonus')?.value),
                total: toNumber(item.querySelector('.weapon-total')?.value)
            });
        });

        if (weapons.length > 0) data.weapons = weapons;
        if (options.currentImageData) data.char_image_data = options.currentImageData;

        return data;
    }

    function triggerJsonDownload(data) {
        const fileName = (data.char_name || 'personnage') + '_swtor.json';
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }

    function clearFormControls() {
        document.querySelectorAll('input, textarea, select').forEach((element) => {
            if (element.type === 'file') return;
            if (element.type === 'radio' || element.type === 'checkbox') {
                element.checked = false;
            } else {
                element.value = '';
            }
        });
    }

    function applyImportedFields(data) {
        Object.entries(data).forEach(([key, value]) => {
            if (key === 'char_image_data' || key === 'weapons') return;

            if (key === 'force') {
                const radio = document.querySelector(`input[name="force"][value="${value}"]`);
                if (radio) radio.checked = true;
                return;
            }

            const element = document.getElementById(key);
            if (!element) return;

            if (element.type === 'checkbox') {
                element.checked = Boolean(value);
                return;
            }

            if (AppLogic.BASE_ATTRIBUTE_IDS.includes(key)) {
                element.value = String(AppLogic.clampBaseAttributeValue(value));
                return;
            }

            element.value = value;
        });
    }

    function applyImportedWeapons(data, renderWeapon) {
        const normalizedWeapons = AppLogic.normalizeImportedWeapons(data);
        if (normalizedWeapons.length === 0) return;

        const container = document.getElementById('weapons-container');
        if (!container) return;

        container.innerHTML = '';
        normalizedWeapons.forEach((weapon) => renderWeapon(weapon));
    }

    function applyImportedImage(data, options) {
        if (!data.char_image_data) {
            options.resetImage();
            return null;
        }

        const imageModule = global.CharacterSheetImage;
        if (!imageModule || typeof imageModule.applyImageData !== 'function') {
            return data.char_image_data;
        }

        return imageModule.applyImageData({
            imgInput: options.imgInput,
            imgPreview: options.imgPreview,
            imageData: data.char_image_data,
            ensureMoveUI: options.ensureMoveUI
        });
    }

    async function importJsonFile(file, options) {
        const fileContent = await readFileAsText(file);
        const data = JSON.parse(fileContent);

        clearFormControls();
        options.resetImage();
        applyImportedFields(data);
        applyImportedWeapons(data, options.renderWeapon);
        const nextImageData = applyImportedImage(data, options);

        try {
            if (typeof options.updateInvPA === 'function') options.updateInvPA();
            else options.computeDerivedStats();
        } catch (error) {
            options.computeDerivedStats();
        }

        document.querySelectorAll('textarea').forEach((textarea) => options.autoExpandTextarea(textarea));

        return {
            data,
            currentImageData: nextImageData
        };
    }

    function resetSheetState(options) {
        document.querySelectorAll('input, textarea, select').forEach((element) => {
            if (element.type === 'file') return;

            if (element.type === 'radio' || element.type === 'checkbox') {
                element.checked = !!element.defaultChecked;
            } else {
                element.value = element.defaultValue;
            }
        });

        const armorSelect = AppDom.byId('armor_type');
        if (armorSelect) armorSelect.value = 'none';
        AppDom.syncArmorVisibility('none');

        options.resetImage();

        const container = document.getElementById('weapons-container');
        if (container) {
            container.innerHTML = '';
            options.renderWeapon();
        }

        if (typeof options.updateInvPA === 'function') options.updateInvPA();
        else options.computeDerivedStats();
    }

    function applySheetData(data, options) {
        clearFormControls();
        options.resetImage();
        applyImportedFields(data);
        applyImportedWeapons(data, options.renderWeapon);
        const nextImageData = applyImportedImage(data, options);

        try {
            if (typeof options.updateInvPA === 'function') options.updateInvPA();
            else options.computeDerivedStats();
        } catch (error) {
            options.computeDerivedStats();
        }

        document.querySelectorAll('textarea').forEach((textarea) => options.autoExpandTextarea(textarea));

        return { currentImageData: nextImageData };
    }

    const LS_KEY = 'swtor_sheets';

    function lsGetAll() {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
        catch (e) { return {}; }
    }

    function saveSheetToLocalStorage(data, existingId) {
        const sheets = lsGetAll();
        const id = (existingId && sheets[existingId]) ? existingId : 'sheet_' + Date.now();
        sheets[id] = {
            id,
            name: data.char_name || 'Sans nom',
            savedAt: new Date().toISOString(),
            data
        };
        localStorage.setItem(LS_KEY, JSON.stringify(sheets));
        return id;
    }

    function loadSheetFromLocalStorage(id) {
        const sheets = lsGetAll();
        return sheets[id] || null;
    }

    function deleteSheetFromLocalStorage(id) {
        const sheets = lsGetAll();
        delete sheets[id];
        localStorage.setItem(LS_KEY, JSON.stringify(sheets));
    }

    function listSheetsFromLocalStorage() {
        return Object.values(lsGetAll())
            .map(entry => ({
                id: entry.id,
                name: entry.name,
                savedAt: entry.savedAt,
                imageData: (entry.data && entry.data.char_image_data) || null
            }))
            .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    }

    global.CharacterSheetPersistence = {
        readFileAsText,
        collectExportData,
        triggerJsonDownload,
        importJsonFile,
        resetSheetState,
        applySheetData,
        saveSheetToLocalStorage,
        loadSheetFromLocalStorage,
        deleteSheetFromLocalStorage,
        listSheetsFromLocalStorage
    };
})(window);
