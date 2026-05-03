(function (global) {
    const AppLogic = global.CharacterSheetLogic;

    function createWeaponRowMarkup() {
        return `
        <input type="text" data-testid="weapon-name" class="weapon-name w-full p-1 text-sm" placeholder="Nom arme">
        <input type="number" data-testid="weapon-base" class="weapon-base w-full p-1 text-sm text-right" value="0" min="0">
        <select data-testid="weapon-attr" class="weapon-attr w-full p-1 text-sm">
                <option value="none">Aucun</option>
                <option value="phy">Physique</option>
                <option value="dist">Distance</option>
            </select>
        <input type="number" data-testid="weapon-bonus" class="weapon-bonus w-full p-1 text-sm text-right" value="0" step="1" min="0">
        <div class="flex items-center gap-2">
            <input type="number" data-testid="weapon-total" class="weapon-total w-full p-1 text-sm bg-transparent text-right" value="0" readonly>
            <button type="button" data-testid="delete-weapon-button" class="weapon-delete text-sm bg-[#002e33] hover:bg-red-900 hover:text-red-500 text-[#00f0ff] px-2 py-1 rounded clip-corner transition-colors">-</button>
        </div>
    `;
    }

    function applyWeaponDefaults(weaponItem, data) {
        const nameEl = weaponItem.querySelector('.weapon-name');
        const baseEl = weaponItem.querySelector('.weapon-base');
        const attrEl = weaponItem.querySelector('.weapon-attr');
        const bonusEl = weaponItem.querySelector('.weapon-bonus');

        if (data.name) nameEl.value = data.name;
        if (typeof data.base !== 'undefined') baseEl.value = data.base;
        if (data.attr) attrEl.value = data.attr;
        if (typeof data.bonus !== 'undefined') bonusEl.value = data.bonus;
    }

    function wireWeaponRow(item, options) {
        if (!item) return;
        const nameEl = item.querySelector('.weapon-name');
        const baseEl = item.querySelector('.weapon-base');
        const attrEl = item.querySelector('.weapon-attr');
        const bonusEl = item.querySelector('.weapon-bonus');
        const deleteButton = item.querySelector('.weapon-delete');

        [nameEl, baseEl, attrEl, bonusEl].forEach((element) => {
            if (!element) return;
            element.addEventListener('input', options.computeAllWeaponTotals);
            element.addEventListener('change', options.computeAllWeaponTotals);
        });

        if (deleteButton) {
            deleteButton.addEventListener('click', function () {
                options.deleteWeapon(this);
            });
        }
    }

    function renderWeapon(data, options) {
        const container = document.getElementById('weapons-container');
        if (!container) return null;

        const weaponItem = document.createElement('div');
        weaponItem.setAttribute('data-testid', 'weapon-row');
        weaponItem.className = 'weapon-item grid grid-cols-5 gap-2 items-center';
        weaponItem.innerHTML = createWeaponRowMarkup();
        container.appendChild(weaponItem);

        applyWeaponDefaults(weaponItem, data || {});
        wireWeaponRow(weaponItem, options);
        options.computeAllWeaponTotals();

        return weaponItem;
    }

    function deleteWeapon(button, options) {
        const container = document.getElementById('weapons-container');
        const item = button?.closest('.weapon-item');
        if (!container || !item) return;
        if (container.querySelectorAll('.weapon-item').length > 1) {
            item.remove();
            options.computeAllWeaponTotals();
        }
    }

    function computeAllWeaponTotals(options) {
        const toNumber = options.toNumber;
        const phyTotal = toNumber(document.getElementById('attr_phy')?.value) + toNumber(document.getElementById('attr_phy_bonus')?.value);
        const distTotal = toNumber(document.getElementById('attr_dist')?.value) + toNumber(document.getElementById('attr_dist_bonus')?.value);

        document.querySelectorAll('.weapon-item').forEach((item) => {
            const total = AppLogic.computeWeaponTotal({
                base: toNumber(item.querySelector('.weapon-base')?.value),
                attr: item.querySelector('.weapon-attr')?.value || 'phy',
                bonus: toNumber(item.querySelector('.weapon-bonus')?.value),
                phyTotal,
                distTotal
            });

            const totalEl = item.querySelector('.weapon-total');
            if (totalEl) totalEl.value = total;
        });
    }

    global.CharacterSheetWeapons = {
        wireWeaponRow,
        renderWeapon,
        deleteWeapon,
        computeAllWeaponTotals
    };
})(window);
