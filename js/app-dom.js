(function (global) {
    const AppLogic = global.CharacterSheetLogic;
    const BASE_ATTRIBUTE_IDS = AppLogic?.BASE_ATTRIBUTE_IDS || ['attr_con', 'attr_str', 'attr_phy', 'attr_dist', 'attr_know', 'attr_soc', 'attr_pilot', 'attr_expl'];

    function byId(id) {
        return document.getElementById(id);
    }

    function attachInputListeners(ids, handler) {
        ids.forEach((id) => {
            const element = byId(id);
            if (element) {
                element.addEventListener('input', handler);
                element.addEventListener('change', handler);
            }
        });
    }

    function wireExistingWeaponRows(wireWeaponRow) {
        document.querySelectorAll('.weapon-item').forEach((item) => wireWeaponRow(item));
    }

    function syncArmorVisibility(armorValue) {
        const exoticContainer = byId('armor_exotic_container');
        const inventoryRow = byId('inventory_row');
        const isHidden = !armorValue || armorValue === 'none';

        if (exoticContainer) exoticContainer.classList.toggle('hidden', isHidden);
        if (inventoryRow) inventoryRow.classList.toggle('inventory--checkbox-hidden', isHidden);
    }

    function installAttributeSteppers(options) {
        const attributeIds = options?.attributeIds || BASE_ATTRIBUTE_IDS;
        const toNumber = options?.toNumber || ((value) => Number(value) || 0);
        const clampValue = options?.clampValue || ((value) => value);

        attributeIds.forEach((id) => {
            const input = byId(id);
            if (!input || input.dataset.stepper === '1') return;

            const wrapper = document.createElement('div');
            wrapper.className = 'attr-stepper';

            const decrementButton = document.createElement('button');
            decrementButton.type = 'button';
            decrementButton.className = 'attr-dec';
            decrementButton.title = 'Décrémenter';
            decrementButton.textContent = '−';

            const incrementButton = document.createElement('button');
            incrementButton.type = 'button';
            incrementButton.className = 'attr-inc';
            incrementButton.title = 'Incrémenter';
            incrementButton.textContent = '+';

            input.classList.add('attr-input');
            input.parentNode && input.parentNode.replaceChild(wrapper, input);
            wrapper.appendChild(decrementButton);
            wrapper.appendChild(input);
            wrapper.appendChild(incrementButton);
            input.dataset.stepper = '1';

            const dispatchValueChange = () => {
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            };

            const stepValue = (delta, event) => {
                const currentValue = toNumber(input.value);
                const multiplier = event && event.shiftKey ? 5 : 1;
                const nextValue = clampValue(currentValue + delta * multiplier);
                input.value = nextValue;
                dispatchValueChange();
            };

            input.addEventListener('input', function () {
                const clampedValue = clampValue(this.value);
                if (String(this.value) !== String(clampedValue)) this.value = clampedValue;
            });

            decrementButton.addEventListener('click', (event) => stepValue(-1, event));
            incrementButton.addEventListener('click', (event) => stepValue(1, event));
        });
    }

    global.CharacterSheetDom = {
        BASE_ATTRIBUTE_IDS,
        byId,
        attachInputListeners,
        wireExistingWeaponRows,
        syncArmorVisibility,
        installAttributeSteppers
    };
})(window);
