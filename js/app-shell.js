(function (global) {
    const AppLogic = global.CharacterSheetLogic;
    const AppPersistence = global.CharacterSheetPersistence;
    const AppWeapons = global.CharacterSheetWeapons;
    const AppImage = global.CharacterSheetImage;
    const AppPdf = global.CharacterSheetPdf;
    const AppStats = global.CharacterSheetStats;
    const AppAuth = global.CharacterSheetAuth;
    const AppCloud = global.CharacterSheetCloud;

    function createCharacterSheetApp() {
        const imgInput = document.getElementById('imgUpload');
        const imgPreview = document.getElementById('imgPreview');
        let currentImageData = null;
        let currentSheetId = null;
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

        function showHomeView() {
            const email = window.__currentSession && window.__currentSession.user
                ? window.__currentSession.user.email : '';
            const emailEl = document.getElementById('homeUserEmail');
            const userBar = document.getElementById('homeUserBar');
            if (emailEl) emailEl.textContent = email;
            if (userBar) userBar.classList.toggle('hidden', !email);

            renderHomeView();
            document.getElementById('authView')?.classList.add('hidden');
            document.getElementById('homeView')?.classList.remove('hidden');
            document.getElementById('sheetView')?.classList.add('hidden');
            document.getElementById('fabMenu')?.classList.add('hidden');
            closeFabMenu();
        }

        function showSheetView() {
            document.getElementById('authView')?.classList.add('hidden');
            document.getElementById('homeView')?.classList.add('hidden');
            document.getElementById('sheetView')?.classList.remove('hidden');
            document.getElementById('fabMenu')?.classList.remove('hidden');
        }

        async function renderHomeView() {
            const list = document.getElementById('homeSheetList');
            if (!list) return;

            let sheets;
            if (isLoggedIn()) {
                list.innerHTML = '<div class="col-span-full text-center py-16"><p class="text-gray-500 text-xs uppercase tracking-widest">Chargement...</p></div>';
                try {
                    sheets = await AppCloud.listSheets();
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
            const entry = isLoggedIn()
                ? await AppCloud.loadSheet(id)
                : AppPersistence.loadSheetFromLocalStorage(id);
            if (!entry) { alert('Fiche introuvable.'); return; }
            const result = AppPersistence.applySheetData(entry.data, {
                resetImage, renderWeapon, imgPreview, imgInput,
                ensureMoveUI, autoExpandTextarea,
                updateInvPA: publicUpdateInvPA, computeDerivedStats
            });
            currentImageData = result.currentImageData;
            currentSheetId = id;
            showSheetView();
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
            document.getElementById('homeView')?.classList.add('hidden');
            document.getElementById('sheetView')?.classList.add('hidden');
            document.getElementById('fabMenu')?.classList.add('hidden');
            closeFabMenu();
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
            const password = document.getElementById('authPassword')?.value;
            const submitBtn = document.getElementById('authSubmitBtn');
            const mode = authMode;
            const isLogin = mode === 'login';
            const isRecovery = mode === 'recovery';

            if (!email && !isRecovery) {
                setAuthMessage('E-mail requis.', 'error');
                return;
            }
            if (!password) {
                setAuthMessage('Mot de passe requis.', 'error');
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
                    await AppAuth.signUp(email, password);
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

        async function handlePostSignIn() {
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
                showHomeView();
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
            showSheetView,
            renderHomeView,
            newSheet,
            openSheetFromHome,
            deleteSheetFromHome,
            importJSONFromHome,
            switchAuthTab,
            handleForgotPassword,
            handleAuthSubmit,
            continueWithoutAccount,
            handleLogout,
            handlePostSignIn,
            toggleFabMenu,
            closeFabMenu
        };
    }

    global.CharacterSheetApp = {
        createCharacterSheetApp
    };
})(window);
