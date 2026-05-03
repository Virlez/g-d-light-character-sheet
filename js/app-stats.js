(function (global) {
    const AppLogic = global.CharacterSheetLogic;
    const AppDom = global.CharacterSheetDom;

    function collectBaseAttributes() {
        const baseAttributes = {};
        AppLogic.BASE_ATTRIBUTE_IDS.forEach((attributeId) => {
            baseAttributes[attributeId] = document.getElementById(attributeId)?.value || 0;
        });
        return baseAttributes;
    }

    function updateInvPA(options) {
        const invPaEl = document.getElementById('inv_pa');
        if (!invPaEl) return;

        const armorSelect = document.getElementById('armor_type');
        const exoticEl = document.getElementById('armor_exotic');
        const inventoryPa = AppLogic.calculateInventoryPa({
            armorType: armorSelect?.value,
            storedBase: invPaEl.dataset?.base,
            currentValue: invPaEl.value,
            isExotic: !!(exoticEl && exoticEl.checked)
        });

        invPaEl.dataset.base = inventoryPa.clear ? '' : String(inventoryPa.base);
        invPaEl.value = inventoryPa.finalValue;
        options.computeDerivedStats();
    }

    function computeDerivedStats(options) {
        const invPa = document.getElementById('inv_pa');
        const invBp = document.getElementById('inv_bp');
        const invShield = document.getElementById('inv_shield');
        const statPa = document.getElementById('stat_pa');
        const statBp = document.getElementById('stat_bp');
        const statShield = document.getElementById('stat_shield');
        const attrCon = document.getElementById('attr_con');
        const attrConBonus = document.getElementById('attr_con_bonus');
        const attrDist = document.getElementById('attr_dist');
        const attrDistBonus = document.getElementById('attr_dist_bonus');
        const attrPhy = document.getElementById('attr_phy');
        const attrPhyBonus = document.getElementById('attr_phy_bonus');
        const attrExpl = document.getElementById('attr_expl');
        const attrExplBonus = document.getElementById('attr_expl_bonus');
        const armorSelect = document.getElementById('armor_type');

        const derivedStats = AppLogic.calculateDerivedStats({
            invPa: invPa?.value,
            invBp: invBp?.value,
            invShield: invShield?.value,
            attrCon: attrCon?.value,
            attrConBonus: attrConBonus?.value,
            attrDist: attrDist?.value,
            attrDistBonus: attrDistBonus?.value,
            attrPhy: attrPhy?.value,
            attrPhyBonus: attrPhyBonus?.value,
            attrExpl: attrExpl?.value,
            attrExplBonus: attrExplBonus?.value,
            armorType: armorSelect?.value,
            baseAttributes: collectBaseAttributes()
        });

        if (invPa && statPa) statPa.value = derivedStats.statPa;
        if (invBp && statBp) statBp.value = derivedStats.statBp;
        if (invShield && statShield) statShield.value = derivedStats.statShield;

        const statHp = document.getElementById('stat_hp');
        const statRes = document.getElementById('stat_res');
        const statDef = document.getElementById('stat_def');
        const statInit = document.getElementById('stat_init');
        const statLvl = document.getElementById('stat_lvl');
        if (statHp) statHp.value = derivedStats.statHp;
        if (statRes) statRes.value = derivedStats.statRes;
        if (statDef) statDef.value = derivedStats.statDef;
        if (statInit) statInit.value = derivedStats.statInit;
        if (statLvl) statLvl.value = derivedStats.statLvl;

        if (typeof options.computeAllWeaponTotals === 'function') options.computeAllWeaponTotals();

        try {
            options.computeForceAttack();
        } catch (error) {}
    }

    function computeForceAttack() {
        const row = document.getElementById('talent_force_row');
        if (!row) return;

        const forceValues = AppLogic.computeForceAttackValues({
            isForceUser: document.getElementById('force_yes')?.checked,
            attrStr: document.getElementById('attr_str')?.value,
            attrStrBonus: document.getElementById('attr_str_bonus')?.value,
            bonus: document.getElementById('talent_force_bonus')?.value
        });

        if (forceValues.visible) row.classList.remove('hidden');
        else row.classList.add('hidden');
        if (!forceValues.visible) return;

        const baseEl = document.getElementById('talent_force_base');
        const bonusEl = document.getElementById('talent_force_bonus');
        const totalEl = document.getElementById('talent_force_total');
        if (baseEl) baseEl.value = forceValues.base;
        if (bonusEl && !bonusEl.value) bonusEl.value = '0';
        if (totalEl) totalEl.value = forceValues.total;
    }

    function bindArmorControls(options) {
        const armorSelect = AppDom.byId('armor_type');
        const invPaEl = AppDom.byId('inv_pa');
        const exoticEl = AppDom.byId('armor_exotic');

        if (armorSelect) {
            armorSelect.addEventListener('change', function () {
                if (armorSelect.value === 'none') {
                    invPaEl.dataset.base = '';
                    invPaEl.value = '';
                    AppDom.syncArmorVisibility(armorSelect.value);
                    options.computeDerivedStats();
                } else {
                    invPaEl.dataset.base = armorSelect.value || '';
                    options.updateInvPA();
                    AppDom.syncArmorVisibility(armorSelect.value);
                }
            });

            if (armorSelect.value) {
                invPaEl && (invPaEl.dataset.base = armorSelect.value);
            }
            AppDom.syncArmorVisibility(armorSelect.value);
        }

        if (invPaEl) {
            invPaEl.addEventListener('input', function () {
                const nextValue = options.toNumber(this.value);
                const isExotic = exoticEl && exoticEl.checked;
                const base = isExotic ? Math.round(nextValue / 1.1) : nextValue;
                this.dataset.base = String(base || 0);

                if (armorSelect) {
                    if (base === 40 || base === 60 || base === 80) {
                        armorSelect.value = String(base);
                    } else {
                        armorSelect.value = '';
                    }
                }
                options.computeDerivedStats();
            });
        }

        if (exoticEl) {
            exoticEl.addEventListener('change', function () {
                options.updateInvPA();
            });
        }
    }

    function bindForceControls(options) {
        try {
            const forceYes = document.getElementById('force_yes');
            const forceNo = document.getElementById('force_no');
            const bonusEl = document.getElementById('talent_force_bonus');
            if (forceYes) forceYes.addEventListener('change', options.computeForceAttack);
            if (forceNo) forceNo.addEventListener('change', options.computeForceAttack);
            if (bonusEl) {
                bonusEl.addEventListener('input', options.computeForceAttack);
                bonusEl.addEventListener('change', options.computeForceAttack);
            }
            options.computeForceAttack();
        } catch (error) {}
    }

    function initSheet(options) {
        AppDom.attachInputListeners(
            ['inv_pa','inv_bp','inv_shield','attr_con','attr_con_bonus','attr_dist','attr_dist_bonus','attr_phy','attr_phy_bonus','attr_expl','attr_expl_bonus','attr_str','attr_know','attr_soc','attr_pilot'],
            options.computeDerivedStats
        );

        try {
            AppDom.wireExistingWeaponRows(options.wireWeaponRow);
        } catch (error) {}

        try {
            AppDom.installAttributeSteppers({
                attributeIds: AppLogic.BASE_ATTRIBUTE_IDS,
                toNumber: options.toNumber,
                clampValue: AppLogic.clampBaseAttributeValue
            });
        } catch (error) {}

        options.computeDerivedStats();
        bindArmorControls(options);
        options.updateInvPA();
        bindForceControls(options);
    }

    function installInitLifecycle(options) {
        document.addEventListener('DOMContentLoaded', options.initSheet);
        if (document.readyState !== 'loading') {
            options.initSheet();
        }
    }

    function installGlobalUpdateInvPAWrapper(updateInvPA) {
        const wrapped = function () {
            updateInvPA();
            try {
                const armorSelect = AppDom.byId('armor_type');
                AppDom.syncArmorVisibility(armorSelect?.value);
            } catch (error) {}
        };
        global.updateInvPA = wrapped;
        return wrapped;
    }

    global.CharacterSheetStats = {
        updateInvPA,
        computeDerivedStats,
        computeForceAttack,
        initSheet,
        installInitLifecycle,
        installGlobalUpdateInvPAWrapper
    };
})(window);