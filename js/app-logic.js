(function (global) {
    const BASE_ATTRIBUTE_IDS = ['attr_con', 'attr_str', 'attr_phy', 'attr_dist', 'attr_know', 'attr_soc', 'attr_pilot', 'attr_expl'];

    function toNumber(value) {
        if (value === null || value === undefined) return 0;
        const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''));
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function clampBaseAttributeValue(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return 0;
        return Math.min(Math.max(0, Math.round(parsed)), 7);
    }

    function computeWeaponTotal(input) {
        const base = toNumber(input.base);
        const bonus = toNumber(input.bonus);
        const attr = input.attr || 'none';
        const phyTotal = toNumber(input.phyTotal);
        const distTotal = toNumber(input.distTotal);

        let attributeValue = 0;
        if (attr === 'phy') attributeValue = phyTotal;
        else if (attr === 'dist') attributeValue = distTotal;

        return base + attributeValue + bonus;
    }

    function calculateInventoryPa(input) {
        const armorType = String(input.armorType || '');
        if (armorType === 'none') {
            return {
                clear: true,
                base: 0,
                finalValue: ''
            };
        }

        let base = 0;
        if (armorType) {
            base = toNumber(armorType);
        } else if (input.storedBase !== undefined && input.storedBase !== null && input.storedBase !== '') {
            base = toNumber(input.storedBase);
        } else {
            base = toNumber(input.currentValue);
        }

        const multiplier = input.isExotic ? 1.1 : 1;
        const finalValue = Math.round(base * multiplier);

        return {
            clear: false,
            base,
            finalValue: finalValue || ''
        };
    }

    function calculateDerivedStats(input) {
        const conTotal = toNumber(input.attrCon) + toNumber(input.attrConBonus);
        const distTotal = toNumber(input.attrDist) + toNumber(input.attrDistBonus);
        const phyTotal = toNumber(input.attrPhy) + toNumber(input.attrPhyBonus);
        const explTotal = toNumber(input.attrExpl) + toNumber(input.attrExplBonus);

        let armorMalus = 0;
        const armorType = String(input.armorType || 'none');
        if (armorType === '60') armorMalus = 1;
        else if (armorType === '80') armorMalus = 2;

        let baseAttributeSum = 0;
        BASE_ATTRIBUTE_IDS.forEach((attributeId) => {
            baseAttributeSum += toNumber(input.baseAttributes?.[attributeId]);
        });

        return {
            statPa: input.invPa || '',
            statBp: input.invBp === '' || input.invBp === null || typeof input.invBp === 'undefined'
                ? (input.hasInexpugnable ? 5 : '')
                : toNumber(input.invBp) + (input.hasInexpugnable ? 5 : 0),
            statShield: input.invShield || '',
            statHp: (conTotal * 5) + (input.hasSolid ? 15 : 0),
            statRes: Math.ceil(conTotal / 2),
            statDef: Math.ceil(Math.max(distTotal, phyTotal) / 2),
            statInit: Math.max(0, Math.max(conTotal, explTotal) - armorMalus),
            statLvl: Math.max(0, baseAttributeSum - 17),
            weaponAttributeTotals: {
                phyTotal,
                distTotal
            }
        };
    }

    function computeForceAttackValues(input) {
        const isForceUser = !!input.isForceUser;
        if (!isForceUser) {
            return {
                visible: false,
                base: 0,
                total: 0
            };
        }

        const base = (toNumber(input.attrStr) * 2) + toNumber(input.attrStrBonus);
        const total = base + toNumber(input.bonus);

        return {
            visible: true,
            base,
            total
        };
    }

    function normalizeImportedWeapons(data) {
        if (Array.isArray(data.weapons)) {
            return data.weapons.map((weapon) => {
                if (typeof weapon === 'string') {
                    return { name: weapon, base: 0, attr: 'phy', bonus: 0 };
                }

                return {
                    name: weapon?.name || '',
                    base: toNumber(weapon?.base),
                    attr: weapon?.attr || 'phy',
                    bonus: toNumber(weapon?.bonus)
                };
            });
        }

        const legacyWeapons = [];
        if (data.wep_main) legacyWeapons.push({ name: data.wep_main, base: 0, attr: 'phy', bonus: 0 });
        if (data.wep_sec) legacyWeapons.push({ name: data.wep_sec, base: 0, attr: 'phy', bonus: 0 });
        return legacyWeapons;
    }

    global.CharacterSheetLogic = {
        BASE_ATTRIBUTE_IDS,
        toNumber,
        clampBaseAttributeValue,
        computeWeaponTotal,
        calculateInventoryPa,
        calculateDerivedStats,
        computeForceAttackValues,
        normalizeImportedWeapons
    };
})(window);
