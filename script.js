// --- AUTO-EXPAND TEXTAREAS ---
const AppLogic = window.CharacterSheetLogic;
const AppDom = window.CharacterSheetDom;
const AppPersistence = window.CharacterSheetPersistence;
const AppWeapons = window.CharacterSheetWeapons;
const AppImage = window.CharacterSheetImage;
const AppPdf = window.CharacterSheetPdf;

function autoExpandTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

document.querySelectorAll('textarea').forEach(textarea => {
    // Auto-expand on input
    textarea.addEventListener('input', function() {
        autoExpandTextarea(this);
    });
    // Initial expansion if there's pre-filled content
    autoExpandTextarea(textarea);
});

// --- WEAPONS MANAGEMENT ---
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

// --- LOGIQUE IMAGE PREVIEW ---
const imgInput = document.getElementById('imgUpload');
const imgPreview = document.getElementById('imgPreview');
let currentImageData = null; // Stocke l'image en Base64

if (imgInput) {
    AppImage.bindImageInput({
        imgInput,
        imgPreview,
        ensureMoveUI,
        onImageChange: (imageData) => {
            currentImageData = imageData;
        }
    });
}

// --- DERIVED STATS AUTOMATIONS ---
// --- Image move / pan controls ---
function ensureMoveUI() {
    AppImage.ensureMoveUI({ imgInput, imgPreview });
}
const toNumber = (value) => AppLogic.toNumber(value);

// Update displayed inv_pa based on base value, exotic checkbox and armor select
function updateInvPA() {
    const invPaEl = document.getElementById('inv_pa');
    if (!invPaEl) return;
    const armorSelect = document.getElementById('armor_type');
    const exoticEl = document.getElementById('armor_exotic');

    const inventoryPa = AppLogic.calculateInventoryPa({
        armorType: armorSelect?.value,
        storedBase: invPaEl.dataset?.base,
        currentValue: invPaEl.value,
        isExotic: !!(exoticEl && exoticEl.checked)
    });

    invPaEl.dataset.base = inventoryPa.clear ? '' : String(inventoryPa.base);
    invPaEl.value = inventoryPa.finalValue;
    computeDerivedStats();
}

function computeDerivedStats() {
    const invPa = document.getElementById('inv_pa');
    const invBp = document.getElementById('inv_bp');
    const invShield = document.getElementById('inv_shield');
    const statPa = document.getElementById('stat_pa');
    const statBp = document.getElementById('stat_bp');
    const statShield = document.getElementById('stat_shield');
    const attrCon = document.getElementById('attr_con');
    const attrConBonus = document.getElementById('attr_con_bonus');
    const attrDist = document.getElementById('attr_dist');
    const attrDistBonus = document.getElementById('attr_dist_bonus');
    const attrPhy = document.getElementById('attr_phy');
    const attrPhyBonus = document.getElementById('attr_phy_bonus');
    const attrExpl = document.getElementById('attr_expl');
    const attrExplBonus = document.getElementById('attr_expl_bonus');
    const armorSelect = document.getElementById('armor_type');

    const baseAttributes = {};
    AppLogic.BASE_ATTRIBUTE_IDS.forEach((attributeId) => {
        baseAttributes[attributeId] = document.getElementById(attributeId)?.value || 0;
    });

    const derivedStats = AppLogic.calculateDerivedStats({
        invPa: invPa?.value,
        invBp: invBp?.value,
        invShield: invShield?.value,
        attrCon: attrCon?.value,
        attrConBonus: attrConBonus?.value,
        attrDist: attrDist?.value,
        attrDistBonus: attrDistBonus?.value,
        attrPhy: attrPhy?.value,
        attrPhyBonus: attrPhyBonus?.value,
        attrExpl: attrExpl?.value,
        attrExplBonus: attrExplBonus?.value,
        armorType: armorSelect?.value,
        baseAttributes
    });

    if (invPa && statPa) statPa.value = derivedStats.statPa;
    if (invBp && statBp) statBp.value = derivedStats.statBp;
    if (invShield && statShield) statShield.value = derivedStats.statShield;
    const statHp = document.getElementById('stat_hp');
    const statRes = document.getElementById('stat_res');
    const statDef = document.getElementById('stat_def');
    const statInit = document.getElementById('stat_init');
    const statLvl = document.getElementById('stat_lvl');
    if (statHp) statHp.value = derivedStats.statHp;
    if (statRes) statRes.value = derivedStats.statRes;
    if (statDef) statDef.value = derivedStats.statDef;
    if (statInit) statInit.value = derivedStats.statInit;
    if (statLvl) statLvl.value = derivedStats.statLvl;

    // Recompute weapon totals whenever derived stats (attributes) change
    if (typeof computeAllWeaponTotals === 'function') computeAllWeaponTotals();

    // Recompute the Force Attack talent line if present
    try {
        computeForceAttack();
    } catch (e) {}
}

