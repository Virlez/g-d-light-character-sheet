(function (global) {
    const config = global.CharacterSheetConfig;

    let _client = null;

    function _isConfigured() {
        return (
            config &&
            config.SUPABASE_URL &&
            !config.SUPABASE_URL.includes('YOUR_PROJECT_ID') &&
            typeof global.supabase !== 'undefined'
        );
    }

    function getClient() {
        if (!_client && _isConfigured()) {
            _client = global.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
        }
        return _client;
    }

    function isConfigured() {
        return _isConfigured();
    }

    async function getSession() {
        const client = getClient();
        if (!client) return null;
        try {
            const { data: { session } } = await client.auth.getSession();
            return session;
        } catch (e) {
            return null;
        }
    }

    async function getCurrentUser() {
        const session = await getSession();
        return session ? session.user : null;
    }

    async function signIn(email, password) {
        const client = getClient();
        if (!client) throw new Error('Supabase non configuré');
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    }

    async function signUp(email, password) {
        const client = getClient();
        if (!client) throw new Error('Supabase non configuré');
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) throw error;
        return data;
    }

    async function signOut() {
        const client = getClient();
        if (!client) return;
        await client.auth.signOut();
    }

    function onAuthStateChange(callback) {
        const client = getClient();
        if (!client) return;
        client.auth.onAuthStateChange(callback);
    }

    global.CharacterSheetAuth = {
        isConfigured,
        getClient,
        getSession,
        getCurrentUser,
        signIn,
        signUp,
        signOut,
        onAuthStateChange
    };
})(window);
