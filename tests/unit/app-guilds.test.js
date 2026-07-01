const assert = require('node:assert/strict');
const test = require('node:test');
const { createBrowserContext, loadBrowserScript } = require('./load-browser-script');

function loadGuilds() {
  const context = createBrowserContext();
  return loadBrowserScript(context, 'js/app-guilds.js').CharacterSheetGuilds;
}

test('guild lookup accepts ids, names, case, extra spaces, and accents', () => {
  const guilds = loadGuilds();

  assert.equal(guilds.idFromName('ordo_augustus'), 'ordo_augustus');
  assert.equal(guilds.idFromName('  Ordo   Augustus  '), 'ordo_augustus');
  assert.equal(guilds.idFromName('ARCANUM ASTRALIS'), 'arcanum_astralis');
  assert.equal(guilds.idFromName('Árcanum Astrális'), 'arcanum_astralis');
});

test('guild lookup preserves known typo aliases and rejects unknown guilds', () => {
  const guilds = loadGuilds();

  assert.equal(guilds.idFromName('Arcanum Astrolis'), 'arcanum_astralis');
  assert.equal(guilds.normalizeName('Arcanum Astrolis'), 'Arcanum Astralis');
  assert.equal(guilds.idFromName('Unknown Guild'), null);
  assert.equal(guilds.normalizeName('Unknown Guild'), '');
});

test('nameFromId maps only known guild ids', () => {
  const guilds = loadGuilds();

  assert.equal(guilds.nameFromId('ordo_augustus'), 'Ordo Augustus');
  assert.equal(guilds.nameFromId('missing'), '');
});

test('setGuilds replaces the catalog and supports normalized uppercase ids', () => {
  const guilds = loadGuilds();

  guilds.setGuilds([
    { id: 'PNJ', name: 'PNJ' },
    { id: 'ordo_augustus', name: 'Ordo Augustus' }
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(guilds.GUILDS.map((guild) => guild.id))), ['PNJ', 'ordo_augustus']);
  assert.equal(guilds.idFromName('PNJ'), 'PNJ');
  assert.equal(guilds.idFromName('pnj'), 'PNJ');
  assert.equal(guilds.nameFromId('pnj'), 'PNJ');
});
