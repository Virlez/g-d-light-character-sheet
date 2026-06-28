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

    function _isRetryableAuthError(error) {
        const name = String(error?.name || '').toLowerCase();
        const status = Number(error?.status || 0);
        const message = String(error?.message || '').toLowerCase();
        return (
            name.includes('authretryablefetcherror') ||
            status >= 500 ||
            message.includes('failed to fetch') ||
            message.includes('network')
        );
    }

    async function _withAuthRetry(operation) {
        let result = await operation();
        if (result.error && _isRetryableAuthError(result.error)) {
            result = await operation();
        }
        if (result.error) throw result.error;
        return result.data;
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
        return _withAuthRetry(() => client.auth.signInWithPassword({ email, password }));
    }

    async function signUp(email, password, pseudo) {
        const client = getClient();
        if (!client) throw new Error('Supabase non configuré');
        return _withAuthRetry(() => client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    pseudo
                }
            }
        }));
    }

    async function resetPassword(email) {
        const client = getClient();
        if (!client) throw new Error('Supabase non configuré');
        const redirectTo = global.location.origin + global.location.pathname;
        let result = await client.auth.resetPasswordForEmail(email, { redirectTo });

        // Some projects with custom SMTP/templates can reject redirectTo with opaque 5xx errors.
        // Retry once without redirectTo so Supabase uses its configured Site URL.
        if (result.error && Number(result.error.status || 0) >= 500) {
            result = await client.auth.resetPasswordForEmail(email);
        }

        if (result.error) throw result.error;
        return result.data;
    }

    function _paramsFromLocation() {
        const hashParams = new URLSearchParams((global.location.hash || '').replace(/^#/, ''));
        const searchParams = new URLSearchParams((global.location.search || '').replace(/^\?/, ''));
        return { hashParams, searchParams };
    }

    function _cleanupAuthParams() {
        const url = new URL(global.location.href);
        const removable = [
            'code', 'type', 'token', 'token_hash', 'access_token', 'refresh_token',
            'expires_in', 'expires_at', 'provider_token', 'provider_refresh_token'
        ];

        removable.forEach((key) => {
            url.searchParams.delete(key);
        });

        if (url.hash) {
            const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
            removable.forEach((key) => hashParams.delete(key));
            const nextHash = hashParams.toString();
            url.hash = nextHash ? '#' + nextHash : '';
        }

        global.history.replaceState({}, '', url.toString());
    }

    async function consumeAuthRedirect() {
        const client = getClient();
        if (!client) return { isRecovery: false };

        const { hashParams, searchParams } = _paramsFromLocation();
        const hashType = hashParams.get('type');
        const searchType = searchParams.get('type');
        let isRecovery = hashType === 'recovery' || searchType === 'recovery';
        let consumed = false;

        const code = searchParams.get('code');
        if (code) {
            const { error } = await client.auth.exchangeCodeForSession(code);
            if (error) throw error;
            consumed = true;
        }

        const tokenHash = searchParams.get('token_hash') || hashParams.get('token_hash');
        const tokenType = searchType || hashType;
        if (tokenHash && tokenType === 'recovery') {
            const { error } = await client.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
            if (error) throw error;
            isRecovery = true;
            consumed = true;
        }

        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        if (accessToken && refreshToken) {
            const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (error) throw error;
            consumed = true;
        }

        if (consumed) {
            _cleanupAuthParams();
        }

        return { isRecovery };
    }

    async function updatePassword(password) {
        const client = getClient();
        if (!client) throw new Error('Supabase non configuré');
        return _withAuthRetry(() => client.auth.updateUser({ password }));
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
        consumeAuthRedirect,
        signIn,
        signUp,
        resetPassword,
        updatePassword,
        signOut,
        onAuthStateChange
    };
})(window);
