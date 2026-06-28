(function (global) {
    const GUILDS = [
        { id: 'ordo_augustus', name: 'Ordo Augustus' },
        { id: 'arcanum_astralis', name: 'Arcanum Astralis' }
    ];

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
        return GUILDS.find((guild) => guild.id === aliasedKey || normalize(guild.name) === aliasedKey) || null;
    }

    function idFromName(value) {
        return findGuild(value)?.id || null;
    }

    function nameFromId(id) {
        return GUILDS.find((guild) => guild.id === id)?.name || '';
    }

    function normalizeName(value) {
        return findGuild(value)?.name || '';
    }

    global.CharacterSheetGuilds = {
        GUILDS,
        findGuild,
        idFromName,
        nameFromId,
        normalizeName
    };
})(window);
