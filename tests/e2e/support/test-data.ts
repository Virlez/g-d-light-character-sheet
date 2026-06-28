import path from 'node:path';

export const fixturePath = (...segments: string[]) =>
  path.resolve(__dirname, '..', '..', 'fixtures', ...segments);

export const modernCharacterFixture = fixturePath('sample-character.json');
export const legacyCharacterFixture = fixturePath('legacy-character.json');
export const guildKnownCharacterFixture = fixturePath('guild-known-character.json');
export const guildTypoCharacterFixture = fixturePath('guild-typo-character.json');
export const guildUnknownCharacterFixture = fixturePath('guild-unknown-character.json');
export const portraitFixture = fixturePath('portrait.svg');
