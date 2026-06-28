import { expect, test, type Page } from '@playwright/test';

type MockProfile = {
  id: string;
  pseudo: string | null;
  email?: string;
  role: 'user' | 'mj' | 'admin';
  mj_guild_id?: string | null;
};

type MockSheet = {
  id: string;
  name: string;
  saved_at: string;
  user_id: string;
  guild_id?: string | null;
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
    signUpPayload: null as unknown
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
                _single: false,
                select() { return this; },
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
              if (query._table === 'profiles') rows = state.profiles;
              if (query._table === 'sheets') rows = state.sheets;

              rows = applySheetRls(query._table, rows);
              rows = rows.filter((row) => query._filters.every((filter) => filter.is ? row[filter.column] === null || typeof row[filter.column] === 'undefined' : row[filter.column] === filter.value));
              if (query._table === 'sheets') rows = rows.slice().sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at)));
              if (query._table === 'profiles') rows = rows.slice().sort((a, b) => String(a.pseudo || '').localeCompare(String(b.pseudo || '')));

              if (query._single) {
                const row = rows[0] || null;
                return { data: row, error: row || maybeSingle ? null : { message: 'not found' } };
              }
              return { data: rows, error: null };
            }

            function currentProfile() {
              return state.session ? state.profiles.find((profile) => profile.id === state.session.user.id) : null;
            }

            function applySheetRls(table, rows) {
              if (table !== 'sheets' || !state.session) return rows;
              const profile = currentProfile();
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
                signInWithPassword: async () => ({ data: { session: state.session }, error: null }),
                signUp: async (payload) => {
                  state.signUpPayload = payload;
                  return { data: { user: { id: 'new-user', email: payload.email } }, error: null };
                },
                resetPasswordForEmail: async () => ({ data: {}, error: null }),
                updateUser: async () => ({ data: {}, error: null }),
                signOut: async () => {
                  state.session = null;
                  return { error: null };
                },
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
              },
              from: makeQuery,
              rpc: async (name, params) => {
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

  test('opens a same-guild sheet read-only for a MJ', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'gm-1', email: 'gm@example.com' } },
      profiles: [
        { id: 'gm-1', email: 'gm@example.com', pseudo: 'Le MJ', role: 'mj', mj_guild_id: 'ordo_augustus' },
        { id: 'player-1', email: 'player@example.com', pseudo: 'Kara', role: 'user' }
      ],
      sheets: [{
        id: 'sheet-1',
        name: 'Kara Venn',
        saved_at: '2026-06-28T12:00:00.000Z',
        user_id: 'player-1',
        guild_id: 'ordo_augustus',
        data: { char_name: 'Kara Venn', player_name: 'Kara', guild_name: 'Ordo Augustus' }
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
    await expect(page.locator('#homeSheetList')).toContainText('Joueur : Kara');
    await expect(page.locator('#homeSheetList')).not.toContainText('Voss Rae');

    await page.getByText('Ouvrir').click();
    await expect(page.locator('#char_name')).toHaveValue('Kara Venn');
    await expect(page.locator('#char_name')).toBeDisabled();
    await expect(page.getByTestId('import-json-button')).toBeHidden();
  });

  test('shows the user role admin panel to admins', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'admin-1', email: 'admin@example.com' } },
      profiles: [
        { id: 'admin-1', email: 'admin@example.com', pseudo: 'Admin', role: 'admin' },
        { id: 'player-1', email: 'player@example.com', pseudo: 'Kara', role: 'user' }
      ]
    });

    await page.goto('/');
    await page.locator('#adminPanelToggle').click();

    await expect(page.getByTestId('admin-panel')).toBeVisible();
    await expect(page.getByTestId('admin-user-list')).toContainText('Kara');
    await expect(page.getByTestId('admin-role-select')).toHaveCount(2);
  });

  test('lets an admin assign a MJ guild and classify unguilded sheets', async ({ page }) => {
    await installSupabaseMock(page, {
      session: { user: { id: 'admin-1', email: 'admin@example.com' } },
      profiles: [
        { id: 'admin-1', email: 'admin@example.com', pseudo: 'Admin', role: 'admin' },
        { id: 'gm-1', email: 'gm@example.com', pseudo: 'Le MJ', role: 'user' }
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

    await page.locator('#role-gm-1').selectOption('mj');
    await expect(page.locator('#mj-guild-gm-1')).toBeVisible();
    await page.locator('#mj-guild-gm-1').selectOption('arcanum_astralis');

    let gmProfile = await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      return state.profiles.find((profile: any) => profile.id === 'gm-1');
    });
    expect(gmProfile.role).toBe('mj');
    expect(gmProfile.mj_guild_id).toBe('arcanum_astralis');

    await page.locator('#adminUnguildedTab').click();
    await expect(page.getByTestId('admin-unguilded-list')).toContainText('Sans Guilde');
    await page.getByTestId('admin-assign-guild-select').selectOption('ordo_augustus');

    const sheet = await page.evaluate(() => {
      const state = (window as Window & { __mockSupabaseState?: any }).__mockSupabaseState;
      return state.sheets.find((item: any) => item.id === 'sheet-1');
    });
    expect(sheet.guild_id).toBe('ordo_augustus');
    expect(sheet.data.guild_name).toBe('Ordo Augustus');
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
  });
});
