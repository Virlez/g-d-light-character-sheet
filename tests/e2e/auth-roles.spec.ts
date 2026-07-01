import { expect, test, type Page } from '@playwright/test';
import { portraitFixture } from './support/test-data';

type MockProfile = {
  id: string;
  pseudo: string | null;
  email?: string;
  role: 'user' | 'mj' | 'admin';
  mj_guild_id?: string | null;
  disabled_at?: string | null;
};

type MockSheet = {
  id: string;
  name: string;
  saved_at: string;
  user_id: string;
  guild_id?: string | null;
  image_data?: string | null;
  data: Record<string, unknown>;
};

async function installSupabaseMock(
  page: Page,
  options: {
    session?: { user: { id: string; email: string } } | null;
    profiles?: MockProfile[];
    sheets?: MockSheet[];
  } = {}
): Promise<void> {
  const state = {
    session: options.session ?? null,
    profiles: options.profiles ?? [],
    sheets: options.sheets ?? [],
    upsertRows: [] as unknown[],
    queryCounts: { profiles: 0, sheets: 0 },
    selects: [] as Array<{ table: string; columns: string }>,
    signUpPayload: null as unknown,
    signInPayloads: [] as unknown[],
    updateUserPayloads: [] as unknown[],
    signOutCount: 0
  };

  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.__mockSupabaseState = ${JSON.stringify(state)};
        window.supabase = {
          createClient: function () {
            const state = window.__mockSupabaseState;

            function makeQuery(table) {
              const query = {
                _table: table,
                _filters: [],
                _select: '*',
                _single: false,
                select(columns) {
                  this._select = columns || '*';
                  state.selects.push({ table, columns: this._select });
                  return this;
                },
                order() { return this; },
                eq(column, value) {
                  this._filters.push({ column, value });
                  return this;
                },
                is(column, value) {
                  this._filters.push({ column, value, is: true });
                  return this;
                },
                upsert(payload) {
                  const rows = Array.isArray(payload) ? payload : [payload];
                  state.upsertRows.push(...rows);
                  rows.forEach((row) => {
                    const index = state.sheets.findIndex((item) => item.id === row.id);
                    if (index >= 0) state.sheets[index] = { ...state.sheets[index], ...row };
                    else state.sheets.push(row);
                  });
                  return Promise.resolve({ data: rows, error: null });
                },
                single() {
                  this._single = true;
                  return Promise.resolve(resolveQuery(this));
                },
                maybeSingle() {
                  this._single = true;
                  return Promise.resolve(resolveQuery(this, true));
                },
                then(resolve) {
                  return Promise.resolve(resolveQuery(this)).then(resolve);
                }
              };
              return query;
            }

            function resolveQuery(query, maybeSingle) {
              let rows = [];
              if (query._table === 'profiles') {
                state.queryCounts.profiles += 1;
                rows = state.profiles;
              }
              if (query._table === 'sheets') {
                state.queryCounts.sheets += 1;
                rows = state.sheets;
              }

              rows = applySheetRls(query._table, rows);
              rows = rows.filter((row) => query._filters.every((filter) => filter.is ? row[filter.column] === null || typeof row[filter.column] === 'undefined' : row[filter.column] === filter.value));
              if (query._table === 'sheets') rows = rows.slice().sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at)));
              if (query._table === 'profiles') rows = rows.slice().sort((a, b) => String(a.pseudo || '').localeCompare(String(b.pseudo || '')));
              rows = rows.map((row) => projectRow(row, query._select));

              if (query._single) {
                const row = rows[0] || null;
                return { data: row, error: row || maybeSingle ? null : { message: 'not found' } };
              }
              return { data: rows, error: null };
            }

            function projectRow(row, select) {
              if (!select || select === '*') return row;
              const columns = String(select).split(',').map((column) => column.trim()).filter(Boolean);
              return columns.reduce((projected, column) => {
                projected[column] = row[column];
                return projected;
              }, {});
            }

            function currentProfile() {
              return state.session ? state.profiles.find((profile) => profile.id === state.session.user.id) : null;
            }

            function isProfileActive(profile) {
              return !!profile && !profile.disabled_at;
            }

            function ownerIsActive(row) {
              return isProfileActive(state.profiles.find((profile) => profile.id === row.user_id));
            }

            function applySheetRls(table, rows) {
              if (table !== 'sheets' || !state.session) return rows;
              const profile = currentProfile();
              if (!isProfileActive(profile)) return [];
              rows = rows.filter(ownerIsActive);
              if (profile && profile.role === 'admin') return rows;
              if (profile && profile.role === 'mj') {
                return rows.filter((row) => row.user_id === state.session.user.id || row.guild_id === profile.mj_guild_id);
              }
              return rows.filter((row) => row.user_id === state.session.user.id);
            }

            return {
              auth: {
                getSession: async () => ({ data: { session: state.session }, error: null }),
                getUser: async () => ({ data: { user: state.session ? state.session.user : null }, error: null }),
                signInWithPassword: async (payload) => {
                  state.signInPayloads.push(payload);
                  if (payload.password === 'wrong-password') {
                    return { data: {}, error: { message: 'Invalid login credentials', status: 400 } };
                  }
                  return { data: { session: state.session }, error: null };
                },
                signUp: async (payload) => {
                  state.signUpPayload = payload;
                  return { data: { user: { id: 'new-user', email: payload.email } }, error: null };
                },
                resetPasswordForEmail: async () => ({ data: {}, error: null }),
                updateUser: async (payload) => {
                  state.updateUserPayloads.push(payload);
                  if (payload.email && state.session) {
                    state.session.user.email = payload.email;
                    const profile = currentProfile();
                    if (profile) profile.email = payload.email;
                  }
                  return { data: { user: state.session ? state.session.user : null }, error: null };
                },
                signOut: async () => {
                  state.signOutCount += 1;
                  state.session = null;
                  return { error: null };
                },
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
              },
              from: makeQuery,
              rpc: async (name, params) => {
                if (name === 'list_visible_profiles') {
                  const profile = currentProfile();
                  if (profile && profile.role === 'admin' && !profile.disabled_at) {
                    return { data: state.profiles.slice().sort((a, b) => String(a.pseudo || '').localeCompare(String(b.pseudo || ''))), error: null };
                  }
                  if (profile && profile.role === 'mj' && !profile.disabled_at) {
                    const visibleOwnerIds = new Set(state.sheets
                      .filter((sheet) => sheet.guild_id === profile.mj_guild_id)
                      .map((sheet) => sheet.user_id));
                    visibleOwnerIds.add(profile.id);
                    return {
                      data: state.profiles
                        .filter((item) => visibleOwnerIds.has(item.id) && (item.id === profile.id || !item.disabled_at))
                        .sort((a, b) => String(a.pseudo || '').localeCompare(String(b.pseudo || ''))),
                      error: null
                    };
                  }
                  return { data: profile ? [profile] : [], error: null };
                }
                if (name === 'admin_list_sheets') {
                  const profile = currentProfile();
                  if (!profile || profile.role !== 'admin' || profile.disabled_at) return { data: [], error: null };
                  const search = String(params.search_name || '').trim().toLowerCase();
                  let rows = state.sheets
                    .filter(ownerIsActive)
                    .filter((sheet) => !params.filter_guild_id || (params.filter_guild_id === '__none__' ? !sheet.guild_id : sheet.guild_id === params.filter_guild_id))
                    .filter((sheet) => !params.filter_user_id || sheet.user_id === params.filter_user_id)
                    .filter((sheet) => !search || String(sheet.name || '').toLowerCase().includes(search))
                    .sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at)));
                  const total = rows.length;
                  rows = rows.slice(params.offset_count || 0, (params.offset_count || 0) + (params.limit_count || 50));
                  return {
                    data: rows.map((sheet) => ({
                      id: sheet.id,
                      name: sheet.name,
                      saved_at: sheet.saved_at,
                      user_id: sheet.user_id,
                      guild_id: sheet.guild_id || null,
                      owner_pseudo: state.profiles.find((item) => item.id === sheet.user_id)?.pseudo || null,
                      total_count: total
                    })),
                    error: null
                  };
                }
                if (name === 'mj_list_player_sheets') {
                  const profile = currentProfile();
                  if (!profile || profile.role !== 'mj' || profile.disabled_at) return { data: [], error: null };
                  const search = String(params.search_name || '').trim().toLowerCase();
                  let rows = state.sheets
                    .filter(ownerIsActive)
                    .filter((sheet) => sheet.guild_id === profile.mj_guild_id)
                    .filter((sheet) => sheet.user_id !== profile.id)
                    .filter((sheet) => !params.filter_user_id || sheet.user_id === params.filter_user_id)
                    .filter((sheet) => !search || String(sheet.name || '').toLowerCase().includes(search))
                    .sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at)));
                  const total = rows.length;
                  rows = rows.slice(params.offset_count || 0, (params.offset_count || 0) + (params.limit_count || 50));
                  return {
                    data: rows.map((sheet) => ({
                      id: sheet.id,
                      name: sheet.name,
                      saved_at: sheet.saved_at,
                      user_id: sheet.user_id,
                      guild_id: sheet.guild_id || null,
                      owner_pseudo: state.profiles.find((item) => item.id === sheet.user_id)?.pseudo || null,
                      total_count: total
                    })),
                    error: null
                  };
                }
                if (name === 'complete_profile') {
                  let profile = state.profiles.find((item) => item.id === state.session.user.id);
                  if (!profile) {
                    profile = { id: state.session.user.id, email: state.session.user.email, pseudo: null, role: 'user' };
                    state.profiles.push(profile);
                  }
                  profile.pseudo = params.new_pseudo;
                  return { data: profile, error: null };
                }
                if (name === 'admin_set_user_role') {
                  const profile = state.profiles.find((item) => item.id === params.target_user_id);
                  if (profile) {
                    profile.role = params.new_role;
                    profile.mj_guild_id = params.new_role === 'mj' ? params.new_mj_guild_id : null;
                  }
                  return { data: profile || null, error: null };
                }
                if (name === 'admin_set_user_disabled') {
                  const profile = state.profiles.find((item) => item.id === params.target_user_id);
                  if (profile) profile.disabled_at = params.disabled ? '2026-06-28T12:00:00.000Z' : null;
                  return { data: profile || null, error: null };
                }
                if (name === 'admin_assign_sheet_guild') {
                  const sheet = state.sheets.find((item) => item.id === params.target_sheet_id);
                  if (sheet) {
                    sheet.guild_id = params.new_guild_id;
                    const guildName = params.new_guild_id === 'ordo_augustus' ? 'Ordo Augustus' : 'Arcanum Astralis';
                    sheet.data = { ...sheet.data, guild_name: guildName };
                  }
                  return { data: sheet || null, error: null };
                }
                return { data: null, error: null };
              }
            };
          }
        };
      `
    });
  });
}

test.describe('Auth profiles and roles', () => {
  test('lets visitors use the sheet creator in persistent guest mode', async ({ page }) => {
    await installSupabaseMock(page);
    await page.goto('/');

    await expect(page.locator('#authView')).toBeVisible();
    await page.getByRole('button', { name: 'Continuer sans compte' }).click();

    await expect(page.getByTestId('sheet-root')).toBeVisible();
    await expect(page.locator('#sheetGuestBar')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('sheet-root')).toBeVisible();
    await expect(page.locator('#authView')).toBeHidden();

    await page.locator('#sheetGuestBar').getByRole('button', { name: 'Connexion' }).click();
    await expect(page.locator('#authView')).toBeVisible();
  });

  test('requires a pseudo on signup and sends it to Supabase metadata', async ({ page }) => {
    await installSupabaseMock(page);
    await page.goto('/');

    await page.locator('#authTabRegister').click();
    await page.locator('#authEmail').fill('new@example.com');
    await page.locator('#authPassword').fill('Password1!');
    await page.locator('#authSubmitBtn').click();
    await expect(page.locator('#authMessage')).toContainText('Pseudo requis');

    await page.locator('#authPseudo').fill('Nova');
    await page.locator('#authSubmitBtn').click();

    const payload = await page.evaluate(() => (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState?.signUpPayload);
    expect(payload.options.data.pseudo).toBe('Nova');
  });

  test('blocks an existing user without pseudo until profile completion', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'user-1', email: 'player@example.com' } },
      profiles: [{ id: 'user-1', email: 'player@example.com', pseudo: null, role: 'user' }]
    });

    await page.goto('/');
    await expect(page.locator('#profileSetupView')).toBeVisible();
    await expect(page.locator('#homeView')).toBeHidden();

    await page.locator('#profileSetupPseudo').fill('Kara');
    await page.locator('#profileSetupSubmitBtn').click();

    await expect(page.locator('#homeView')).toBeVisible();
    await expect(page.locator('#homeUserName')).toHaveText('Kara');
  });

  test('blocks a disabled account after login', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'user-1', email: 'player@example.com' } },
      profiles: [{
        id: 'user-1',
        email: 'player@example.com',
        pseudo: 'Kara',
        role: 'user',
        disabled_at: '2026-06-28T12:00:00.000Z'
      }]
    });

    await page.goto('/');
    await expect(page.getByTestId('disabled-account-view')).toBeVisible();
    await expect(page.locator('#homeView')).toBeHidden();
  });

  test('lets a connected user update their email after password verification', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'user-1', email: 'player@example.com' } },
      profiles: [{ id: 'user-1', email: 'player@example.com', pseudo: 'Kara', role: 'user' }]
    });

    await page.goto('/');
    await page.locator('#homeUserName').click();
    await expect(page.getByTestId('account-modal')).toBeVisible();

    await page.locator('#accountNewEmail').fill('new@example.com');
    await page.locator('#accountEmailCurrentPassword').fill('Password1!');
    await page.getByTestId('account-email-form').locator('button[type="submit"]').click();

    await expect(page.locator('#accountEmailMessage')).toContainText('Demande envoyée');
    const state = await page.evaluate(() => (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState);
    expect(state.signInPayloads).toContainEqual({ email: 'player@example.com', password: 'Password1!' });
    expect(state.updateUserPayloads).toContainEqual({ email: 'new@example.com' });
  });

  test('does not update account data when current password is invalid', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'user-1', email: 'player@example.com' } },
      profiles: [{ id: 'user-1', email: 'player@example.com', pseudo: 'Kara', role: 'user' }]
    });

    await page.goto('/');
    await page.locator('#homeUserName').click();
    await page.locator('#accountNewEmail').fill('new@example.com');
    await page.locator('#accountEmailCurrentPassword').fill('wrong-password');
    await page.getByTestId('account-email-form').locator('button[type="submit"]').click();

    await expect(page.locator('#accountEmailMessage')).toContainText('E-mail ou mot de passe incorrect');
    const state = await page.evaluate(() => (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState);
    expect(state.signInPayloads).toContainEqual({ email: 'player@example.com', password: 'wrong-password' });
    expect(state.updateUserPayloads).toEqual([]);
  });

  test('lets a connected user update their password then signs them out', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'user-1', email: 'player@example.com' } },
      profiles: [{ id: 'user-1', email: 'player@example.com', pseudo: 'Kara', role: 'user' }]
    });

    await page.goto('/');
    await page.locator('#homeUserName').click();
    await page.locator('#accountPasswordCurrentPassword').fill('Password1!');
    await page.locator('#accountNewPassword').fill('NewPassword1!');
    await page.locator('#accountNewPasswordConfirm').fill('NewPassword1!');
    await page.getByTestId('account-password-form').locator('button[type="submit"]').click();

    await expect(page.locator('#authView')).toBeVisible();
    await expect(page.locator('#authMessage')).toContainText('Mot de passe mis à jour');
    const state = await page.evaluate(() => (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState);
    expect(state.signInPayloads).toContainEqual({ email: 'player@example.com', password: 'Password1!' });
    expect(state.updateUserPayloads).toContainEqual({ password: 'NewPassword1!' });
    expect(state.signOutCount).toBe(1);
  });

  test('opens a same-guild sheet read-only for a MJ', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'gm-1', email: 'gm@example.com' } },
      profiles: [
        { id: 'gm-1', email: 'gm@example.com', pseudo: 'Le MJ', role: 'mj', mj_guild_id: 'ordo_augustus' },
        { id: 'player-1', email: 'player@example.com', pseudo: 'Kara', role: 'user' },
        { id: 'player-3', email: 'nova@example.com', pseudo: 'Nova', role: 'user' }
      ],
      sheets: [{
        id: 'sheet-own',
        name: 'MJ Perso',
        saved_at: '2026-06-28T11:00:00.000Z',
        user_id: 'gm-1',
        guild_id: 'ordo_augustus',
        data: { char_name: 'MJ Perso', player_name: 'Le MJ', guild_name: 'Ordo Augustus' }
      }, {
        id: 'sheet-1',
        name: 'Kara Venn',
        saved_at: '2026-06-28T12:00:00.000Z',
        user_id: 'player-1',
        guild_id: 'ordo_augustus',
        image_data: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        data: { char_name: 'Kara Venn', player_name: 'Kara', guild_name: 'Ordo Augustus' }
      }, {
        id: 'sheet-3',
        name: 'Nova Sol',
        saved_at: '2026-06-28T12:30:00.000Z',
        user_id: 'player-3',
        guild_id: 'ordo_augustus',
        image_data: 'data:image/svg+xml;base64,PG5vdmE+',
        data: { char_name: 'Nova Sol', player_name: 'Nova', guild_name: 'Ordo Augustus' }
      }, {
        id: 'sheet-2',
        name: 'Voss Rae',
        saved_at: '2026-06-28T13:00:00.000Z',
        user_id: 'player-2',
        guild_id: 'arcanum_astralis',
        data: { char_name: 'Voss Rae', player_name: 'Voss', guild_name: 'Arcanum Astralis' }
      }]
    });

    await page.goto('/');
    await expect(page.locator('#homeUserRole')).toHaveText('MJ - Ordo Augustus');
    await expect(page.getByTestId('home-sheet-tabs')).toContainText('Mes personnages');
    await expect(page.locator('#homeSheetList')).toContainText('MJ Perso');
    await expect(page.locator('#homeSheetList')).not.toContainText('Kara Venn');

    await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      state.selects = [];
    });
    await page.getByTestId('home-sheet-tab-players').click();
    await expect(page.getByTestId('mj-player-sheet-owner-filter')).toBeVisible();
    await expect(page.getByTestId('mj-player-sheet-search')).toBeVisible();
    await expect(page.getByTestId('mj-player-sheet-count')).toHaveText('2 / 2 fiche(s)');
    await expect(page.locator('#homeSheetList')).toContainText('Joueur : Kara');
    await expect(page.locator('#homeSheetList')).toContainText('Kara Venn');
    await expect(page.locator('#homeSheetList')).toContainText('Joueur : Nova');
    await expect(page.locator('#homeSheetList')).toContainText('Nova Sol');
    await expect(page.locator('#homeSheetList')).not.toContainText('MJ Perso');
    await expect(page.locator('#homeSheetList')).not.toContainText('Voss Rae');
    await expect(page.locator('#homeSheetList img')).toHaveCount(0);

    await page.getByTestId('mj-player-sheet-owner-filter').selectOption('player-1');
    await expect(page.getByTestId('mj-player-sheet-count')).toHaveText('1 / 1 fiche(s)');
    await expect(page.locator('#homeSheetList')).toContainText('Kara Venn');
    await expect(page.locator('#homeSheetList')).not.toContainText('Nova Sol');

    await page.getByTestId('mj-player-sheet-search').fill('kara');
    await page.waitForTimeout(350);
    await expect(page.locator('#homeSheetList')).toContainText('Kara Venn');

    const sheetListSelects = await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      return state.selects
        .filter((entry: any) => entry.table === 'sheets')
        .map((entry: any) => entry.columns);
    });
    expect(sheetListSelects).not.toContain('image_data');
    expect(sheetListSelects).not.toContain('*');
    expect(sheetListSelects).not.toContain('id, name, saved_at, user_id, guild_id');
    expect(sheetListSelects).not.toContain('id, name, saved_at, image_data, user_id, guild_id');
    expect(sheetListSelects).not.toContain('id, name, saved_at, data, user_id, guild_id');

    await page.getByTestId('mj-player-sheet-row').filter({ hasText: 'Kara Venn' }).getByText('Ouvrir').click();
    await expect(page.locator('#char_name')).toHaveValue('Kara Venn');
    await expect(page.locator('#char_name')).toBeDisabled();
    await expect(page.locator('#sheetBackButton')).toContainText('Retour');
    await expect(page.getByTestId('import-json-button')).toBeHidden();
  });

  test('shows the user administration page to admins', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'admin-1', email: 'admin@example.com' } },
      profiles: [
        { id: 'admin-1', email: 'admin@example.com', pseudo: 'Admin', role: 'admin' },
        { id: 'player-1', email: 'player@example.com', pseudo: 'Kara', role: 'user' }
      ]
    });

    await page.goto('/');
    await page.locator('#adminPanelToggle').click();

    await expect(page.locator('#adminView')).toBeVisible();
    await expect(page.locator('#homeView')).toBeHidden();
    await expect(page.getByTestId('admin-panel')).toBeVisible();
    await expect(page.getByTestId('admin-user-list')).toContainText('Kara');
    await expect(page.getByTestId('admin-role-select')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Fiches sans guilde' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Toutes les fiches' })).toHaveCount(0);
  });

  test('lets an admin disable and reactivate a user account', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'admin-1', email: 'admin@example.com' } },
      profiles: [
        { id: 'admin-1', email: 'admin@example.com', pseudo: 'Admin', role: 'admin' },
        { id: 'player-1', email: 'player@example.com', pseudo: 'Kara', role: 'user' }
      ],
      sheets: [{
        id: 'sheet-1',
        name: 'Sans Guilde',
        saved_at: '2026-06-28T12:00:00.000Z',
        user_id: 'player-1',
        guild_id: null,
        data: { char_name: 'Sans Guilde' }
      }]
    });

    await page.goto('/');
    await page.locator('#adminPanelToggle').click();
    const playerRow = page.getByTestId('admin-user-row').filter({ hasText: 'Kara' });
    await expect(playerRow).toContainText('Actif');

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Désactiver le compte de Kara');
      await dialog.accept();
    });
    await playerRow.getByTestId('admin-disable-toggle').click();
    await expect(playerRow).toContainText('Désactivé');

    let profile = await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      return state.profiles.find((item: any) => item.id === 'player-1');
    });
    expect(profile.disabled_at).toBeTruthy();

    await page.getByRole('button', { name: 'Mes fiches' }).click();
    await page.getByTestId('home-sheet-tab-unguilded').click();
    await expect(page.locator('#homeSheetList')).not.toContainText('Sans Guilde');
    await page.locator('#adminPanelToggle').click();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Réactiver le compte de Kara');
      await dialog.accept();
    });
    await page.getByTestId('admin-user-row').filter({ hasText: 'Kara' }).getByTestId('admin-disable-toggle').click();
    await expect(page.getByTestId('admin-user-row').filter({ hasText: 'Kara' })).toContainText('Actif');

    profile = await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      return state.profiles.find((item: any) => item.id === 'player-1');
    });
    expect(profile.disabled_at).toBeNull();
  });

  test('lets an admin assign a MJ guild and classify unguilded sheets', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'admin-1', email: 'admin@example.com' } },
      profiles: [
        { id: 'admin-1', email: 'admin@example.com', pseudo: 'Admin', role: 'admin' },
        { id: 'gm-1', email: 'gm@example.com', pseudo: 'Le MJ', role: 'user' },
        { id: 'player-1', email: 'player@example.com', pseudo: 'Kara', role: 'user' }
      ],
      sheets: [{
        id: 'admin-sheet',
        name: 'Admin Perso',
        saved_at: '2026-06-28T11:00:00.000Z',
        user_id: 'admin-1',
        guild_id: 'ordo_augustus',
        data: { char_name: 'Admin Perso', guild_name: 'Ordo Augustus' }
      }, {
        id: 'sheet-1',
        name: 'Sans Guilde',
        saved_at: '2026-06-28T12:00:00.000Z',
        user_id: 'player-1',
        guild_id: null,
        data: { char_name: 'Sans Guilde' }
      }]
    });

    await page.goto('/');
    await expect(page.getByTestId('home-sheet-tabs')).toContainText('Mes fiches');
    await expect(page.locator('#homeSheetList')).toContainText('Admin Perso');
    await expect(page.locator('#homeSheetList')).not.toContainText('Sans Guilde');

    await page.locator('#adminPanelToggle').click();

    await page.locator('#role-gm-1').selectOption('mj');
    await expect(page.locator('#mj-guild-gm-1')).toBeVisible();
    await page.locator('#mj-guild-gm-1').selectOption('arcanum_astralis');

    let gmProfile = await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      return state.profiles.find((profile: any) => profile.id === 'gm-1');
    });
    expect(gmProfile.role).toBe('mj');
    expect(gmProfile.mj_guild_id).toBe('arcanum_astralis');

    await page.getByRole('button', { name: 'Mes fiches' }).click();
    await page.getByTestId('home-sheet-tab-unguilded').click();
    await expect(page.getByTestId('home-unguilded-row')).toContainText('Sans Guilde');
    await expect(page.getByTestId('home-unguilded-row')).toContainText('Joueur : Kara');
    await expect(page.getByTestId('home-apply-guild-assignments')).toBeDisabled();
    const unguildedSelects = await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      return state.selects
        .filter((entry: any) => entry.table === 'sheets')
        .map((entry: any) => entry.columns);
    });
    expect(unguildedSelects).toContain('id, name, saved_at, user_id, guild_id');

    const sheetQueryCountBeforeSelect = await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      return state.queryCounts.sheets;
    });
    await page.getByTestId('home-assign-guild-select').selectOption('ordo_augustus');
    await expect(page.getByTestId('home-assign-guild-select')).toHaveValue('ordo_augustus');
    await expect(page.getByTestId('home-apply-guild-assignments')).toBeEnabled();
    await expect(page.getByTestId('home-apply-guild-assignments')).toContainText('Valider les changements (1)');
    const sheetQueryCountAfterSelect = await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      return state.queryCounts.sheets;
    });
    expect(sheetQueryCountAfterSelect).toBe(sheetQueryCountBeforeSelect);

    let sheet = await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      return state.sheets.find((item: any) => item.id === 'sheet-1');
    });
    expect(sheet.guild_id).toBeNull();

    await page.getByTestId('home-apply-guild-assignments').click();

    sheet = await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      return state.sheets.find((item: any) => item.id === 'sheet-1');
    });
    expect(sheet.guild_id).toBe('ordo_augustus');
    expect(sheet.data.guild_name).toBe('Ordo Augustus');
  });

  test('lets an admin browse all sheets with filters and open others read-only', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'admin-1', email: 'admin@example.com' } },
      profiles: [
        { id: 'admin-1', email: 'admin@example.com', pseudo: 'Admin', role: 'admin' },
        { id: 'player-1', email: 'kara@example.com', pseudo: 'Kara', role: 'user' },
        { id: 'player-2', email: 'voss@example.com', pseudo: 'Voss', role: 'user' },
        { id: 'disabled-1', email: 'old@example.com', pseudo: 'Old', role: 'user', disabled_at: '2026-06-28T12:00:00.000Z' }
      ],
      sheets: [{
        id: 'admin-sheet',
        name: 'Admin Perso',
        saved_at: '2026-06-28T10:00:00.000Z',
        user_id: 'admin-1',
        guild_id: 'ordo_augustus',
        data: { char_name: 'Admin Perso', guild_name: 'Ordo Augustus' }
      }, {
        id: 'sheet-kara-1',
        name: 'Langer Hakar',
        saved_at: '2026-06-28T12:00:00.000Z',
        user_id: 'player-1',
        guild_id: 'ordo_augustus',
        data: { char_name: 'Langer Hakar', player_name: 'Kara', guild_name: 'Ordo Augustus' }
      }, {
        id: 'sheet-voss-1',
        name: 'Maerv Rixen',
        saved_at: '2026-06-28T13:00:00.000Z',
        user_id: 'player-2',
        guild_id: 'arcanum_astralis',
        data: { char_name: 'Maerv Rixen', player_name: 'Voss', guild_name: 'Arcanum Astralis' }
      }, {
        id: 'sheet-kara-2',
        name: 'Sans Guilde',
        saved_at: '2026-06-28T11:00:00.000Z',
        user_id: 'player-1',
        guild_id: null,
        data: { char_name: 'Sans Guilde', player_name: 'Kara' }
      }, {
        id: 'sheet-disabled',
        name: 'Cachee',
        saved_at: '2026-06-28T14:00:00.000Z',
        user_id: 'disabled-1',
        guild_id: 'ordo_augustus',
        data: { char_name: 'Cachee' }
      }]
    });

    await page.goto('/');
    await expect(page.getByTestId('home-sheet-tabs')).toContainText('Toutes les fiches');
    await page.getByTestId('home-sheet-tab-sheets').click();

    await expect(page.locator('#homeSheetList')).toContainText('Langer Hakar');
    await expect(page.locator('#homeSheetList')).toContainText('Maerv Rixen');
    await expect(page.locator('#homeSheetList')).not.toContainText('Cachee');
    await expect(page.getByTestId('admin-sheet-count')).toHaveText('4 / 4 fiche(s)');

    await page.getByTestId('admin-sheet-guild-filter').selectOption('arcanum_astralis');
    await expect(page.locator('#homeSheetList')).toContainText('Maerv Rixen');
    await expect(page.locator('#homeSheetList')).not.toContainText('Langer Hakar');

    await page.getByTestId('admin-sheet-guild-filter').selectOption('');
    await page.getByTestId('admin-sheet-owner-filter').selectOption('player-1');
    await expect(page.locator('#homeSheetList')).toContainText('Langer Hakar');
    await expect(page.locator('#homeSheetList')).toContainText('Sans Guilde');
    await expect(page.locator('#homeSheetList')).not.toContainText('Maerv Rixen');

    await page.getByTestId('admin-sheet-search').fill('langer');
    await expect(page.locator('#homeSheetList')).toContainText('Langer Hakar');
    await expect(page.locator('#homeSheetList')).not.toContainText('Sans Guilde');

    await page.getByTestId('admin-sheet-row').filter({ hasText: 'Langer Hakar' }).getByText('Ouvrir').click();
    await expect(page.locator('#char_name')).toHaveValue('Langer Hakar');
    await expect(page.locator('#char_name')).toBeDisabled();
    await expect(page.locator('#sheetBackButton')).toContainText('Retour');
  });

  test('saves the selected character guild as guild_id in cloud storage', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'user-1', email: 'player@example.com' } },
      profiles: [{ id: 'user-1', email: 'player@example.com', pseudo: 'Kara', role: 'user' }]
    });

    await page.goto('/');
    await page.getByText('+ Nouvelle Fiche').click();
    await page.locator('#char_name').fill('Kara Venn');
    await page.locator('#guild_name').selectOption('Arcanum Astralis');
    await page.getByTestId('photo-upload-input').setInputFiles(portraitFixture);
    await expect(page.getByTestId('photo-preview')).not.toHaveClass(/hidden/);
    await expect.poll(async () => {
      return page.getByTestId('photo-preview').evaluate((element) => (element as HTMLElement).style.backgroundImage);
    }).toContain('data:image');
    await Promise.all([
      page.waitForEvent('dialog').then((dialog) => dialog.accept()),
      page.evaluate(async () => {
        await (window as Window & { saveSheetLocally?: () => Promise<void> }).saveSheetLocally?.();
      })
    ]);

    const saved = await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      return state.upsertRows[state.upsertRows.length - 1];
    });
    expect(saved.guild_id).toBe('arcanum_astralis');
    expect(saved.data.guild_name).toBe('Arcanum Astralis');
    expect(saved.image_data).toContain('data:image/svg+xml');
  });

  test('autosaves connected user edits to cloud storage', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'user-1', email: 'player@example.com' } },
      profiles: [{ id: 'user-1', email: 'player@example.com', pseudo: 'Kara', role: 'user' }]
    });

    await page.goto('/');
    await page.getByText('+ Nouvelle Fiche').click();
    await page.locator('#char_name').fill('Autosave Hero');
    await page.locator('#player_name').fill('Autosave Player');
    await page.locator('#guild_name').selectOption('Ordo Augustus');

    await expect.poll(async () => {
      return page.evaluate(() => {
        const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
        return state.upsertRows.find((row: any) => row.data?.char_name === 'Autosave Hero' && row.guild_id === 'ordo_augustus') || null;
      });
    }).not.toBeNull();

    const saved = await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      return state.upsertRows.find((row: any) => row.data?.char_name === 'Autosave Hero' && row.guild_id === 'ordo_augustus');
    });

    expect(saved).toMatchObject({
      name: 'Autosave Hero',
      user_id: 'user-1',
      guild_id: 'ordo_augustus'
    });
    expect(saved.data).toMatchObject({
      char_name: 'Autosave Hero',
      player_name: 'Autosave Player',
      guild_name: 'Ordo Augustus'
    });
  });

  test('restores the connected user active sheet after a browser reload', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'user-1', email: 'player@example.com' } },
      profiles: [{ id: 'user-1', email: 'player@example.com', pseudo: 'Kara', role: 'user' }],
      sheets: [{
        id: 'sheet-cloud-resume',
        name: 'Cloud Resume',
        saved_at: '2026-06-28T12:00:00.000Z',
        user_id: 'user-1',
        guild_id: 'ordo_augustus',
        data: {
          char_name: 'Cloud Resume',
          player_name: 'Cloud Player',
          guild_name: 'Ordo Augustus'
        }
      }]
    });

    await page.goto('/');
    await page.locator('#homeSheetList').getByText('Cloud Resume').click();
    await expect(page.locator('#char_name')).toHaveValue('Cloud Resume');
    await expect.poll(async () => {
      return page.evaluate(() => JSON.parse(localStorage.getItem('swtor_active_sheet') || 'null')?.mode);
    }).toBe('cloud');

    await page.reload();

    await expect(page.locator('#char_name')).toHaveValue('Cloud Resume');
    await expect(page.locator('#player_name')).toHaveValue('Cloud Player');
    await expect(page.locator('#guild_name')).toHaveValue('Ordo Augustus');
  });

  test('does not autosave read-only sheets opened by a MJ', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'gm-1', email: 'gm@example.com' } },
      profiles: [
        { id: 'gm-1', email: 'gm@example.com', pseudo: 'Le MJ', role: 'mj', mj_guild_id: 'ordo_augustus' },
        { id: 'player-1', email: 'player@example.com', pseudo: 'Kara', role: 'user' }
      ],
      sheets: [{
        id: 'sheet-player',
        name: 'Kara Venn',
        saved_at: '2026-06-28T12:00:00.000Z',
        user_id: 'player-1',
        guild_id: 'ordo_augustus',
        data: { char_name: 'Kara Venn', guild_name: 'Ordo Augustus' }
      }]
    });

    await page.goto('/');
    await page.getByTestId('home-sheet-tab-players').click();
    await page.getByTestId('mj-player-sheet-row').filter({ hasText: 'Kara Venn' }).getByText('Ouvrir').click();

    await expect(page.locator('#char_name')).toBeDisabled();
    await page.evaluate(() => {
      const input = document.getElementById('char_name') as HTMLInputElement | null;
      if (!input) return;
      input.value = 'Should Not Save';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.waitForTimeout(1000);
    const upsertCount = await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      return state.upsertRows.length;
    });
    expect(upsertCount).toBe(0);
  });
});
