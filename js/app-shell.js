(function (global) {
    const AppLogic = global.CharacterSheetLogic;
    const AppPersistence = global.CharacterSheetPersistence;
    const AppWeapons = global.CharacterSheetWeapons;
    const AppImage = global.CharacterSheetImage;
    const AppPdf = global.CharacterSheetPdf;
    const AppStats = global.CharacterSheetStats;

    function createCharacterSheetApp() {
        const imgInput = document.getElementById('imgUpload');
        const imgPreview = document.getElementById('imgPreview');
        let currentImageData = null;
        let currentSheetId = null;
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
        }

        function deleteWeapon(button) {
            AppWeapons.deleteWeapon(button, { computeAllWeaponTotals });
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

        function saveSheetLocally() {
            try { computeAllWeaponTotals(); } catch (error) {}
            try { computeDerivedStats(); } catch (error) {}

            const data = AppPersistence.collectExportData({ currentImageData, toNumber });
            const isUpdate = currentSheetId !== null;
            currentSheetId = AppPersistence.saveSheetToLocalStorage(data, currentSheetId);
            alert(isUpdate ? 'Fiche mise à jour !' : 'Fiche sauvegardée !');
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

        function showHomeView() {
            renderHomeView();
            document.getElementById('homeView')?.classList.remove('hidden');
            document.getElementById('sheetView')?.classList.add('hidden');
            document.getElementById('fabMenu')?.classList.add('hidden');
            closeFabMenu();
        }

        function showSheetView() {
            document.getElementById('homeView')?.classList.add('hidden');
            document.getElementById('sheetView')?.classList.remove('hidden');
            document.getElementById('fabMenu')?.classList.remove('hidden');
        }

        function renderHomeView() {
            const list = document.getElementById('homeSheetList');
            if (!list) return;
            const sheets = AppPersistence.listSheetsFromLocalStorage();

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
                const safeSrc = sheet.imageData && sheet.imageData.startsWith('data:image/') ? sheet.imageData : null;
                const imgHtml = safeSrc
                    ? `<img src="${safeSrc}" class="w-full h-full object-cover" style="object-position: center 20%" alt="">`
                    : `<div class="w-full h-full flex items-center justify-center text-5xl opacity-10">&#9632;</div>`;
                return `<div class="bg-[#001a1f] border border-[#004e53] rounded-lg overflow-hidden hover:border-[#00f0ff] transition-colors">
                    <div class="h-52 bg-[#002e33] overflow-hidden cursor-pointer" onclick="openSheetFromHome('${sheet.id}')">${imgHtml}</div>
                    <div class="p-3 cursor-pointer" onclick="openSheetFromHome('${sheet.id}')">
                        <div class="text-[#00f0ff] font-bold text-base truncate">${name}</div>
                        <div class="text-gray-500 text-xs mt-1">${date}</div>
                    </div>
                    <div class="flex border-t border-[#004e53]">
                        <button onclick="openSheetFromHome('${sheet.id}')"
                                class="flex-1 py-2 text-[#00f0ff] hover:bg-[#004e53] text-xs uppercase font-bold tracking-wider transition-colors">
                            Ouvrir
                        </button>
                        <button onclick="deleteSheetFromHome('${sheet.id}')"
                                class="py-2 px-4 text-gray-600 hover:text-red-400 hover:bg-red-900/20 text-sm transition-colors border-l border-[#004e53]">
                            &#x2715;
                        </button>
                    </div>
                </div>`;
            }).join('');
        }

        function newSheet() {
            currentSheetId = null;
            AppPersistence.resetSheetState({
                resetImage,
                renderWeapon,
                updateInvPA: publicUpdateInvPA,
                computeDerivedStats
            });
            showSheetView();
        }

        async function openSheetFromHome(id) {
            const entry = AppPersistence.loadSheetFromLocalStorage(id);
            if (!entry) { alert('Fiche introuvable.'); return; }
            const result = AppPersistence.applySheetData(entry.data, {
                resetImage, renderWeapon, imgPreview, imgInput,
                ensureMoveUI, autoExpandTextarea,
                updateInvPA: publicUpdateInvPA, computeDerivedStats
            });
            currentImageData = result.currentImageData;
            currentSheetId = id;
            showSheetView();
        }

        function deleteSheetFromHome(id) {
            if (!confirm('Supprimer cette fiche ?')) return;
            if (currentSheetId === id) currentSheetId = null;
            AppPersistence.deleteSheetFromLocalStorage(id);
            renderHomeView();
        }

        function importJSONFromHome(inputElement) {
            const file = inputElement.files[0];
            if (!file) return;

            AppPersistence.importJsonFile(file, {
                resetImage, renderWeapon, imgPreview, imgInput,
                ensureMoveUI, autoExpandTextarea,
                updateInvPA: publicUpdateInvPA, computeDerivedStats
            }).then((result) => {
                currentImageData = result.currentImageData;
                const data = AppPersistence.collectExportData({ currentImageData: result.currentImageData, toNumber });
                currentSheetId = AppPersistence.saveSheetToLocalStorage(data, null);
                showSheetView();
            }).catch((error) => {
                console.error(error);
                alert('Erreur lors de la lecture du fichier JSON.');
            });

            inputElement.value = '';
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

        // Show home screen if sheets exist, otherwise go directly to new sheet
        if (AppPersistence.listSheetsFromLocalStorage().length > 0) {
            showHomeView();
        } else {
            showSheetView();
        }

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
            showHomeView,
            showSheetView,
            renderHomeView,
            newSheet,
            openSheetFromHome,
            deleteSheetFromHome,
            importJSONFromHome,
            toggleFabMenu,
            closeFabMenu
        };
    }

    global.CharacterSheetApp = {
        createCharacterSheetApp
    };
})(window);