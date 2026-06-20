(function (global) {
    function getClient() {
        return global.CharacterSheetAuth.getClient();
    }

    async function listSheets() {
        const client = getClient();
        if (!client) return [];
        const { data, error } = await client
            .from('sheets')
            .select('id, name, saved_at, data')
            .order('saved_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(row => ({
            id: row.id,
            name: row.name,
            savedAt: row.saved_at,
            imageData: row.data && row.data.char_image_data ? row.data.char_image_data : null
        }));
    }

    async function _getUserId(client) {
        const { data: { user } } = await client.auth.getUser();
        return user ? user.id : null;
    }

    async function saveSheet(data, existingId) {
        const client = getClient();
        if (!client) throw new Error('Non connecté');
        const id = existingId || 'sheet_' + Date.now();
        const user_id = await _getUserId(client);
        const row = { id, name: data.char_name || 'Sans nom', data, saved_at: new Date().toISOString() };
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
        return { id: data.id, name: data.name, savedAt: data.saved_at, data: data.data };
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
            const row = { id: entry.id, name: entry.name, data: entry.data, saved_at: entry.savedAt };
            if (user_id) row.user_id = user_id;
            return row;
        });

        const { error } = await client.from('sheets').upsert(rows, { onConflict: 'id' });
        if (error) throw error;

        localStorage.removeItem(LS_KEY);
        return entries.length;
    }

    global.CharacterSheetCloud = {
        listSheets,
        saveSheet,
        loadSheet,
        deleteSheet,
        migrateFromLocalStorage
    };
})(window);
