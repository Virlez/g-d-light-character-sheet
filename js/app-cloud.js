(function (global) {
    const AppGuilds = global.CharacterSheetGuilds;

    function getClient() {
        return global.CharacterSheetAuth.getClient();
    }

    function guildIdFromData(data) {
        return AppGuilds ? AppGuilds.idFromName(data?.guild_name) : null;
    }

    function normalizeSheetDataGuild(data) {
        const guildId = guildIdFromData(data);
        const guildName = guildId && AppGuilds ? AppGuilds.nameFromId(guildId) : '';
        return {
            data: { ...data, guild_name: guildName },
            guildId
        };
    }

    function mapSheetRow(row) {
        return {
            id: row.id,
            name: row.name,
            savedAt: row.saved_at,
            ownerId: row.user_id || null,
            guildId: row.guild_id || null,
            guildName: row.guild_id && AppGuilds ? AppGuilds.nameFromId(row.guild_id) : '',
            imageData: row.image_data || null
        };
    }

    function mapAdminSheetRow(row) {
        return {
            id: row.id,
            name: row.name || 'Sans nom',
            savedAt: row.saved_at,
            ownerId: row.user_id || null,
            ownerPseudo: row.owner_pseudo || '',
            guildId: row.guild_id || null,
            guildName: row.guild_id && AppGuilds ? AppGuilds.nameFromId(row.guild_id) : '',
            totalCount: Number(row.total_count || 0)
        };
    }

    function mapProfile(profile) {
        return {
            id: profile.id,
            pseudo: profile.pseudo,
            email: profile.email,
            role: profile.role || 'user',
            mjGuildId: profile.mj_guild_id || null,
            mjGuildName: profile.mj_guild_id && AppGuilds ? AppGuilds.nameFromId(profile.mj_guild_id) : '',
            disabledAt: profile.disabled_at || null,
            isDisabled: !!profile.disabled_at
        };
    }

    async function listSheets(filters = {}) {
        const client = getClient();
        if (!client) return [];
        let query = client
            .from('sheets')
            .select('id, name, saved_at, image_data, user_id, guild_id')
            .order('saved_at', { ascending: false });
        if (filters.ownerId) query = query.eq('user_id', filters.ownerId);
        if (filters.guildId) query = query.eq('guild_id', filters.guildId);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapSheetRow);
    }

    async function _getUserId(client) {
        const { data: { user } } = await client.auth.getUser();
        return user ? user.id : null;
    }

    async function saveSheet(data, existingId) {
        const client = getClient();
        if (!client) throw new Error('Non connecte');
        const id = existingId || 'sheet_' + Date.now();
        const user_id = await _getUserId(client);
        const normalized = normalizeSheetDataGuild(data);
        const row = {
            id,
            name: normalized.data.char_name || 'Sans nom',
            data: normalized.data,
            image_data: normalized.data.char_image_data || null,
            guild_id: normalized.guildId,
            saved_at: new Date().toISOString()
        };
        if (user_id) row.user_id = user_id;
        const { error } = await client.from('sheets').upsert(row);
        if (error) throw error;
        return id;
    }

    async function loadSheet(id) {
        const client = getClient();
        if (!client) return null;
        const { data, error } = await client
            .from('sheets')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return null;
        const mapped = mapSheetRow(data);
        return { ...mapped, data: data.data };
    }

    async function deleteSheet(id) {
        const client = getClient();
        if (!client) return;
        const { error } = await client.from('sheets').delete().eq('id', id);
        if (error) throw error;
    }

    async function migrateFromLocalStorage() {
        const client = getClient();
        if (!client) return 0;

        const LS_KEY = 'swtor_sheets';
        let local = {};
        try { local = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return 0; }

        const entries = Object.values(local);
        if (entries.length === 0) return 0;

        const user_id = await _getUserId(client);
        const rows = entries.map(entry => {
            const normalized = normalizeSheetDataGuild(entry.data);
            const row = {
                id: entry.id,
                name: entry.name,
                data: normalized.data,
                image_data: normalized.data.char_image_data || null,
                guild_id: normalized.guildId,
                saved_at: entry.savedAt
            };
            if (user_id) row.user_id = user_id;
            return row;
        });

        const { error } = await client.from('sheets').upsert(rows, { onConflict: 'id' });
        if (error) throw error;

        localStorage.removeItem(LS_KEY);
        return entries.length;
    }

    async function getMyProfile() {
        const client = getClient();
        if (!client) return null;
        const userId = await _getUserId(client);
        if (!userId) return null;

        const { data, error } = await client
            .from('profiles')
            .select('id, pseudo, email, role, mj_guild_id, disabled_at')
            .eq('id', userId)
            .maybeSingle();
        if (error) throw error;
        return data ? mapProfile(data) : null;
    }

    async function completeProfile(pseudo) {
        const client = getClient();
        if (!client) throw new Error('Non connecte');
        const { data, error } = await client.rpc('complete_profile', { new_pseudo: pseudo });
        if (error) throw error;
        return data;
    }

    async function listProfiles() {
        const client = getClient();
        if (!client) return [];
        const { data, error } = await client.rpc('list_visible_profiles');
        if (error) throw error;
        return (data || []).map(mapProfile);
    }

    async function setUserRole(userId, role, mjGuildId) {
        const client = getClient();
        if (!client) throw new Error('Non connecte');
        const { data, error } = await client.rpc('admin_set_user_role', {
            target_user_id: userId,
            new_role: role,
            new_mj_guild_id: role === 'mj' ? mjGuildId : null
        });
        if (error) throw error;
        return data;
    }

    async function setUserDisabled(userId, disabled) {
        const client = getClient();
        if (!client) throw new Error('Non connecte');
        const { data, error } = await client.rpc('admin_set_user_disabled', {
            target_user_id: userId,
            disabled
        });
        if (error) throw error;
        return data;
    }

    async function listUnguildedSheets() {
        const client = getClient();
        if (!client) return [];
        const { data, error } = await client
            .from('sheets')
            .select('id, name, saved_at, user_id, guild_id')
            .is('guild_id', null)
            .order('saved_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(row => ({
            id: row.id,
            name: row.name || 'Sans nom',
            savedAt: row.saved_at,
            ownerId: row.user_id || null
        }));
    }

    async function adminListSheets(filters = {}) {
        const client = getClient();
        if (!client) return [];
        const { data, error } = await client.rpc('admin_list_sheets', {
            filter_guild_id: filters.guildId || null,
            filter_user_id: filters.ownerId || null,
            search_name: filters.search || null,
            limit_count: filters.limit || 50,
            offset_count: filters.offset || 0
        });
        if (error) throw error;
        return (data || []).map(mapAdminSheetRow);
    }

    async function assignSheetGuild(sheetId, guildId) {
        const client = getClient();
        if (!client) throw new Error('Non connecte');
        const { data, error } = await client.rpc('admin_assign_sheet_guild', {
            target_sheet_id: sheetId,
            new_guild_id: guildId
        });
        if (error) throw error;
        return data;
    }

    global.CharacterSheetCloud = {
        listSheets,
        saveSheet,
        loadSheet,
        deleteSheet,
        migrateFromLocalStorage,
        getMyProfile,
        completeProfile,
        listProfiles,
        setUserRole,
        setUserDisabled,
        listUnguildedSheets,
        adminListSheets,
        assignSheetGuild
    };
})(window);