// Attach listeners and compute derived stats once DOM is ready
// Initialization routine: attach listeners and set initial visibility/state.
function initSheet() {
    AppDom.attachInputListeners(
        ['inv_pa','inv_bp','inv_shield','attr_con','attr_con_bonus','attr_dist','attr_dist_bonus','attr_phy','attr_phy_bonus','attr_expl','attr_expl_bonus','attr_str','attr_know','attr_soc','attr_pilot'],
        computeDerivedStats
    );

    try {
        AppDom.wireExistingWeaponRows(wireWeaponRow);
    } catch (e) {}

    try {
        AppDom.installAttributeSteppers({
            attributeIds: AppLogic.BASE_ATTRIBUTE_IDS,
            toNumber,
            clampValue: AppLogic.clampBaseAttributeValue
        });
    } catch (e) {
        // silent
    }

    // Compute once on load
    computeDerivedStats();

    // Armor type <select> sync: set inv_pa when armor type is chosen,
    // keep the select in sync when inv_pa is edited manually and apply exotic modifier.
    const armorSelect = AppDom.byId('armor_type');
    const invPaEl = AppDom.byId('inv_pa');
    const exoticEl = AppDom.byId('armor_exotic');

    if (armorSelect) {
        armorSelect.addEventListener('change', function() {
            if (armorSelect.value === 'none') {
                invPaEl.dataset.base = '';
                invPaEl.value = '';
                AppDom.syncArmorVisibility(armorSelect.value);
                computeDerivedStats();
            } else {
                invPaEl.dataset.base = armorSelect.value || '';
                updateInvPA();
                AppDom.syncArmorVisibility(armorSelect.value);
            }
        });
        if (armorSelect.value) {
            invPaEl && (invPaEl.dataset.base = armorSelect.value);
        }
        AppDom.syncArmorVisibility(armorSelect.value);
    }

    if (invPaEl) {
        invPaEl.addEventListener('input', function() {
            // when user edits PA manually, treat that as new base (remove exotic multiplier)
            const n = toNumber(this.value);
            const isExotic = exoticEl && exoticEl.checked;
            const base = isExotic ? Math.round(n / 1.1) : n;
            this.dataset.base = String(base || 0);
            // sync armor select when exact base matches known presets
            if (armorSelect) {
                if (base === 40 || base === 60 || base === 80) {
                    armorSelect.value = String(base);
                } else {
                    armorSelect.value = '';
                }
            }
            computeDerivedStats();
        });
    }

    if (exoticEl) {
        exoticEl.addEventListener('change', function() {
            updateInvPA();
        });
    }
    // Apply initial calculation (if any)
    updateInvPA();

    // Wire Force talent controls: show/hide and compute
    try {
        const forceYes = document.getElementById('force_yes');
        const forceNo = document.getElementById('force_no');
        const bonusEl = document.getElementById('talent_force_bonus');
        if (forceYes) forceYes.addEventListener('change', computeForceAttack);
        if (forceNo) forceNo.addEventListener('change', computeForceAttack);
        if (bonusEl) {
            bonusEl.addEventListener('input', computeForceAttack);
            bonusEl.addEventListener('change', computeForceAttack);
        }
        // Compute initial state
        computeForceAttack();
    } catch (e) {}
}

// Compute the Attaque de Force talent line
function computeForceAttack() {
    const row = document.getElementById('talent_force_row');
    if (!row) return;

    const forceValues = AppLogic.computeForceAttackValues({
        isForceUser: document.getElementById('force_yes')?.checked,
        attrStr: document.getElementById('attr_str')?.value,
        attrStrBonus: document.getElementById('attr_str_bonus')?.value,
        bonus: document.getElementById('talent_force_bonus')?.value
    });

    if (forceValues.visible) row.classList.remove('hidden'); else row.classList.add('hidden');
    if (!forceValues.visible) return;

    const baseEl = document.getElementById('talent_force_base');
    const bonusEl = document.getElementById('talent_force_bonus');
    const totalEl = document.getElementById('talent_force_total');
    if (baseEl) baseEl.value = forceValues.base;
    if (bonusEl && !bonusEl.value) bonusEl.value = '0';
    if (totalEl) totalEl.value = forceValues.total;
}

document.addEventListener('DOMContentLoaded', initSheet);
// If the script is loaded after DOMContentLoaded already fired, run init immediately.
if (document.readyState !== 'loading') {
    initSheet();
}

// Ensure inventory row adjusts when updateInvPA is called externally (import etc.)
// updateInvPA already handles most of the PA logic — keep visibility in sync here.
const _originalUpdateInvPA = typeof updateInvPA === 'function' ? updateInvPA : null;
if (_originalUpdateInvPA) {
    // wrap it so calls also sync the inventory row class based on armor select
    window.updateInvPA = function() {
        _originalUpdateInvPA();
        try {
            const armorSelect = AppDom.byId('armor_type');
            AppDom.syncArmorVisibility(armorSelect?.value);
        } catch (e) {
            // silent fallback
        }
    }
}

// --- EXPORT JSON ---
function exportJSON() {
    try { if (typeof computeAllWeaponTotals === 'function') computeAllWeaponTotals(); } catch(e) {}
    try { if (typeof computeDerivedStats === 'function') computeDerivedStats(); } catch(e) {}
    const data = AppPersistence.collectExportData({
        currentImageData,
        toNumber
    });
    AppPersistence.triggerJsonDownload(data);
}

// --- IMPORT JSON ---
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
        updateInvPA,
        computeDerivedStats
    }).then((result) => {
        currentImageData = result.currentImageData;
        alert("Fiche chargée avec succès !");
    }).catch((error) => {
        console.error(error);
        alert("Erreur lors de la lecture du fichier JSON.");
    });

    inputElement.value = ''; // Permet de recharger le même fichier si besoin
    computeDerivedStats();
}

// --- REINITIALISER LA FICHE ---
function resetSheet() {
    if (!confirm("Attention : Vous êtes sur le point d'effacer toutes les données de la fiche. Continuer ?")) {
        return;
    }

    AppPersistence.resetSheetState({
        resetImage,
        renderWeapon,
        updateInvPA,
        computeDerivedStats
    });
}

function resetImage() {
    currentImageData = null;
    AppImage.resetImageUI({ imgInput, imgPreview });
}

// --- EXPORT VUE (SCREENSHOT) EN PDF ---
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



