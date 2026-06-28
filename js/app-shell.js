(function (global) {
    const AppLogic = global.CharacterSheetLogic;
    const AppPersistence = global.CharacterSheetPersistence;
    const AppWeapons = global.CharacterSheetWeapons;
    const AppImage = global.CharacterSheetImage;
    const AppPdf = global.CharacterSheetPdf;
    const AppStats = global.CharacterSheetStats;
    const AppAuth = global.CharacterSheetAuth;
    const AppCloud = global.CharacterSheetCloud;
    const AppGuilds = global.CharacterSheetGuilds;

    function createCharacterSheetApp() {
        const imgInput = document.getElementById('imgUpload');
        const imgPreview = document.getElementById('imgPreview');
        let currentImageData = null;
        let currentSheetId = null;
        let currentSheetOwnerId = null;
        let currentSheetReadOnly = false;
        let currentProfile = null;
        let adminPanelTab = 'users';
        let homeSheetTab = 'all';
        const sheetImageCache = new Map();
        let pendingUnguildedGuildAssignments = {};
        const adminSheetsPageSize = 50;
        let adminSheetsFilters = { guildId: '', ownerId: '', search: '' };
        let adminSheetsRows = [];
        let adminSheetsOffset = 0;
        let adminSheetsHasMore = false;
        let adminSheetsSearchTimer = null;
        let adminSheetsRenderTargetId = 'adminSheetsList';
        const mjPlayerSheetsPageSize = 50;
        let mjPlayerSheetsFilters = { ownerId: '', search: '' };
        let mjPlayerSheetsRows = [];
        let mjPlayerSheetsOffset = 0;
        let mjPlayerSheetsHasMore = false;
        let mjPlayerSheetsSearchTimer = null;
        let authMode = 'login';
        let autosaveTimer = null;
        let autosaveInFlight = false;
        let autosaveQueued = false;
        const toNumber = (value) => AppLogic.toNumber(value);

        function autoExpandTextarea(textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }

        function initTextareas() {
            document.querySelectorAll('textarea').forEach((textarea) => {
                textarea.addEventListener('input', function () {
                    autoExpandTextarea(this);
                });
                autoExpandTextarea(textarea);
            });
        }

        function addWeapon() {
            renderWeapon();
            scheduleAutosave(250);
        }

        function deleteWeapon(button) {
            AppWeapons.deleteWeapon(button, { computeAllWeaponTotals });
            scheduleAutosave(250);
        }

        function renderWeapon(data = {}) {
            return AppWeapons.renderWeapon(data, {
                computeAllWeaponTotals,
                deleteWeapon
            });
        }

        function wireWeaponRow(item) {
            AppWeapons.wireWeaponRow(item, {
                computeAllWeaponTotals,
                deleteWeapon
            });
        }

        function computeAllWeaponTotals() {
            AppWeapons.computeAllWeaponTotals({ toNumber });
        }

        function ensureMoveUI() {
            AppImage.ensureMoveUI({ imgInput, imgPreview });
        }

        function bindImageFeature() {
            if (!imgInput) return;
            AppImage.bindImageInput({
                imgInput,
                imgPreview,
                ensureMoveUI,
                onImageChange: (imageData) => {
                    currentImageData = imageData;
                    scheduleAutosave(250);
                }
            });
        }

        function updateInvPA() {
            return AppStats.updateInvPA({ computeDerivedStats });
        }

        function computeDerivedStats() {
            return AppStats.computeDerivedStats({
                computeAllWeaponTotals,
                computeForceAttack
            });
        }

        function computeForceAttack() {
            return AppStats.computeForceAttack();
        }

        function initSheet() {
            return AppStats.initSheet({
                computeDerivedStats,
                wireWeaponRow,
                toNumber,
                updateInvPA,
                computeForceAttack
            });
        }

        AppStats.installInitLifecycle({ initSheet });
        const publicUpdateInvPA = AppStats.installGlobalUpdateInvPAWrapper(updateInvPA);

        async function persistCurrentSheet(options = {}) {
            const silent = !!options.silent;
            if (currentSheetReadOnly) return currentSheetId;

            try { computeAllWeaponTotals(); } catch (error) {}
            try { computeDerivedStats(); } catch (error) {}

            const data = AppPersistence.collectExportData({ currentImageData, toNumber });
            const isUpdate = currentSheetId !== null;

            currentSheetId = isLoggedIn()
                ? await AppCloud.saveSheet(data, currentSheetId)
                : AppPersistence.saveSheetToLocalStorage(data, currentSheetId);

            if (!silent) {
                alert(isUpdate ? 'Fiche mise à jour !' : 'Fiche sauvegardée !');
            }

            return currentSheetId;
        }

        async function flushAutosave() {
            if (autosaveInFlight) {
                autosaveQueued = true;
                return;
            }

            autosaveInFlight = true;
            try {
                await persistCurrentSheet({ silent: true });
            } catch (error) {
                console.error('[autosave]', error);
            } finally {
                autosaveInFlight = false;
                if (autosaveQueued) {
                    autosaveQueued = false;
                    scheduleAutosave(300);
                }
            }
        }

        function scheduleAutosave(delay = 800) {
            if (currentSheetReadOnly) return;
            if (document.getElementById('sheetView')?.classList.contains('hidden')) return;
            if (autosaveTimer) clearTimeout(autosaveTimer);
            autosaveTimer = setTimeout(() => {
                autosaveTimer = null;
                flushAutosave();
            }, delay);
        }

        function installAutosave() {
            const sheetRoot = document.getElementById('sheetRoot');
            if (!sheetRoot) return;

            const handleFieldChange = (event) => {
                const target = event.target;
                if (!target || !target.matches('input, textarea, select')) return;
                if (target.type === 'file') return;
                scheduleAutosave();
            };

            sheetRoot.addEventListener('input', handleFieldChange, true);
            sheetRoot.addEventListener('change', handleFieldChange, true);
        }

        function exportJSON() {
            try { computeAllWeaponTotals(); } catch (error) {}
            try { computeDerivedStats(); } catch (error) {}

            const data = AppPersistence.collectExportData({
                currentImageData,
                toNumber
            });
            AppPersistence.triggerJsonDownload(data);
        }

        function resetImage() {
            currentImageData = null;
            AppImage.resetImageUI({ imgInput, imgPreview });
        }

        function importJSON(inputElement) {
            const file = inputElement.files[0];
            if (!file) return;

            AppPersistence.importJsonFile(file, {
                resetImage,
                renderWeapon,
                imgPreview,
                imgInput,
                ensureMoveUI,
                autoExpandTextarea,
                updateInvPA: publicUpdateInvPA,
                computeDerivedStats
            }).then((result) => {
                currentImageData = result.currentImageData;
                scheduleAutosave(250);
                alert('Fiche chargée avec succès !');
            }).catch((error) => {
                console.error(error);
                alert('Erreur lors de la lecture du fichier JSON.');
            });

            inputElement.value = '';
            computeDerivedStats();
        }

        function resetSheet() {
            if (!confirm("Attention : Vous êtes sur le point d'effacer toutes les données de la fiche. Continuer ?")) {
                return;
            }

            AppPersistence.resetSheetState({
                resetImage,
                renderWeapon,
                updateInvPA: publicUpdateInvPA,
                computeDerivedStats
            });
            scheduleAutosave(0);
        }

        function clearPdfExportPreviewClone() {
            AppPdf.clearPdfExportPreviewClone();
        }

        async function buildPdfExportClone(options = {}) {
            return AppPdf.buildPdfExportClone(options);
        }

        async function preparePdfExportPreviewForTests() {
            return AppPdf.preparePdfExportPreviewForTests();
        }

        async function exportScreenshotPDF() {
            return AppPdf.exportScreenshotPDF();
        }

        async function exportScreenshotJPEG() {
            return AppPdf.exportScreenshotJPEG();
        }

        async function saveSheetLocally() {
            try {
                await persistCurrentSheet();
            } catch (e) {
                alert('Erreur lors de la sauvegarde.');
            }
        }

        function openStoragePanel() {
            renderStorageList();
            document.getElementById('localStoragePanel').classList.remove('hidden');
        }

        function closeStoragePanel() {
            document.getElementById('localStoragePanel').classList.add('hidden');
        }

        function renderStorageList() {
            const list = document.getElementById('localStorageList');
            if (!list) return;
            const sheets = AppPersistence.listSheetsFromLocalStorage();

            if (sheets.length === 0) {
                list.innerHTML = '<p class="text-gray-500 text-center py-8">Aucune fiche sauvegardée</p>';
                return;
            }

            list.innerHTML = sheets.map(sheet => {
                const date = new Date(sheet.savedAt).toLocaleString('fr-FR');
                const escapedName = String(sheet.name)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                return `<div class="flex items-center justify-between bg-[#002e33] border border-[#004e53] rounded p-3">
                    <div>
                        <div class="text-[#00f0ff] font-bold">${escapedName}</div>
                        <div class="text-gray-400 text-xs">${date}</div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="loadSheetFromStorage('${sheet.id}')"
                                class="bg-[#004e53] hover:bg-[#00f0ff] hover:text-black text-[#00f0ff] px-3 py-1 rounded text-sm uppercase font-bold transition-colors">
                            Charger
                        </button>
                        <button onclick="deleteSheetFromStorage('${sheet.id}')"
                                class="hover:bg-red-900 hover:text-red-400 text-gray-500 px-3 py-1 rounded text-sm font-bold transition-colors">
                            ✕
                        </button>
                    </div>
                </div>`;
            }).join('');
        }

        async function loadSheetFromStorage(id) {
            const entry = AppPersistence.loadSheetFromLocalStorage(id);
            if (!entry) { alert('Fiche introuvable.'); return; }

            const result = AppPersistence.applySheetData(entry.data, {
                resetImage,
                renderWeapon,
                imgPreview,
                imgInput,
                ensureMoveUI,
                autoExpandTextarea,
                updateInvPA: publicUpdateInvPA,
                computeDerivedStats
            });
            currentImageData = result.currentImageData;
            currentSheetId = id;
            currentSheetOwnerId = null;
            setReadOnlyMode(false);
            closeStoragePanel();
        }

        function deleteSheetFromStorage(id) {
            if (!confirm('Supprimer cette fiche ?')) return;
            AppPersistence.deleteSheetFromLocalStorage(id);
            renderStorageList();
        }

        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function isLoggedIn() {
            return !!(window.__currentSession);
        }

        function getCurrentUserId() {
            return window.__currentSession?.user?.id || null;
        }

        function isPrivilegedRole() {
            return currentProfile?.role === 'mj' || currentProfile?.role === 'admin';
        }

        function isAdminRole() {
            return currentProfile?.role === 'admin';
        }

        function canEditSheet(ownerId) {
            if (!isLoggedIn()) return true;
            return !ownerId || ownerId === getCurrentUserId();
        }

        function setReadOnlyMode(readOnly) {
            currentSheetReadOnly = !!readOnly;
            const sheetRoot = document.getElementById('sheetRoot');
            if (sheetRoot) {
                sheetRoot.querySelectorAll('input, textarea, select, button').forEach((element) => {
                    if (element.id === 'importFile') {
                        element.disabled = readOnly;
                        return;
                    }
                    element.disabled = readOnly;
                });
                sheetRoot.classList.toggle('opacity-80', readOnly);
            }

            const importAction = document.querySelector('[data-testid="import-json-button"]')?.closest('.fab-item');
            if (importAction) importAction.classList.toggle('hidden', readOnly);
        }

        function updateCurrentUserBar() {
            const user = window.__currentSession?.user || null;
            const displayName = currentProfile?.pseudo || user?.email || '';
            const role = currentProfile?.role || 'user';
            const nameEl = document.getElementById('homeUserName');
            const roleEl = document.getElementById('homeUserRole');
            const userBar = document.getElementById('homeUserBar');
            const adminToggle = document.getElementById('adminPanelToggle');

            if (nameEl) nameEl.textContent = displayName;
            if (roleEl) {
                const shouldShowRole = role === 'mj' || role === 'admin';
                roleEl.textContent = role === 'admin'
                    ? 'Admin'
                    : currentProfile?.mjGuildName
                        ? `MJ - ${currentProfile.mjGuildName}`
                        : 'MJ';
                roleEl.classList.toggle('hidden', !shouldShowRole);
            }
            if (userBar) userBar.classList.toggle('hidden', !displayName);
            if (adminToggle) adminToggle.classList.toggle('hidden', !isAdminRole());
        }

        function showHomeView() {
            updateCurrentUserBar();

            renderHomeView();
            document.getElementById('authView')?.classList.add('hidden');
            document.getElementById('profileSetupView')?.classList.add('hidden');
            document.getElementById('disabledAccountView')?.classList.add('hidden');
            document.getElementById('homeView')?.classList.remove('hidden');
            document.getElementById('adminView')?.classList.add('hidden');
            document.getElementById('sheetView')?.classList.add('hidden');
            document.getElementById('fabMenu')?.classList.add('hidden');
            closeFabMenu();
        }

        function showSheetView() {
            const backLabel = document.getElementById('sheetBackButtonLabel');
            if (backLabel) {
                backLabel.textContent = canEditSheet(currentSheetOwnerId) ? 'Mes fiches' : 'Retour';
            }
            document.getElementById('authView')?.classList.add('hidden');
            document.getElementById('profileSetupView')?.classList.add('hidden');
            document.getElementById('disabledAccountView')?.classList.add('hidden');
            document.getElementById('homeView')?.classList.add('hidden');
            document.getElementById('adminView')?.classList.add('hidden');
            document.getElementById('sheetView')?.classList.remove('hidden');
            document.getElementById('fabMenu')?.classList.remove('hidden');
        }

        async function showAdminView() {
            if (!isAdminRole()) return;
            updateCurrentUserBar();
            document.getElementById('authView')?.classList.add('hidden');
            document.getElementById('profileSetupView')?.classList.add('hidden');
            document.getElementById('disabledAccountView')?.classList.add('hidden');
            document.getElementById('homeView')?.classList.add('hidden');
            document.getElementById('adminView')?.classList.remove('hidden');
            document.getElementById('sheetView')?.classList.add('hidden');
            document.getElementById('fabMenu')?.classList.add('hidden');
            closeFabMenu();
            await switchAdminTab(adminPanelTab);
        }

        async function renderHomeView() {
            const list = document.getElementById('homeSheetList');
            if (!list) return;

            let sheets;
            let profilesById = {};
            if (isLoggedIn()) {
                list.innerHTML = '<div class="col-span-full text-center py-16"><p class="text-gray-500 text-xs uppercase tracking-widest">Chargement...</p></div>';
                try {
                    sheets = await AppCloud.listSheets();
                    if (currentProfile?.role === 'mj') {
                        sheets = sheets.filter(sheet => sheet.guildId && sheet.guildId === currentProfile.mjGuildId);
                    }
                    const needsOwnerProfiles = (
                        (currentProfile?.role === 'admin' && homeSheetTab === 'unguilded') ||
                        (currentProfile?.role === 'mj' && homeSheetTab === 'players')
                    );
                    if (needsOwnerProfiles) {
                        const profiles = await AppCloud.listProfiles();
                        profilesById = Object.fromEntries(profiles.map(profile => [profile.id, profile]));
                    }
                } catch (e) {
                    list.innerHTML = '<div class="col-span-full text-center py-16"><p class="text-red-400 text-xs uppercase tracking-widest">Erreur de chargement</p></div>';
                    return;
                }
            } else {
                sheets = AppPersistence.listSheetsFromLocalStorage();
            }

            if (sheets.length === 0) {
                list.innerHTML = `<div class="col-span-full text-center py-16">
                    <p class="text-5xl opacity-10 mb-4">&#9632;</p>
                    <p class="text-gray-500 uppercase tracking-widest text-sm">Aucune fiche sauvegardée</p>
                    <p class="text-gray-600 text-xs mt-1">Créez votre première fiche ci-dessous</p>
                </div>`;
                return;
            }

            list.innerHTML = sheets.map(sheet => {
                const date = new Date(sheet.savedAt).toLocaleString('fr-FR');
                const name = escapeHtml(sheet.name);
                const owner = sheet.ownerId ? profilesById[sheet.ownerId] : null;
                const ownerName = owner?.pseudo ? escapeHtml(owner.pseudo) : '';
                const ownerHtml = ownerName
                    ? `<div class="text-gray-400 text-xs mt-1">Joueur : ${ownerName}</div>`
                    : '';
                const guildHtml = sheet.guildName
                    ? `<div class="text-gray-500 text-xs mt-1">Guilde : ${escapeHtml(sheet.guildName)}</div>`
                    : '';
                const canDelete = canEditSheet(sheet.ownerId);
                const deleteHtml = canDelete
                    ? `<button onclick="deleteSheetFromHome('${sheet.id}')"
                                class="py-2 px-4 text-gray-600 hover:text-red-400 hover:bg-red-900/20 text-sm transition-colors border-l border-[#004e53]">
                            &#x2715;
                        </button>`
                    : '';
                const safeSrc = sheet.imageData && sheet.imageData.startsWith('data:image/') ? sheet.imageData : null;
                const imgHtml = safeSrc
                    ? `<img src="${safeSrc}" class="w-full h-full object-cover" style="object-position: center 20%" alt="">`
                    : `<div class="w-full h-full flex items-center justify-center text-5xl opacity-10">&#9632;</div>`;
                return `<div class="bg-[#001a1f] border border-[#004e53] rounded-lg overflow-hidden hover:border-[#00f0ff] transition-colors">
                    <div class="h-52 bg-[#002e33] overflow-hidden cursor-pointer" onclick="openSheetFromHome('${sheet.id}')">${imgHtml}</div>
                    <div class="p-3 cursor-pointer" onclick="openSheetFromHome('${sheet.id}')">
                        <div class="text-[#00f0ff] font-bold text-base truncate">${name}</div>
                        <div class="text-gray-500 text-xs mt-1">${date}</div>
                        ${ownerHtml}
                        ${guildHtml}
                    </div>
                    <div class="flex border-t border-[#004e53]">
                        <button onclick="openSheetFromHome('${sheet.id}')"
                                class="flex-1 py-2 text-[#00f0ff] hover:bg-[#004e53] text-xs uppercase font-bold tracking-wider transition-colors">
                            Ouvrir
                        </button>
                        ${deleteHtml}
                    </div>
                </div>`;
            }).join('');
        }

        function getHomeSheetTabs() {
            if (currentProfile?.role === 'admin') {
                return [
                    { id: 'mine', label: 'Mes fiches' },
                    { id: 'unguilded', label: 'Fiches sans guilde' },
                    { id: 'sheets', label: 'Toutes les fiches' }
                ];
            }
            if (currentProfile?.role === 'mj') {
                return [
                    { id: 'mine', label: 'Mes personnages' },
                    { id: 'players', label: 'Fiches des joueurs' }
                ];
            }
            return [];
        }

        function renderHomeSheetTabs() {
            const tabsEl = document.getElementById('homeSheetTabs');
            if (!tabsEl) return;

            const tabs = getHomeSheetTabs();
            if (tabs.length === 0) {
                tabsEl.classList.add('hidden');
                tabsEl.innerHTML = '';
                homeSheetTab = 'all';
                return;
            }

            if (!tabs.some(tab => tab.id === homeSheetTab)) homeSheetTab = tabs[0].id;
            tabsEl.classList.remove('hidden');
            tabsEl.innerHTML = tabs.map((tab) => {
                const active = tab.id === homeSheetTab;
                const className = active
                    ? 'px-4 py-2 text-xs uppercase font-bold tracking-widest border border-[#00f0ff] text-[#00f0ff] rounded'
                    : 'px-4 py-2 text-xs uppercase font-bold tracking-widest border border-[#004e53] text-gray-500 hover:text-[#00f0ff] rounded transition-colors';
                return `<button type="button" data-testid="home-sheet-tab-${tab.id}" onclick="switchHomeSheetTab('${tab.id}')" class="${className}">${tab.label}</button>`;
            }).join('');
        }

        function isOwnedSheet(sheet) {
            if (!isLoggedIn()) return true;
            return sheet.ownerId === getCurrentUserId();
        }

        function isUnguildedSheet(sheet) {
            return !sheet.guildId;
        }

        function isOtherPlayerGuildSheet(sheet) {
            return (
                currentProfile?.role === 'mj' &&
                sheet.ownerId !== getCurrentUserId() &&
                sheet.guildId &&
                sheet.guildId === currentProfile.mjGuildId
            );
        }

        function emptyHomeMessage() {
            if (currentProfile?.role === 'admin' && homeSheetTab === 'unguilded') return 'Aucune fiche sans guilde';
            if (currentProfile?.role === 'admin' && homeSheetTab === 'sheets') return 'Aucune fiche';
            if (currentProfile?.role === 'mj' && homeSheetTab === 'players') return 'Aucune fiche de joueur';
            return 'Aucune fiche sauvegardee';
        }

        function renderEmptyHomeList(list) {
            list.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10 min-h-[160px]';
            list.innerHTML = `<div class="col-span-full text-center py-16">
                <p class="text-5xl opacity-10 mb-4">&#9632;</p>
                <p class="text-gray-500 uppercase tracking-widest text-sm">${emptyHomeMessage()}</p>
                <p class="text-gray-600 text-xs mt-1">Creez votre premiere fiche ci-dessous</p>
            </div>`;
        }

        async function loadSheetCardImage(placeholder) {
            const sheetId = placeholder?.dataset?.sheetImageId;
            if (!sheetId || !isLoggedIn()) return;

            try {
                let imageData;
                if (sheetImageCache.has(sheetId)) {
                    imageData = await sheetImageCache.get(sheetId);
                } else {
                    const imagePromise = AppCloud.getSheetImage(sheetId);
                    sheetImageCache.set(sheetId, imagePromise);
                    imageData = await imagePromise;
                }

                if (!imageData || !imageData.startsWith('data:image/')) return;
                placeholder.className = 'w-full h-full';
                placeholder.innerHTML = `<img src="${imageData}" class="w-full h-full object-cover" style="object-position: center 20%" alt="">`;
                placeholder.removeAttribute('data-sheet-image-id');
            } catch (error) {
                console.error('[sheet:image]', error);
            }
        }

        function hydrateSheetCardImages(list) {
            if (!isLoggedIn()) return;
            const placeholders = Array.from(list.querySelectorAll('[data-sheet-image-id]'));
            if (placeholders.length === 0) return;

            if (!('IntersectionObserver' in window)) {
                placeholders.slice(0, 6).forEach(loadSheetCardImage);
                return;
            }

            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    observer.unobserve(entry.target);
                    loadSheetCardImage(entry.target);
                });
            }, { rootMargin: '300px 0px' });

            placeholders.forEach((placeholder) => observer.observe(placeholder));
        }

        function renderSheetCards(list, sheets, profilesById) {
            list.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10 min-h-[160px]';
            list.innerHTML = sheets.map(sheet => {
                const date = new Date(sheet.savedAt).toLocaleString('fr-FR');
                const name = escapeHtml(sheet.name);
                const owner = sheet.ownerId ? profilesById[sheet.ownerId] : null;
                const ownerName = owner?.pseudo ? escapeHtml(owner.pseudo) : '';
                const ownerHtml = ownerName
                    ? `<div class="text-gray-400 text-xs mt-1">Joueur : ${ownerName}</div>`
                    : '';
                const guildHtml = sheet.guildName
                    ? `<div class="text-gray-500 text-xs mt-1">Guilde : ${escapeHtml(sheet.guildName)}</div>`
                    : '';
                const canDelete = canEditSheet(sheet.ownerId);
                const deleteHtml = canDelete
                    ? `<button onclick="deleteSheetFromHome('${sheet.id}')"
                                class="py-2 px-4 text-gray-600 hover:text-red-400 hover:bg-red-900/20 text-sm transition-colors border-l border-[#004e53]">
                            &#x2715;
                        </button>`
                    : '';
                const safeSrc = sheet.imageData && sheet.imageData.startsWith('data:image/') ? sheet.imageData : null;
                const imgHtml = safeSrc
                    ? `<img src="${safeSrc}" class="w-full h-full object-cover" style="object-position: center 20%" alt="">`
                    : `<div class="w-full h-full flex items-center justify-center text-5xl opacity-10" ${isLoggedIn() ? `data-sheet-image-id="${sheet.id}"` : ''}>&#9632;</div>`;
                return `<div class="bg-[#001a1f] border border-[#004e53] rounded-lg overflow-hidden hover:border-[#00f0ff] transition-colors">
                    <div class="h-52 bg-[#002e33] overflow-hidden cursor-pointer" onclick="openSheetFromHome('${sheet.id}')">${imgHtml}</div>
                    <div class="p-3 cursor-pointer" onclick="openSheetFromHome('${sheet.id}')">
                        <div class="text-[#00f0ff] font-bold text-base truncate">${name}</div>
                        <div class="text-gray-500 text-xs mt-1">${date}</div>
                        ${ownerHtml}
                        ${guildHtml}
                    </div>
                    <div class="flex border-t border-[#004e53]">
                        <button onclick="openSheetFromHome('${sheet.id}')"
                                class="flex-1 py-2 text-[#00f0ff] hover:bg-[#004e53] text-xs uppercase font-bold tracking-wider transition-colors">
                            Ouvrir
                        </button>
                        ${deleteHtml}
                    </div>
                </div>`;
            }).join('');
            hydrateSheetCardImages(list);
        }

        function renderUnguildedSheetRows(list, sheets, profilesById) {
            list.className = 'flex flex-col gap-3 mb-10 min-h-[160px]';
            const rowsHtml = sheets.map((sheet) => {
                const owner = sheet.ownerId ? profilesById[sheet.ownerId] : null;
                const ownerName = escapeHtml(owner?.pseudo || 'Pseudo inconnu');
                const name = escapeHtml(sheet.name || 'Sans nom');
                const selectedGuildId = pendingUnguildedGuildAssignments[sheet.id] || '';
                return `<div data-testid="home-unguilded-row" class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#001a1f] border border-[#004e53] rounded-lg p-3">
                    <div class="min-w-0">
                        <div class="text-[#00f0ff] font-bold truncate">${name}</div>
                        <div class="text-gray-400 text-xs mt-1">Joueur : ${ownerName}</div>
                    </div>
                    <select data-testid="home-assign-guild-select" onchange="handlePendingUnguildedGuildChange('${sheet.id}', this.value)"
                            class="bg-[#001a1f] border border-[#004e53] text-[#00f0ff] rounded px-2 py-1 text-sm">
                        <option value="">Choisir une guilde</option>
                        ${guildOptionsHtml(selectedGuildId)}
                    </select>
                </div>`;
            }).join('');
            const pendingCount = Object.keys(pendingUnguildedGuildAssignments).filter((sheetId) => pendingUnguildedGuildAssignments[sheetId]).length;
            const buttonDisabled = pendingCount === 0 ? 'disabled' : '';
            const buttonClass = pendingCount === 0
                ? 'bg-[#002e33] text-gray-600 border border-[#004e53] px-5 py-2 rounded clip-corner uppercase font-bold tracking-widest text-sm cursor-not-allowed'
                : 'bg-[#004e53] hover:bg-[#00f0ff] hover:text-black text-[#00f0ff] border border-[#00f0ff] px-5 py-2 rounded clip-corner uppercase font-bold tracking-widest text-sm transition-colors';
            list.innerHTML = `${rowsHtml}
                <div class="flex justify-end pt-2">
                    <button type="button" data-testid="home-apply-guild-assignments" onclick="applyPendingUnguildedGuildAssignments()" ${buttonDisabled}
                            class="${buttonClass}">
                        Valider les changements${pendingCount ? ` (${pendingCount})` : ''}
                    </button>
                </div>`;
        }

        function updatePendingUnguildedApplyButton() {
            const button = document.querySelector('[data-testid="home-apply-guild-assignments"]');
            if (!button) return;

            const pendingCount = Object.keys(pendingUnguildedGuildAssignments)
                .filter((sheetId) => pendingUnguildedGuildAssignments[sheetId])
                .length;
            const disabled = pendingCount === 0;
            button.disabled = disabled;
            button.textContent = `Valider les changements${pendingCount ? ` (${pendingCount})` : ''}`;
            button.className = disabled
                ? 'bg-[#002e33] text-gray-600 border border-[#004e53] px-5 py-2 rounded clip-corner uppercase font-bold tracking-widest text-sm cursor-not-allowed'
                : 'bg-[#004e53] hover:bg-[#00f0ff] hover:text-black text-[#00f0ff] border border-[#00f0ff] px-5 py-2 rounded clip-corner uppercase font-bold tracking-widest text-sm transition-colors';
        }

        function filterHomeSheets(sheets) {
            if (currentProfile?.role === 'admin') {
                if (homeSheetTab === 'sheets') return sheets;
                return homeSheetTab === 'unguilded' ? sheets.filter(isUnguildedSheet) : sheets;
            }
            if (currentProfile?.role === 'mj') {
                return homeSheetTab === 'players' ? sheets.filter(sheet => !isOwnedSheet(sheet)) : sheets;
            }
            return sheets;
        }

        function getHomeSheetQueryOptions() {
            if (!isLoggedIn()) return {};
            if (currentProfile?.role === 'admin') {
                if (homeSheetTab === 'sheets') return { adminAllSheets: true };
                return homeSheetTab === 'unguilded'
                    ? { unguildedOnly: true }
                    : { ownerId: getCurrentUserId() };
            }
            if (currentProfile?.role === 'mj') {
                return homeSheetTab === 'players'
                    ? { mjPlayerSheets: true }
                    : { ownerId: getCurrentUserId() };
            }
            return {};
        }

        async function switchHomeSheetTab(tab) {
            homeSheetTab = tab;
            await renderHomeView();
        }

        async function renderHomeView() {
            const list = document.getElementById('homeSheetList');
            if (!list) return;

            renderHomeSheetTabs();

            let sheets;
            let profilesById = {};
            if (isLoggedIn()) {
                list.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10 min-h-[160px]';
                list.innerHTML = '<div class="col-span-full text-center py-16"><p class="text-gray-500 text-xs uppercase tracking-widest">Chargement...</p></div>';
                try {
                    const queryOptions = getHomeSheetQueryOptions();
                    if (queryOptions.adminAllSheets) {
                        await renderAdminAllSheetsPanel({ targetId: 'homeSheetList' });
                        return;
                    }
                    if (queryOptions.mjPlayerSheets) {
                        await renderMjPlayerSheetsPanel({ targetId: 'homeSheetList' });
                        return;
                    }
                    sheets = queryOptions.unguildedOnly
                        ? await AppCloud.listUnguildedSheets()
                        : await AppCloud.listSheets(queryOptions);
                    if (isPrivilegedRole()) {
                        const profiles = await AppCloud.listProfiles();
                        profilesById = Object.fromEntries(profiles.map(profile => [profile.id, profile]));
                    }
                } catch (e) {
                    list.innerHTML = '<div class="col-span-full text-center py-16"><p class="text-red-400 text-xs uppercase tracking-widest">Erreur de chargement</p></div>';
                    return;
                }
            } else {
                sheets = AppPersistence.listSheetsFromLocalStorage();
            }

            const visibleSheets = filterHomeSheets(sheets);
            if (visibleSheets.length === 0) {
                renderEmptyHomeList(list);
                return;
            }

            if (currentProfile?.role === 'admin' && homeSheetTab === 'unguilded') {
                renderUnguildedSheetRows(list, visibleSheets, profilesById);
                return;
            }

            renderSheetCards(list, visibleSheets, profilesById);
        }

        function newSheet() {
            currentSheetId = null;
            currentSheetOwnerId = getCurrentUserId();
            setReadOnlyMode(false);
            AppPersistence.resetSheetState({
                resetImage,
                renderWeapon,
                updateInvPA: publicUpdateInvPA,
                computeDerivedStats
            });
            showSheetView();
        }

        async function openSheetFromHome(id) {
            const entry = isLoggedIn()
                ? await AppCloud.loadSheet(id)
                : AppPersistence.loadSheetFromLocalStorage(id);
            if (!entry) { alert('Fiche introuvable.'); return; }
            currentSheetOwnerId = entry.ownerId || null;
            setReadOnlyMode(!canEditSheet(currentSheetOwnerId));
            const result = AppPersistence.applySheetData(entry.data, {
                resetImage, renderWeapon, imgPreview, imgInput,
                ensureMoveUI, autoExpandTextarea,
                updateInvPA: publicUpdateInvPA, computeDerivedStats
            });
            currentImageData = result.currentImageData;
            currentSheetId = id;
            showSheetView();
            setReadOnlyMode(!canEditSheet(currentSheetOwnerId));
            // Re-expand after the sheet is visible (scrollHeight is 0 while hidden)
            requestAnimationFrame(() => document.querySelectorAll('textarea').forEach(autoExpandTextarea));
        }

        async function deleteSheetFromHome(id) {
            if (!confirm('Supprimer cette fiche ?')) return;
            if (currentSheetId === id) currentSheetId = null;
            if (isLoggedIn()) {
                await AppCloud.deleteSheet(id);
            } else {
                AppPersistence.deleteSheetFromLocalStorage(id);
            }
            renderHomeView();
        }

        function importJSONFromHome(inputElement) {
            const file = inputElement.files[0];
            if (!file) return;

            AppPersistence.importJsonFile(file, {
                resetImage, renderWeapon, imgPreview, imgInput,
                ensureMoveUI, autoExpandTextarea,
                updateInvPA: publicUpdateInvPA, computeDerivedStats
            }).then(async (result) => {
                currentImageData = result.currentImageData;
                const data = AppPersistence.collectExportData({ currentImageData: result.currentImageData, toNumber });
                currentSheetId = isLoggedIn()
                    ? await AppCloud.saveSheet(data, null)
                    : AppPersistence.saveSheetToLocalStorage(data, null);
                currentSheetOwnerId = getCurrentUserId();
                setReadOnlyMode(false);
                showSheetView();
                requestAnimationFrame(() => document.querySelectorAll('textarea').forEach(autoExpandTextarea));
            }).catch((error) => {
                console.error(error);
                alert('Erreur lors de la lecture du fichier JSON.');
            });

            inputElement.value = '';
        }

        function showAuthView() {
            document.getElementById('authView')?.classList.remove('hidden');
            document.getElementById('profileSetupView')?.classList.add('hidden');
            document.getElementById('disabledAccountView')?.classList.add('hidden');
            document.getElementById('homeView')?.classList.add('hidden');
            document.getElementById('adminView')?.classList.add('hidden');
            document.getElementById('sheetView')?.classList.add('hidden');
            document.getElementById('fabMenu')?.classList.add('hidden');
            closeFabMenu();
        }

        function showProfileSetupView() {
            document.getElementById('authView')?.classList.add('hidden');
            document.getElementById('profileSetupView')?.classList.remove('hidden');
            document.getElementById('disabledAccountView')?.classList.add('hidden');
            document.getElementById('homeView')?.classList.add('hidden');
            document.getElementById('adminView')?.classList.add('hidden');
            document.getElementById('sheetView')?.classList.add('hidden');
            document.getElementById('fabMenu')?.classList.add('hidden');
            closeFabMenu();
        }

        function showDisabledAccountView() {
            document.getElementById('authView')?.classList.add('hidden');
            document.getElementById('profileSetupView')?.classList.add('hidden');
            document.getElementById('disabledAccountView')?.classList.remove('hidden');
            document.getElementById('homeView')?.classList.add('hidden');
            document.getElementById('adminView')?.classList.add('hidden');
            document.getElementById('sheetView')?.classList.add('hidden');
            document.getElementById('fabMenu')?.classList.add('hidden');
            closeFabMenu();
        }

        function setProfileSetupMessage(text, tone) {
            const msgEl = document.getElementById('profileSetupMessage');
            if (!msgEl) return;
            if (!text) {
                msgEl.textContent = '';
                msgEl.className = 'mt-3 text-xs hidden';
                return;
            }
            msgEl.textContent = text;
            msgEl.className = tone === 'error'
                ? 'mt-3 text-xs text-red-400'
                : 'mt-3 text-xs text-[#00f0ff]';
        }

        function normalizePseudo(value) {
            return String(value || '').trim().replace(/\s+/g, ' ');
        }

        function validatePseudo(value) {
            const pseudo = normalizePseudo(value);
            if (!pseudo) return { pseudo, error: 'Pseudo requis.' };
            if (pseudo.length < 2) return { pseudo, error: 'Pseudo trop court.' };
            if (pseudo.length > 32) return { pseudo, error: 'Pseudo trop long.' };
            return { pseudo, error: '' };
        }

        async function refreshCurrentProfile() {
            currentProfile = isLoggedIn() ? await AppCloud.getMyProfile() : null;
            updateCurrentUserBar();
            return currentProfile;
        }

        async function ensureProfileReady() {
            if (!isLoggedIn()) return true;
            const profile = await refreshCurrentProfile();
            if (profile?.isDisabled) {
                showDisabledAccountView();
                return false;
            }
            if (!profile || !profile.pseudo) {
                showProfileSetupView();
                return false;
            }
            return true;
        }

        function setAuthMessage(text, tone) {
            const msgEl = document.getElementById('authMessage');
            if (!msgEl) return;
            if (!text) {
                msgEl.textContent = '';
                msgEl.className = 'mt-3 text-xs hidden';
                return;
            }

            msgEl.textContent = text;
            msgEl.className = tone === 'error'
                ? 'mt-3 text-xs text-red-400'
                : 'mt-3 text-xs text-[#00f0ff]';
        }

        function formatAuthError(error, context) {
            const directName = String(error?.name || '').toLowerCase();
            const directCode = String(error?.code || '').toLowerCase();
            const directStatus = Number(error?.status || 0);

            const extractRawMessage = () => {
                if (!error) return '';
                if (typeof error === 'string') return error;
                if (typeof error.message === 'string') return error.message;
                if (typeof error.error_description === 'string') return error.error_description;
                if (typeof error.details === 'string') return error.details;
                return '';
            };

            let raw = extractRawMessage().trim();
            if (!raw || raw === '{}' || raw === '[object Object]') {
                try {
                    const serialized = JSON.stringify(error);
                    if (serialized && serialized !== '{}' && serialized !== 'null') {
                        raw = serialized;
                    }
                } catch (e) {
                    raw = '';
                }
            }

            // Some Supabase/network failures come back as serialized JSON errors.
            let parsed = null;
            if (raw.startsWith('{') && raw.endsWith('}')) {
                try {
                    parsed = JSON.parse(raw);
                } catch (e) {
                    parsed = null;
                }
            }

            const parsedName = String(parsed?.name || '').toLowerCase();
            const parsedCode = String(parsed?.code || '').toLowerCase();
            const parsedMessage = String(parsed?.message || '').toLowerCase();
            const parsedStatus = Number(parsed?.status || 0);
            const code = directCode || parsedCode;
            const status = directStatus || parsedStatus;

            const collectValues = (value, values = []) => {
                if (!value) return values;
                if (typeof value === 'string') {
                    values.push(value);
                    return values;
                }
                if (Array.isArray(value)) {
                    value.forEach((item) => collectValues(item, values));
                    return values;
                }
                if (typeof value === 'object') {
                    Object.values(value).forEach((item) => collectValues(item, values));
                }
                return values;
            };

            const detailText = collectValues([
                raw,
                error?.message,
                error?.error_description,
                error?.details,
                error?.hint,
                error?.weak_password,
                error?.weakPassword,
                parsed?.message,
                parsed?.error_description,
                parsed?.details,
                parsed?.hint,
                parsed?.weak_password,
                parsed?.weakPassword
            ]).join(' ').toLowerCase();

            const signupMessagesByCode = {
                email_exists: 'Cet e-mail est déjà inscrit. Connectez-vous ou utilisez "Mot de passe oublié ?".',
                user_already_exists: 'Cet e-mail est déjà inscrit. Connectez-vous ou utilisez "Mot de passe oublié ?".',
                identity_already_exists: 'Cet e-mail est déjà lié à un compte existant.',
                email_address_invalid: 'Adresse e-mail invalide. Vérifiez le format, par exemple nom@domaine.fr.',
                email_address_not_authorized: 'Cette adresse e-mail n\'est pas autorisée pour l\'inscription.',
                signup_disabled: 'Les inscriptions sont désactivées pour le moment.',
                over_email_send_rate_limit: 'Trop d\'e-mails envoyés. Attendez quelques minutes puis réessayez.',
                over_request_rate_limit: 'Trop de tentatives. Attendez quelques minutes puis réessayez.',
                captcha_failed: 'La vérification anti-robot a échoué.'
            };

            const formatWeakPasswordReason = () => {
                if (detailText.includes('pwned') || detailText.includes('breach') || detailText.includes('compromised')) {
                    return 'Mot de passe refusé : il apparaît dans une fuite connue. Utilisez au moins 8 caractères avec une majuscule, une minuscule, un chiffre et un caractère spécial.';
                }
                return 'Mot de passe refusé : il faut au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.';
            };

            if (
                parsedName.includes('authretryablefetcherror') ||
                directName.includes('authretryablefetcherror') ||
                parsedStatus >= 500 ||
                directStatus >= 500
            ) {
                return 'Service d\'authentification temporairement indisponible. Réessayez dans quelques instants.';
            }

            if (directCode === 'email_not_confirmed' || parsedCode === 'email_not_confirmed') {
                return 'E-mail non confirmé. Vérifiez votre boîte mail puis confirmez votre compte.';
            }

            if (directCode === 'user_not_found' || parsedCode === 'user_not_found') {
                return 'Aucun compte trouvé pour cet e-mail.';
            }

            if (
                context === 'login' &&
                (directStatus === 400 || parsedStatus === 400) &&
                (parsedMessage === '{}' || parsedMessage === '' || directName.includes('authapierror') || parsedName.includes('authapierror'))
            ) {
                return 'Connexion impossible. Vérifiez vos identifiants et confirmez votre e-mail de création de compte.';
            }

            if (parsed && (parsedMessage === '{}' || parsedMessage === '')) {
                raw = 'Erreur du service d\'authentification.';
            }

            if (!raw || raw === '{}' || raw === '[object Object]') {
                raw = 'Erreur du service d\'authentification.';
            }

            const msg = raw.toLowerCase();

            if (msg.includes('rate limit')) {
                return 'Trop de tentatives. Attendez quelques minutes puis réessayez.';
            }

            if (context === 'signup') {
                if (code === 'weak_password' || detailText.includes('weak password') || detailText.includes('password should')) {
                    return formatWeakPasswordReason();
                }

                if (signupMessagesByCode[code]) {
                    return signupMessagesByCode[code];
                }

                if (status === 422 && (detailText.includes('email') || detailText.includes('mail'))) {
                    return 'Adresse e-mail invalide. Vérifiez le format, par exemple nom@domaine.fr.';
                }

                if (detailText.includes('already registered') || detailText.includes('user already') || detailText.includes('already exists')) {
                    return 'Cet e-mail est déjà inscrit. Connectez-vous ou utilisez "Mot de passe oublié ?".';
                }

                if (detailText.includes('invalid email') || detailText.includes('validate email') || detailText.includes('email address')) {
                    return 'Adresse e-mail invalide. Vérifiez le format, par exemple nom@domaine.fr.';
                }

                if (detailText.includes('signup') && detailText.includes('disabled')) {
                    return 'Les inscriptions sont désactivées pour le moment.';
                }
            }

            if (msg.includes('invalid login credentials')) {
                return 'E-mail ou mot de passe incorrect.';
            }

            if (msg.includes('password should be at least')) {
                return 'Mot de passe refusé : il faut au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.';
            }

            return raw;
        }

        function setAuthMode(mode) {
            authMode = mode;
            const isLogin = mode === 'login';
            const isRegister = mode === 'register';
            const isRecovery = mode === 'recovery';
            const base = 'flex-1 py-2 text-sm uppercase font-bold tracking-widest -mb-px transition-colors';
            const active = ' text-[#00f0ff] border-b-2 border-[#00f0ff]';
            const inactive = ' text-gray-500 border-b-2 border-transparent';
            const loginBtn = document.getElementById('authTabLogin');
            const registerBtn = document.getElementById('authTabRegister');
            const submitBtn = document.getElementById('authSubmitBtn');
            const emailInput = document.getElementById('authEmail');
            const emailField = emailInput?.closest('div');
            const pseudoInput = document.getElementById('authPseudo');
            const pseudoField = document.getElementById('authPseudoField');
            const passwordInput = document.getElementById('authPassword');
            const forgotBtn = document.getElementById('authForgotPasswordBtn');
            const recoveryHint = document.getElementById('authRecoveryHint');

            if (loginBtn) loginBtn.className = base + (isLogin ? active : inactive);
            if (registerBtn) registerBtn.className = base + (isRegister ? active : inactive);
            if (loginBtn) loginBtn.disabled = isRecovery;
            if (registerBtn) registerBtn.disabled = isRecovery;
            if (submitBtn) {
                submitBtn.dataset.mode = mode;
                submitBtn.textContent = isLogin
                    ? 'Se connecter'
                    : isRegister
                        ? "S'inscrire"
                        : 'Mettre à jour';
            }
            if (emailInput) {
                emailInput.required = !isRecovery;
                emailInput.autocomplete = isRecovery ? 'off' : 'email';
                if (isRecovery) emailInput.value = '';
            }
            if (emailField) emailField.classList.toggle('hidden', isRecovery);
            if (pseudoField) pseudoField.classList.toggle('hidden', !isRegister);
            if (pseudoInput) {
                pseudoInput.required = false;
                pseudoInput.setAttribute('aria-required', isRegister ? 'true' : 'false');
                if (!isRegister) pseudoInput.value = '';
            }
            if (passwordInput) {
                passwordInput.required = true;
                passwordInput.autocomplete = isRecovery ? 'new-password' : isLogin ? 'current-password' : 'new-password';
                passwordInput.placeholder = isRecovery ? 'Nouveau mot de passe' : '';
                passwordInput.value = '';
            }
            if (forgotBtn) forgotBtn.classList.toggle('hidden', !isLogin);
            if (recoveryHint) recoveryHint.classList.toggle('hidden', !isRecovery);
            setAuthMessage('', 'info');
        }

        function switchAuthTab(tab) {
            setAuthMode(tab === 'login' ? 'login' : 'register');
        }

        async function handleForgotPassword() {
            const email = document.getElementById('authEmail')?.value.trim();
            if (!email) {
                setAuthMessage('Saisissez votre e-mail pour recevoir un lien de réinitialisation.', 'error');
                return;
            }

            try {
                await AppAuth.resetPassword(email);
                setAuthMessage('E-mail de réinitialisation envoyé. Vérifiez votre boîte mail.', 'info');
            } catch (error) {
                console.error('[auth:forgot]', error);
                const message = formatAuthError(error, 'forgot');
                setAuthMessage(message, 'error');
            }
        }

        async function handleAuthSubmit(event) {
            event.preventDefault();
            const email = document.getElementById('authEmail')?.value.trim();
            const pseudoInput = document.getElementById('authPseudo')?.value;
            const password = document.getElementById('authPassword')?.value;
            const submitBtn = document.getElementById('authSubmitBtn');
            const mode = authMode;
            const isLogin = mode === 'login';
            const isRegister = mode === 'register';
            const isRecovery = mode === 'recovery';

            if (!email && !isRecovery) {
                setAuthMessage('E-mail requis.', 'error');
                return;
            }
            if (!password) {
                setAuthMessage('Mot de passe requis.', 'error');
                return;
            }
            const pseudoValidation = validatePseudo(pseudoInput);
            if (isRegister && pseudoValidation.error) {
                setAuthMessage(pseudoValidation.error, 'error');
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = isLogin
                    ? 'Connexion...'
                    : mode === 'register'
                        ? 'Inscription...'
                        : 'Mise à jour...';
            }
            setAuthMessage('', 'info');

            try {
                if (isRecovery) {
                    await AppAuth.updatePassword(password);
                    await AppAuth.signOut();
                    window.__currentSession = null;
                    showAuthView();
                    setAuthMode('login');
                    setAuthMessage('Mot de passe mis à jour. Vous pouvez maintenant vous connecter.', 'info');
                } else if (isLogin) {
                    await AppAuth.signIn(email, password);
                } else {
                    await AppAuth.signUp(email, password, pseudoValidation.pseudo);
                    setAuthMessage('Compte créé ! Vérifiez vos e-mails pour confirmer votre inscription.', 'info');
                }
            } catch (error) {
                console.error('[auth:submit]', error);
                setAuthMessage(formatAuthError(error, isLogin ? 'login' : isRecovery ? 'recovery' : 'signup'), 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = mode === 'login'
                        ? 'Se connecter'
                        : mode === 'register'
                            ? "S'inscrire"
                            : 'Mettre à jour';
                }
            }
        }

        async function handleProfileSetupSubmit(event) {
            event.preventDefault();
            const input = document.getElementById('profileSetupPseudo');
            const submitBtn = document.getElementById('profileSetupSubmitBtn');
            const validation = validatePseudo(input?.value);

            if (validation.error) {
                setProfileSetupMessage(validation.error, 'error');
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Validation...';
            }
            setProfileSetupMessage('', 'info');

            try {
                await AppCloud.completeProfile(validation.pseudo);
                await refreshCurrentProfile();
                await handlePostSignIn({ skipProfileCheck: true });
            } catch (error) {
                console.error('[profile:complete]', error);
                setProfileSetupMessage(formatAuthError(error, 'profile'), 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Valider le pseudo';
                }
            }
        }

        function continueWithoutAccount() {
            window.__currentSession = null;
            if (AppPersistence.listSheetsFromLocalStorage().length > 0) {
                showHomeView();
            } else {
                showSheetView();
            }
        }

        async function handleLogout() {
            await AppAuth.signOut();
            // onAuthStateChange will fire SIGNED_OUT -> showAuthView()
        }

        async function handlePostSignIn(options = {}) {
            if (!options.skipProfileCheck) {
                const ready = await ensureProfileReady();
                if (!ready) return;
            }

            const localSheets = (() => {
                try { return Object.values(JSON.parse(localStorage.getItem('swtor_sheets') || '{}')); }
                catch (e) { return []; }
            })();

            if (localSheets.length > 0) {
                if (confirm(`Vous avez ${localSheets.length} fiche(s) sauvegardée(s) localement.\nLes importer dans le cloud ?`)) {
                    try {
                        const count = await AppCloud.migrateFromLocalStorage();
                        alert(`${count} fiche(s) importée(s) avec succès !`);
                    } catch (e) {
                        console.error('[migration]', e);
                        alert('Erreur lors de la migration :\n' + (e.message || e));
                    }
                }
            }
            showHomeView();
        }

        function roleLabel(role) {
            if (role === 'admin') return 'Admin';
            if (role === 'mj') return 'MJ';
            return 'Joueur';
        }

        async function renderAdminPanel() {
            const list = document.getElementById('adminUserList');
            if (!list || !isAdminRole()) return;
            list.innerHTML = '<p class="text-gray-500 text-xs uppercase tracking-widest py-4">Chargement...</p>';

            try {
                const profiles = await AppCloud.listProfiles();
                if (profiles.length === 0) {
                    list.innerHTML = '<p class="text-gray-500 text-center py-6">Aucun utilisateur</p>';
                    return;
                }

                list.innerHTML = profiles.map((profile) => {
                    const pseudo = escapeHtml(profile.pseudo || 'Pseudo manquant');
                    const email = profile.email ? escapeHtml(profile.email) : 'Email indisponible';
                    const role = profile.role || 'user';
                    return `<div class="flex flex-col md:flex-row md:items-center gap-3 justify-between bg-[#002e33] border border-[#004e53] rounded p-3">
                        <div class="min-w-0">
                            <div class="text-[#00f0ff] font-bold truncate">${pseudo}</div>
                            <div class="text-gray-500 text-xs truncate">${email}</div>
                        </div>
                        <label class="sr-only" for="role-${profile.id}">RÃ´le</label>
                        <select id="role-${profile.id}" data-testid="admin-role-select" onchange="handleAdminRoleChange('${profile.id}', this.value)"
                                class="bg-[#001a1f] border border-[#004e53] text-[#00f0ff] rounded px-2 py-1 text-sm">
                            <option value="user" ${role === 'user' ? 'selected' : ''}>${roleLabel('user')}</option>
                            <option value="mj" ${role === 'mj' ? 'selected' : ''}>${roleLabel('mj')}</option>
                            <option value="admin" ${role === 'admin' ? 'selected' : ''}>${roleLabel('admin')}</option>
                        </select>
                    </div>`;
                }).join('');
            } catch (error) {
                console.error('[admin:profiles]', error);
                list.innerHTML = '<p class="text-red-400 text-xs uppercase tracking-widest py-4">Erreur de chargement</p>';
            }
        }

        async function toggleAdminPanel(forceOpen) {
            if (!isAdminRole()) return;
            const panel = document.getElementById('adminPanel');
            if (!panel) return;
            const open = typeof forceOpen === 'boolean' ? forceOpen : panel.classList.contains('hidden');
            panel.classList.toggle('hidden', !open);
            if (open) await renderAdminPanel();
        }

        async function handleAdminRoleChange(userId, role) {
            if (!isAdminRole()) return;
            try {
                await AppCloud.setUserRole(userId, role);
                if (userId === getCurrentUserId()) {
                    await refreshCurrentProfile();
                    if (!isAdminRole()) document.getElementById('adminPanel')?.classList.add('hidden');
                }
                await renderHomeView();
            } catch (error) {
                console.error('[admin:role]', error);
                alert('Erreur lors du changement de rÃ´le.');
                await renderAdminPanel();
            }
        }

        function guildOptionsHtml(selectedId = '') {
            if (!AppGuilds) return '';
            return AppGuilds.GUILDS.map((guild) => {
                const selected = guild.id === selectedId ? 'selected' : '';
                return `<option value="${guild.id}" ${selected}>${escapeHtml(guild.name)}</option>`;
            }).join('');
        }

        function updateAdminTabs() {
            const usersList = document.getElementById('adminUserList');
            const unguildedList = document.getElementById('adminUnguildedList');
            const sheetsList = document.getElementById('adminSheetsList');
            const usersTab = document.getElementById('adminUsersTab');
            const unguildedTab = document.getElementById('adminUnguildedTab');
            const sheetsTab = document.getElementById('adminSheetsTab');
            const usersActive = adminPanelTab === 'users';
            const unguildedActive = adminPanelTab === 'unguilded';
            const sheetsActive = adminPanelTab === 'sheets';

            usersList?.classList.toggle('hidden', !usersActive);
            unguildedList?.classList.toggle('hidden', !unguildedActive);
            sheetsList?.classList.toggle('hidden', !sheetsActive);

            if (usersTab) {
                usersTab.className = usersActive
                    ? 'px-3 py-1 text-xs uppercase font-bold tracking-widest border border-[#00f0ff] text-[#00f0ff] rounded'
                    : 'px-3 py-1 text-xs uppercase font-bold tracking-widest border border-[#004e53] text-gray-500 rounded';
            }
            if (unguildedTab) {
                unguildedTab.className = unguildedActive
                    ? 'px-3 py-1 text-xs uppercase font-bold tracking-widest border border-[#00f0ff] text-[#00f0ff] rounded'
                    : 'px-3 py-1 text-xs uppercase font-bold tracking-widest border border-[#004e53] text-gray-500 rounded';
            }
            if (sheetsTab) {
                sheetsTab.className = sheetsActive
                    ? 'px-3 py-1 text-xs uppercase font-bold tracking-widest border border-[#00f0ff] text-[#00f0ff] rounded'
                    : 'px-3 py-1 text-xs uppercase font-bold tracking-widest border border-[#004e53] text-gray-500 rounded';
            }
        }

        async function renderAdminPanel() {
            const list = document.getElementById('adminUserList');
            if (!list || !isAdminRole()) return;
            updateAdminTabs();
            list.innerHTML = '<p class="text-gray-500 text-xs uppercase tracking-widest py-4">Chargement...</p>';

            try {
                const profiles = await AppCloud.listProfiles();
                if (profiles.length === 0) {
                    list.innerHTML = '<p class="text-gray-500 text-center py-6">Aucun utilisateur</p>';
                    return;
                }

                list.innerHTML = profiles.map((profile) => {
                    const pseudo = escapeHtml(profile.pseudo || 'Pseudo manquant');
                    const email = profile.email ? escapeHtml(profile.email) : 'Email indisponible';
                    const role = profile.role || 'user';
                    const selectedGuildId = profile.mjGuildId || AppGuilds?.GUILDS[0]?.id || '';
                    const isDisabled = !!profile.isDisabled;
                    const self = profile.id === getCurrentUserId();
                    const statusHtml = isDisabled
                        ? '<span class="text-[10px] uppercase tracking-widest border border-red-900/70 text-red-300 px-2 py-0.5 rounded">Desactive</span>'
                        : '<span class="text-[10px] uppercase tracking-widest border border-[#004e53] text-gray-400 px-2 py-0.5 rounded">Actif</span>';
                    const disableButtonLabel = isDisabled ? 'Reactiver' : 'Desactiver';
                    const disableButtonClass = isDisabled
                        ? 'border-[#004e53] text-[#00f0ff] hover:bg-[#004e53]'
                        : 'border-red-900/70 text-red-300 hover:bg-red-900/30';
                    const disableButton = self
                        ? '<button type="button" disabled class="border border-[#004e53] text-gray-600 rounded px-3 py-1 text-sm cursor-not-allowed">Compte actuel</button>'
                        : `<button type="button" data-testid="admin-disable-toggle" onclick="handleAdminDisabledToggle('${profile.id}', ${isDisabled ? 'false' : 'true'})"
                                  class="${disableButtonClass} rounded px-3 py-1 text-sm transition-colors">${disableButtonLabel}</button>`;
                    return `<div data-testid="admin-user-row" class="flex flex-col gap-3 bg-[#002e33] border ${isDisabled ? 'border-red-900/60 opacity-75' : 'border-[#004e53]'} rounded p-3">
                        <div class="flex flex-col md:flex-row md:items-center gap-3 justify-between">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 min-w-0">
                                <div data-testid="admin-user-pseudo" class="text-[#00f0ff] font-bold truncate">${pseudo}</div>
                                ${statusHtml}
                            </div>
                            <div class="text-gray-500 text-xs truncate">${email}</div>
                        </div>
                        <div class="flex flex-col sm:flex-row gap-2">
                            <label class="sr-only" for="role-${profile.id}">Role</label>
                            <select id="role-${profile.id}" data-testid="admin-role-select" onchange="handleAdminRoleChange('${profile.id}')"
                                    class="bg-[#001a1f] border border-[#004e53] text-[#00f0ff] rounded px-2 py-1 text-sm">
                                <option value="user" ${role === 'user' ? 'selected' : ''}>${roleLabel('user')}</option>
                                <option value="mj" ${role === 'mj' ? 'selected' : ''}>${roleLabel('mj')}</option>
                                <option value="admin" ${role === 'admin' ? 'selected' : ''}>${roleLabel('admin')}</option>
                            </select>
                            <label class="sr-only" for="mj-guild-${profile.id}">Guilde MJ</label>
                            <select id="mj-guild-${profile.id}" data-testid="admin-mj-guild-select" onchange="handleAdminRoleChange('${profile.id}')"
                                    class="${role === 'mj' ? '' : 'hidden'} bg-[#001a1f] border border-[#004e53] text-[#00f0ff] rounded px-2 py-1 text-sm">
                                ${guildOptionsHtml(selectedGuildId)}
                            </select>
                            ${disableButton}
                        </div>
                        </div>
                    </div>`;
                }).join('');
            } catch (error) {
                console.error('[admin:profiles]', error);
                list.innerHTML = '<p class="text-red-400 text-xs uppercase tracking-widest py-4">Erreur de chargement</p>';
            }
        }

        async function renderAdminUnguildedPanel() {
            const list = document.getElementById('adminUnguildedList');
            if (!list || !isAdminRole()) return;
            updateAdminTabs();
            list.innerHTML = '<p class="text-gray-500 text-xs uppercase tracking-widest py-4">Chargement...</p>';

            try {
                const [sheets, profiles] = await Promise.all([
                    AppCloud.listUnguildedSheets(),
                    AppCloud.listProfiles()
                ]);
                const profilesById = Object.fromEntries(profiles.map(profile => [profile.id, profile]));
                if (sheets.length === 0) {
                    list.innerHTML = '<p class="text-gray-500 text-center py-6">Aucune fiche sans guilde</p>';
                    return;
                }

                list.innerHTML = sheets.map((sheet) => {
                    const name = escapeHtml(sheet.name || 'Sans nom');
                    const owner = sheet.ownerId ? profilesById[sheet.ownerId] : null;
                    const ownerName = escapeHtml(owner?.pseudo || 'Pseudo inconnu');
                    const selectedGuildId = pendingUnguildedGuildAssignments[sheet.id] || '';
                    return `<div class="flex flex-col md:flex-row md:items-center gap-3 justify-between bg-[#002e33] border border-[#004e53] rounded p-3">
                        <div class="min-w-0">
                            <div class="text-[#00f0ff] font-bold truncate">${name}</div>
                            <div class="text-gray-400 text-xs mt-1">Joueur : ${ownerName}</div>
                        </div>
                        <select data-testid="admin-assign-guild-select" onchange="handlePendingUnguildedGuildChange('${sheet.id}', this.value)"
                                class="bg-[#001a1f] border border-[#004e53] text-[#00f0ff] rounded px-2 py-1 text-sm">
                            <option value="">Choisir une guilde</option>
                            ${guildOptionsHtml(selectedGuildId)}
                        </select>
                    </div>`;
                }).join('');
                const pendingCount = Object.keys(pendingUnguildedGuildAssignments).filter((sheetId) => pendingUnguildedGuildAssignments[sheetId]).length;
                const buttonDisabled = pendingCount === 0 ? 'disabled' : '';
                const buttonClass = pendingCount === 0
                    ? 'bg-[#002e33] text-gray-600 border border-[#004e53] px-5 py-2 rounded clip-corner uppercase font-bold tracking-widest text-sm cursor-not-allowed'
                    : 'bg-[#004e53] hover:bg-[#00f0ff] hover:text-black text-[#00f0ff] border border-[#00f0ff] px-5 py-2 rounded clip-corner uppercase font-bold tracking-widest text-sm transition-colors';
                list.innerHTML += `<div class="flex justify-end pt-2">
                    <button type="button" data-testid="home-apply-guild-assignments" onclick="applyPendingUnguildedGuildAssignments()" ${buttonDisabled}
                            class="${buttonClass}">
                        Valider les changements${pendingCount ? ` (${pendingCount})` : ''}
                    </button>
                </div>`;
            } catch (error) {
                console.error('[admin:unguilded]', error);
                list.innerHTML = '<p class="text-red-400 text-xs uppercase tracking-widest py-4">Erreur de chargement</p>';
            }
        }

        function adminGuildFilterOptions(selectedId = '') {
            return `<option value="" ${selectedId === '' ? 'selected' : ''}>Toutes les guildes</option>
                <option value="__none__" ${selectedId === '__none__' ? 'selected' : ''}>Sans guilde</option>
                ${guildOptionsHtml(selectedId)}`;
        }

        function adminOwnerFilterOptions(profiles, selectedId = '') {
            const activeProfiles = profiles.filter(profile => !profile.isDisabled);
            return `<option value="" ${selectedId === '' ? 'selected' : ''}>Tous les joueurs</option>
                ${activeProfiles.map((profile) => {
                    const selected = profile.id === selectedId ? 'selected' : '';
                    return `<option value="${profile.id}" ${selected}>${escapeHtml(profile.pseudo || profile.email || 'Pseudo inconnu')}</option>`;
                }).join('')}`;
        }

        function mjOwnerFilterOptions(profiles, selectedId = '') {
            const activeProfiles = profiles.filter(profile => !profile.isDisabled && profile.id !== getCurrentUserId());
            return `<option value="" ${selectedId === '' ? 'selected' : ''}>Tous les joueurs</option>
                ${activeProfiles.map((profile) => {
                    const selected = profile.id === selectedId ? 'selected' : '';
                    return `<option value="${profile.id}" ${selected}>${escapeHtml(profile.pseudo || profile.email || 'Pseudo inconnu')}</option>`;
                }).join('')}`;
        }

        function renderCompactSheetRows(list, sheets, append = false, options = {}) {
            const rowsTestId = options.rowTestId || 'admin-sheet-row';
            const rowsContainerTestId = options.rowsContainerTestId || 'admin-sheets-rows';
            const rowsHtml = sheets.map((sheet) => {
                const date = new Date(sheet.savedAt).toLocaleString('fr-FR');
                const owner = escapeHtml(sheet.ownerPseudo || 'Pseudo inconnu');
                const guild = sheet.guildName ? escapeHtml(sheet.guildName) : 'Sans guilde';
                return `<div data-testid="${rowsTestId}" class="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#002e33] border border-[#004e53] rounded p-3">
                    <div class="min-w-0">
                        <div class="text-[#00f0ff] font-bold truncate">${escapeHtml(sheet.name || 'Sans nom')}</div>
                        <div class="text-gray-400 text-xs mt-1">Joueur : ${owner}</div>
                        <div class="text-gray-500 text-xs mt-1">Guilde : ${guild} - ${date}</div>
                    </div>
                    <button type="button" onclick="openSheetFromHome('${sheet.id}')"
                            class="bg-[#004e53] hover:bg-[#00f0ff] hover:text-black text-[#00f0ff] px-4 py-2 rounded text-xs uppercase font-bold tracking-wider transition-colors">
                        Ouvrir
                    </button>
                </div>`;
            }).join('');

            const rowsContainer = list.querySelector(`[data-testid="${rowsContainerTestId}"]`);
            if (!rowsContainer) return;
            rowsContainer.innerHTML = append ? rowsContainer.innerHTML + rowsHtml : rowsHtml;
        }

        function renderAdminSheetsRows(list, sheets, append = false) {
            renderCompactSheetRows(list, sheets, append);
        }

        async function renderAdminAllSheetsPanel(options = {}) {
            const targetId = options.targetId || adminSheetsRenderTargetId;
            const list = document.getElementById(targetId);
            if (!list || !isAdminRole()) return;
            const append = !!options.append;
            adminSheetsRenderTargetId = targetId;
            if (targetId === 'adminSheetsList') updateAdminTabs();

            if (!append) {
                adminSheetsOffset = 0;
                adminSheetsRows = [];
                list.className = targetId === 'homeSheetList'
                    ? 'flex flex-col gap-3 mb-10 min-h-[160px]'
                    : 'space-y-3';
                list.innerHTML = '<p class="text-gray-500 text-xs uppercase tracking-widest py-4">Chargement...</p>';
            }

            try {
                const profiles = await AppCloud.listProfiles();
                const rows = await AppCloud.adminListSheets({
                    guildId: adminSheetsFilters.guildId || null,
                    ownerId: adminSheetsFilters.ownerId || null,
                    search: adminSheetsFilters.search || null,
                    limit: adminSheetsPageSize,
                    offset: adminSheetsOffset
                });
                const totalCount = rows[0]?.totalCount || (append ? adminSheetsRows.length : rows.length);
                adminSheetsRows = append ? adminSheetsRows.concat(rows) : rows;
                adminSheetsOffset = adminSheetsRows.length;
                adminSheetsHasMore = adminSheetsRows.length < totalCount;

                if (!append) {
                    list.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#00141a] border border-[#004e53] rounded p-3">
                        <label class="block">
                            <span class="block text-xs uppercase text-gray-400 mb-1">Guilde</span>
                            <select data-testid="admin-sheet-guild-filter" onchange="handleAdminSheetFilterChange('guildId', this.value)"
                                    class="w-full bg-[#001a1f] border border-[#004e53] text-[#00f0ff] rounded px-2 py-2 text-sm">
                                ${adminGuildFilterOptions(adminSheetsFilters.guildId)}
                            </select>
                        </label>
                        <label class="block">
                            <span class="block text-xs uppercase text-gray-400 mb-1">Joueur</span>
                            <select data-testid="admin-sheet-owner-filter" onchange="handleAdminSheetFilterChange('ownerId', this.value)"
                                    class="w-full bg-[#001a1f] border border-[#004e53] text-[#00f0ff] rounded px-2 py-2 text-sm">
                                ${adminOwnerFilterOptions(profiles, adminSheetsFilters.ownerId)}
                            </select>
                        </label>
                        <label class="block">
                            <span class="block text-xs uppercase text-gray-400 mb-1">Recherche</span>
                            <input data-testid="admin-sheet-search" type="search" value="${escapeHtml(adminSheetsFilters.search)}"
                                   oninput="handleAdminSheetSearchInput(this.value)"
                                   placeholder="Nom du personnage"
                                   class="w-full bg-[#001a1f] border border-[#004e53] text-[#00f0ff] rounded px-2 py-2 text-sm">
                        </label>
                    </div>
                    <div class="flex items-center justify-between text-xs text-gray-500 uppercase tracking-widest">
                        <span data-testid="admin-sheet-count">${adminSheetsRows.length} / ${totalCount} fiche(s)</span>
                    </div>
                    <div data-testid="admin-sheets-rows" class="space-y-3"></div>
                    <div class="flex justify-center pt-2">
                        <button type="button" data-testid="admin-sheets-load-more" onclick="loadMoreAdminSheets()"
                                class="${adminSheetsHasMore ? '' : 'hidden'} bg-[#002e33] hover:bg-[#004e53] text-[#00f0ff] border border-[#004e53] px-5 py-2 rounded clip-corner uppercase font-bold tracking-widest text-sm transition-colors">
                            Charger plus
                        </button>
                    </div>`;
                }

                renderAdminSheetsRows(list, rows, append);
                const countEl = list.querySelector('[data-testid="admin-sheet-count"]');
                if (countEl) countEl.textContent = `${adminSheetsRows.length} / ${totalCount} fiche(s)`;
                const loadMore = list.querySelector('[data-testid="admin-sheets-load-more"]');
                if (loadMore) loadMore.classList.toggle('hidden', !adminSheetsHasMore);
                const rowsContainer = list.querySelector('[data-testid="admin-sheets-rows"]');
                if (rowsContainer && adminSheetsRows.length === 0) {
                    rowsContainer.innerHTML = '<p class="text-gray-500 text-center py-6">Aucune fiche ne correspond aux filtres</p>';
                }
            } catch (error) {
                console.error('[admin:sheets]', error);
                list.innerHTML = '<p class="text-red-400 text-xs uppercase tracking-widest py-4">Erreur de chargement</p>';
            }
        }

        async function renderMjPlayerSheetsPanel(options = {}) {
            const targetId = options.targetId || 'homeSheetList';
            const list = document.getElementById(targetId);
            if (!list || currentProfile?.role !== 'mj') return;
            const append = !!options.append;

            if (!append) {
                mjPlayerSheetsOffset = 0;
                mjPlayerSheetsRows = [];
                list.className = 'flex flex-col gap-3 mb-10 min-h-[160px]';
                list.innerHTML = '<p class="text-gray-500 text-xs uppercase tracking-widest py-4">Chargement...</p>';
            }

            try {
                const profiles = await AppCloud.listProfiles();
                const rows = await AppCloud.mjListPlayerSheets({
                    ownerId: mjPlayerSheetsFilters.ownerId || null,
                    search: mjPlayerSheetsFilters.search || null,
                    limit: mjPlayerSheetsPageSize,
                    offset: mjPlayerSheetsOffset
                });
                const totalCount = rows[0]?.totalCount || (append ? mjPlayerSheetsRows.length : rows.length);
                mjPlayerSheetsRows = append ? mjPlayerSheetsRows.concat(rows) : rows;
                mjPlayerSheetsOffset = mjPlayerSheetsRows.length;
                mjPlayerSheetsHasMore = mjPlayerSheetsRows.length < totalCount;

                if (!append) {
                    list.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#00141a] border border-[#004e53] rounded p-3">
                        <label class="block">
                            <span class="block text-xs uppercase text-gray-400 mb-1">Joueur</span>
                            <select data-testid="mj-player-sheet-owner-filter" onchange="handleMjPlayerSheetFilterChange('ownerId', this.value)"
                                    class="w-full bg-[#001a1f] border border-[#004e53] text-[#00f0ff] rounded px-2 py-2 text-sm">
                                ${mjOwnerFilterOptions(profiles, mjPlayerSheetsFilters.ownerId)}
                            </select>
                        </label>
                        <label class="block">
                            <span class="block text-xs uppercase text-gray-400 mb-1">Recherche</span>
                            <input data-testid="mj-player-sheet-search" type="search" value="${escapeHtml(mjPlayerSheetsFilters.search)}"
                                   oninput="handleMjPlayerSheetSearchInput(this.value)"
                                   placeholder="Nom du personnage"
                                   class="w-full bg-[#001a1f] border border-[#004e53] text-[#00f0ff] rounded px-2 py-2 text-sm">
                        </label>
                    </div>
                    <div class="flex items-center justify-between text-xs text-gray-500 uppercase tracking-widest">
                        <span data-testid="mj-player-sheet-count">${mjPlayerSheetsRows.length} / ${totalCount} fiche(s)</span>
                    </div>
                    <div data-testid="mj-player-sheets-rows" class="space-y-3"></div>
                    <div class="flex justify-center pt-2">
                        <button type="button" data-testid="mj-player-sheets-load-more" onclick="loadMoreMjPlayerSheets()"
                                class="${mjPlayerSheetsHasMore ? '' : 'hidden'} bg-[#002e33] hover:bg-[#004e53] text-[#00f0ff] border border-[#004e53] px-5 py-2 rounded clip-corner uppercase font-bold tracking-widest text-sm transition-colors">
                            Charger plus
                        </button>
                    </div>`;
                }

                renderCompactSheetRows(list, rows, append, {
                    rowTestId: 'mj-player-sheet-row',
                    rowsContainerTestId: 'mj-player-sheets-rows'
                });
                const countEl = list.querySelector('[data-testid="mj-player-sheet-count"]');
                if (countEl) countEl.textContent = `${mjPlayerSheetsRows.length} / ${totalCount} fiche(s)`;
                const loadMore = list.querySelector('[data-testid="mj-player-sheets-load-more"]');
                if (loadMore) loadMore.classList.toggle('hidden', !mjPlayerSheetsHasMore);
                const rowsContainer = list.querySelector('[data-testid="mj-player-sheets-rows"]');
                if (rowsContainer && mjPlayerSheetsRows.length === 0) {
                    rowsContainer.innerHTML = '<p class="text-gray-500 text-center py-6">Aucune fiche ne correspond aux filtres</p>';
                }
            } catch (error) {
                console.error('[mj:sheets]', error);
                list.innerHTML = '<p class="text-red-400 text-xs uppercase tracking-widest py-4">Erreur de chargement</p>';
            }
        }

        async function handleMjPlayerSheetFilterChange(key, value) {
            if (currentProfile?.role !== 'mj') return;
            mjPlayerSheetsFilters = { ...mjPlayerSheetsFilters, [key]: value };
            await renderMjPlayerSheetsPanel();
        }

        function handleMjPlayerSheetSearchInput(value) {
            if (currentProfile?.role !== 'mj') return;
            mjPlayerSheetsFilters = { ...mjPlayerSheetsFilters, search: String(value || '') };
            if (mjPlayerSheetsSearchTimer) clearTimeout(mjPlayerSheetsSearchTimer);
            mjPlayerSheetsSearchTimer = setTimeout(() => {
                mjPlayerSheetsSearchTimer = null;
                renderMjPlayerSheetsPanel();
            }, 300);
        }

        async function loadMoreMjPlayerSheets() {
            if (currentProfile?.role !== 'mj' || !mjPlayerSheetsHasMore) return;
            await renderMjPlayerSheetsPanel({ append: true });
        }

        async function handleAdminSheetFilterChange(key, value) {
            if (!isAdminRole()) return;
            adminSheetsFilters = { ...adminSheetsFilters, [key]: value };
            await renderAdminAllSheetsPanel();
        }

        function handleAdminSheetSearchInput(value) {
            if (!isAdminRole()) return;
            adminSheetsFilters = { ...adminSheetsFilters, search: String(value || '') };
            if (adminSheetsSearchTimer) clearTimeout(adminSheetsSearchTimer);
            adminSheetsSearchTimer = setTimeout(() => {
                adminSheetsSearchTimer = null;
                renderAdminAllSheetsPanel();
            }, 300);
        }

        async function loadMoreAdminSheets() {
            if (!isAdminRole() || !adminSheetsHasMore) return;
            await renderAdminAllSheetsPanel({ append: true });
        }

        async function switchAdminTab(tab) {
            adminPanelTab = tab === 'unguilded' || tab === 'sheets' ? tab : 'users';
            updateAdminTabs();
            if (adminPanelTab === 'users') await renderAdminPanel();
            else if (adminPanelTab === 'unguilded') await renderAdminUnguildedPanel();
            else await renderAdminAllSheetsPanel();
        }

        async function toggleAdminPanel(forceOpen) {
            if (!isAdminRole()) return;
            const panel = document.getElementById('adminPanel');
            if (!panel) return;
            const open = typeof forceOpen === 'boolean' ? forceOpen : panel.classList.contains('hidden');
            panel.classList.toggle('hidden', !open);
            if (open) await switchAdminTab(adminPanelTab);
        }

        async function handleAdminRoleChange(userId) {
            if (!isAdminRole()) return;
            const roleSelect = document.getElementById(`role-${userId}`);
            const guildSelect = document.getElementById(`mj-guild-${userId}`);
            const role = roleSelect?.value || 'user';
            const defaultGuildId = AppGuilds?.GUILDS[0]?.id || null;
            const mjGuildId = role === 'mj' ? (guildSelect?.value || defaultGuildId) : null;

            if (guildSelect) {
                guildSelect.classList.toggle('hidden', role !== 'mj');
                if (role === 'mj' && !guildSelect.value && defaultGuildId) guildSelect.value = defaultGuildId;
            }

            try {
                await AppCloud.setUserRole(userId, role, mjGuildId);
                if (userId === getCurrentUserId()) {
                    await refreshCurrentProfile();
                    if (!isAdminRole()) showHomeView();
                }
                await renderHomeView();
            } catch (error) {
                console.error('[admin:role]', error);
                alert('Erreur lors du changement de role.');
                await renderAdminPanel();
            }
        }

        async function handleAdminDisabledToggle(userId, disabled) {
            if (!isAdminRole()) return;
            if (userId === getCurrentUserId()) return;

            const row = document.getElementById(`role-${userId}`)?.closest('[data-testid="admin-user-row"]');
            const pseudo = row?.querySelector('[data-testid="admin-user-pseudo"]')?.textContent?.trim() || 'cet utilisateur';
            const message = disabled
                ? `Desactiver le compte de ${pseudo} ?\n\nCe compte ne pourra plus acceder a l application et ses fiches seront masquees des listes.`
                : `Reactiver le compte de ${pseudo} ?\n\nCe compte pourra de nouveau acceder a l application.`;

            if (!confirm(message)) return;

            const button = row?.querySelector('[data-testid="admin-disable-toggle"]');
            if (button) {
                button.disabled = true;
                button.textContent = disabled ? 'Desactivation...' : 'Reactivation...';
            }

            try {
                await AppCloud.setUserDisabled(userId, disabled);
                await renderAdminPanel();
                await renderHomeView();
            } catch (error) {
                console.error('[admin:disable]', error);
                alert(disabled ? 'Erreur lors de la desactivation.' : 'Erreur lors de la reactivation.');
                await renderAdminPanel();
            }
        }

        async function handleAdminAssignSheetGuild(sheetId, guildId) {
            if (!isAdminRole() || !guildId) return;
            try {
                await AppCloud.assignSheetGuild(sheetId, guildId);
                await renderHomeView();
            } catch (error) {
                console.error('[admin:assign-guild]', error);
                alert('Erreur lors de l attribution de la guilde.');
                await renderHomeView();
            }
        }

        function handlePendingUnguildedGuildChange(sheetId, guildId) {
            if (!isAdminRole()) return;
            if (guildId) {
                pendingUnguildedGuildAssignments[sheetId] = guildId;
            } else {
                delete pendingUnguildedGuildAssignments[sheetId];
            }
            updatePendingUnguildedApplyButton();
        }

        async function applyPendingUnguildedGuildAssignments() {
            if (!isAdminRole()) return;
            const assignments = Object.entries(pendingUnguildedGuildAssignments)
                .filter(([, guildId]) => !!guildId);
            if (assignments.length === 0) return;

            try {
                await Promise.all(assignments.map(([sheetId, guildId]) => AppCloud.assignSheetGuild(sheetId, guildId)));
                pendingUnguildedGuildAssignments = {};
                if (document.getElementById('adminView')?.classList.contains('hidden') === false) {
                    await renderAdminUnguildedPanel();
                } else {
                    await renderHomeView();
                }
            } catch (error) {
                console.error('[admin:assign-guilds]', error);
                alert('Erreur lors de l attribution des guildes.');
                if (document.getElementById('adminView')?.classList.contains('hidden') === false) {
                    await renderAdminUnguildedPanel();
                } else {
                    await renderHomeView();
                }
            }
        }

        function toggleFabMenu() {
            const items = document.getElementById('fabItems');
            const toggle = document.getElementById('fabToggle');
            if (!items) return;
            const isOpen = items.classList.contains('fab-open');
            items.classList.toggle('fab-open', !isOpen);
            items.classList.toggle('fab-closed', isOpen);
            if (toggle) toggle.innerHTML = isOpen ? '&#9776;' : '&#x2715;';
        }

        function closeFabMenu() {
            const items = document.getElementById('fabItems');
            const toggle = document.getElementById('fabToggle');
            if (!items || !items.classList.contains('fab-open')) return;
            items.classList.remove('fab-open');
            items.classList.add('fab-closed');
            if (toggle) toggle.innerHTML = '&#9776;';
        }

        document.addEventListener('click', function (e) {
            const menu = document.getElementById('fabMenu');
            if (menu && !menu.contains(e.target)) closeFabMenu();
        });

        initTextareas();
        bindImageFeature();
        installAutosave();
        setAuthMode('login');

        function detectRecoveryRedirect() {
            const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
            const search = window.location.search ? window.location.search.replace(/^\?/, '') : '';
            const combined = `${hash}&${search}`;
            return /(?:^|[&?])type=recovery(?:&|$)/.test(combined);
        }

        // Initialise auth + routing
        (async function () {
            window.__currentSession = null;
            const noAuth = new URLSearchParams(location.search).has('noauth');
            let recoveryRedirect = detectRecoveryRedirect();

            if (noAuth || !AppAuth.isConfigured()) {
                // No Supabase configured, or test bypass — use localStorage only
                if (AppPersistence.listSheetsFromLocalStorage().length > 0) {
                    showHomeView();
                } else {
                    showSheetView();
                }
                return;
            }

            try {
                const redirectState = await AppAuth.consumeAuthRedirect();
                recoveryRedirect = recoveryRedirect || !!redirectState?.isRecovery;
            } catch (error) {
                console.error('[auth:redirect]', error);
            }

            const session = await AppAuth.getSession();
            window.__currentSession = session;
            if (recoveryRedirect) {
                showAuthView();
                setAuthMode('recovery');
                setAuthMessage('Choisissez un nouveau mot de passe pour terminer la récupération.', 'info');
            }

            if (!recoveryRedirect && session) {
                const ready = await ensureProfileReady();
                if (ready) showHomeView();
            } else if (!recoveryRedirect) {
                showAuthView();
            }

            AppAuth.onAuthStateChange(async (event, sess) => {
                window.__currentSession = sess;
                if (event === 'PASSWORD_RECOVERY') {
                    showAuthView();
                    setAuthMode('recovery');
                    setAuthMessage('Choisissez un nouveau mot de passe pour terminer la récupération.', 'info');
                } else if (event === 'SIGNED_IN') {
                    await handlePostSignIn();
                } else if (event === 'SIGNED_OUT') {
                    currentProfile = null;
                    currentSheetReadOnly = false;
                    showAuthView();
                    setAuthMode('login');
                }
            });
        })();

        return {
            autoExpandTextarea,
            addWeapon,
            deleteWeapon,
            renderWeapon,
            wireWeaponRow,
            computeAllWeaponTotals,
            ensureMoveUI,
            updateInvPA: publicUpdateInvPA,
            computeDerivedStats,
            initSheet,
            computeForceAttack,
            exportJSON,
            importJSON,
            resetSheet,
            resetImage,
            clearPdfExportPreviewClone,
            buildPdfExportClone,
            preparePdfExportPreviewForTests,
            exportScreenshotPDF,
            exportScreenshotJPEG,
            saveSheetLocally,
            openStoragePanel,
            closeStoragePanel,
            renderStorageList,
            loadSheetFromStorage,
            deleteSheetFromStorage,
            showAuthView,
            showHomeView,
            showAdminView,
            showSheetView,
            renderHomeView,
            switchHomeSheetTab,
            newSheet,
            openSheetFromHome,
            deleteSheetFromHome,
            importJSONFromHome,
            switchAuthTab,
            handleForgotPassword,
            handleAuthSubmit,
            handleProfileSetupSubmit,
            continueWithoutAccount,
            handleLogout,
            handlePostSignIn,
            toggleAdminPanel,
            switchAdminTab,
            handleAdminRoleChange,
            handleAdminSheetFilterChange,
            handleAdminSheetSearchInput,
            loadMoreAdminSheets,
            handleMjPlayerSheetFilterChange,
            handleMjPlayerSheetSearchInput,
            loadMoreMjPlayerSheets,
            handleAdminDisabledToggle,
            handleAdminAssignSheetGuild,
            handlePendingUnguildedGuildChange,
            applyPendingUnguildedGuildAssignments,
            toggleFabMenu,
            closeFabMenu
        };
    }

    global.CharacterSheetApp = {
        createCharacterSheetApp
    };
})(window);
