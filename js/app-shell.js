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

        initTextareas();
        bindImageFeature();

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
            exportScreenshotJPEG
        };
    }

    global.CharacterSheetApp = {
        createCharacterSheetApp
    };
})(window);