(function (global) {
    const DEFAULT_GUILDS = [
        { id: 'ordo_augustus', name: 'Ordo Augustus' },
        { id: 'arcanum_astralis', name: 'Arcanum Astralis' }
    ];
    const GUILDS = DEFAULT_GUILDS.slice();

    const ALIASES = {
        arcanum_astrolis: 'arcanum_astralis'
    };

    function normalize(value) {
        return String(value || '')
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function findGuild(value) {
        const key = normalize(value);
        if (!key) return null;
        const aliasedKey = ALIASES[key] || key;
        return GUILDS.find((guild) => (
            guild.id === String(value || '').trim() ||
            normalize(guild.id) === aliasedKey ||
            normalize(guild.name) === aliasedKey
        )) || null;
    }

    function idFromName(value) {
        return findGuild(value)?.id || null;
    }

    function nameFromId(id) {
        return findGuild(id)?.name || '';
    }

    function normalizeName(value) {
        return findGuild(value)?.name || '';
    }

    function setGuilds(nextGuilds) {
        const normalizedGuilds = (Array.isArray(nextGuilds) ? nextGuilds : [])
            .map((guild) => ({
                id: String(guild?.id || '').trim(),
                name: String(guild?.name || '').trim()
            }))
            .filter((guild) => guild.id && guild.name);
        if (normalizedGuilds.length === 0) return GUILDS;

        const seen = new Set();
        GUILDS.splice(0, GUILDS.length, ...normalizedGuilds.filter((guild) => {
            const key = normalize(guild.id);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }));
        return GUILDS;
    }

    global.CharacterSheetGuilds = {
        GUILDS,
        DEFAULT_GUILDS,
        findGuild,
        idFromName,
        nameFromId,
        normalizeName,
        setGuilds
    };
})(window);
