const assert = require('node:assert/strict');
const test = require('node:test');
const { createBrowserContext, loadBrowserScript } = require('./load-browser-script');

function loadLogic() {
  const context = createBrowserContext();
  return loadBrowserScript(context, 'js/app-logic.js').CharacterSheetLogic;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('toNumber normalizes common form values safely', () => {
  const logic = loadLogic();

  assert.equal(logic.toNumber(null), 0);
  assert.equal(logic.toNumber(undefined), 0);
  assert.equal(logic.toNumber(''), 0);
  assert.equal(logic.toNumber('12 pts'), 12);
  assert.equal(logic.toNumber('-4'), -4);
  assert.equal(logic.toNumber('1.5'), 1.5);
  assert.equal(logic.toNumber('abc'), 0);
});

test('clampBaseAttributeValue keeps base attributes in the expected range', () => {
  const logic = loadLogic();

  assert.equal(logic.clampBaseAttributeValue(-2), 0);
  assert.equal(logic.clampBaseAttributeValue('3.6'), 4);
  assert.equal(logic.clampBaseAttributeValue(99), 7);
  assert.equal(logic.clampBaseAttributeValue('not-a-number'), 0);
});

test('computeWeaponTotal applies the selected attribute total only', () => {
  const logic = loadLogic();
  const base = { base: 5, bonus: 2, phyTotal: 7, distTotal: 3 };

  assert.equal(logic.computeWeaponTotal({ ...base, attr: 'none' }), 7);
  assert.equal(logic.computeWeaponTotal({ ...base, attr: 'phy' }), 14);
  assert.equal(logic.computeWeaponTotal({ ...base, attr: 'dist' }), 10);
});

test('calculateInventoryPa handles armor presets, exotic multiplier, and clearing', () => {
  const logic = loadLogic();

  assert.deepEqual(plain(logic.calculateInventoryPa({ armorType: 'none' })), {
    clear: true,
    base: 0,
    finalValue: ''
  });
  assert.deepEqual(plain(logic.calculateInventoryPa({ armorType: '60', isExotic: true })), {
    clear: false,
    base: 60,
    finalValue: 66
  });
  assert.deepEqual(plain(logic.calculateInventoryPa({ armorType: '', storedBase: '80', currentValue: '12' })), {
    clear: false,
    base: 80,
    finalValue: 80
  });
});

test('calculateDerivedStats captures defense, talents, armor malus, and level rules', () => {
  const logic = loadLogic();
  const result = logic.calculateDerivedStats({
    attrCon: 4,
    attrConBonus: 2,
    attrDist: 2,
    attrDistBonus: 0,
    attrPhy: 5,
    attrPhyBonus: 1,
    attrExpl: 6,
    attrExplBonus: 0,
    armorType: '60',
    invPa: '60',
    invBp: '7',
    invShield: '3',
    hasSolid: true,
    hasInexpugnable: true,
    baseAttributes: {
      attr_con: 4,
      attr_str: 3,
      attr_phy: 5,
      attr_dist: 2,
      attr_know: 1,
      attr_soc: 1,
      attr_pilot: 1,
      attr_expl: 6
    }
  });

  assert.equal(result.statPa, '60');
  assert.equal(result.statBp, 12);
  assert.equal(result.statShield, '3');
  assert.equal(result.statHp, 45);
  assert.equal(result.statRes, 3);
  assert.equal(result.statDef, 3);
  assert.equal(result.statInit, 5);
  assert.equal(result.statLvl, 6);
  assert.deepEqual(plain(result.weaponAttributeTotals), { phyTotal: 6, distTotal: 2 });
});

test('computeForceAttackValues hides and zeros force values when force is disabled', () => {
  const logic = loadLogic();

  assert.deepEqual(plain(logic.computeForceAttackValues({ isForceUser: false, attrStr: 5, bonus: 9 })), {
    visible: false,
    base: 0,
    total: 0
  });
  assert.deepEqual(plain(logic.computeForceAttackValues({ isForceUser: true, attrStr: 3, attrStrBonus: 1, bonus: 4 })), {
    visible: true,
    base: 7,
    total: 11
  });
});

test('normalizeImportedWeapons supports modern, string, and legacy save formats', () => {
  const logic = loadLogic();

  assert.deepEqual(plain(logic.normalizeImportedWeapons({
    weapons: [
      'Sabre',
      { name: 'Blaster', base: '5', attr: 'dist', bonus: '2' },
      { name: 'Mystery', base: 'abc', bonus: null }
    ]
  })), [
    { name: 'Sabre', base: 0, attr: 'phy', bonus: 0 },
    { name: 'Blaster', base: 5, attr: 'dist', bonus: 2 },
    { name: 'Mystery', base: 0, attr: 'phy', bonus: 0 }
  ]);

  assert.deepEqual(plain(logic.normalizeImportedWeapons({ wep_main: 'Pistolet', wep_sec: 'Vibrolame' })), [
    { name: 'Pistolet', base: 0, attr: 'phy', bonus: 0 },
    { name: 'Vibrolame', base: 0, attr: 'phy', bonus: 0 }
  ]);
});
