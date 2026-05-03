// --- AUTO-EXPAND TEXTAREAS ---
const AppLogic = window.CharacterSheetLogic;
const AppDom = window.CharacterSheetDom;
const AppPersistence = window.CharacterSheetPersistence;
const AppWeapons = window.CharacterSheetWeapons;
const AppImage = window.CharacterSheetImage;

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
    try {
        const existing = document.getElementById('pdfExportSnapshotRoot');
        if (existing) existing.remove();
    } catch (e) {}
}

async function buildPdfExportClone(options = {}) {
    const preserveClone = !!options.preserveClone;
    const exportLayoutWidth = 1440;
    const target = document.getElementById('sheetRoot') || document.body;

    clearPdfExportPreviewClone();

    const hidden = [];
    document.querySelectorAll('.no-print, .scanline, .move-handle, .zoom-controls').forEach(el => {
        hidden.push({ el, vis: el.style.visibility });
        el.style.visibility = 'hidden';
    });

    await new Promise(r => setTimeout(r, 50));

    const clone = target.cloneNode(true);
    clone.id = 'pdfExportSnapshotRoot';
    clone.setAttribute('data-testid', 'pdf-export-preview');

    try {
        const origSelects = target.querySelectorAll('select');
        const cloneSelects = clone.querySelectorAll('select');
        const len = Math.min(origSelects.length, cloneSelects.length);
        for (let i = 0; i < len; i++) {
            cloneSelects[i].value = origSelects[i].value;
        }
        clone.querySelectorAll('.char-img-placeholder.move-mode').forEach(el => el.classList.remove('move-mode'));
    } catch (e) {}

    clone.style.background = window.getComputedStyle(target).backgroundColor || '#001111';
    clone.style.boxSizing = 'border-box';
    clone.style.padding = window.getComputedStyle(target).padding || '12px';
    clone.style.width = exportLayoutWidth + 'px';
    clone.style.maxWidth = 'none';
    clone.style.height = 'auto';

    try {
        const header = clone.querySelector('header');
        if (header) {
            header.style.display = 'flex';
            header.style.flexDirection = 'row';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'flex-end';
        }

        const mainGrid = clone.querySelector('div.grid.grid-cols-1.lg\\:grid-cols-3');
        if (mainGrid) {
            mainGrid.style.display = 'grid';
            mainGrid.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
            mainGrid.style.alignItems = 'start';
            const firstColumn = mainGrid.children[0];
            if (firstColumn) firstColumn.style.gridColumn = 'span 2 / span 2';
        }

        clone.querySelectorAll('.md\\:grid-cols-2').forEach(el => {
            el.style.display = 'grid';
            el.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
        });

        clone.querySelectorAll('.md\\:grid-cols-4').forEach(el => {
            el.style.display = 'grid';
            el.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
        });

        clone.querySelectorAll('.weapons-headers, .weapon-item').forEach(el => {
            el.style.display = 'grid';
            el.style.gridTemplateColumns = 'repeat(5, minmax(0, 1fr))';
            el.style.gap = '8px';
        });

        const inventoryRow = clone.querySelector('#inventory_row');
        if (inventoryRow) {
            inventoryRow.style.display = 'grid';
            inventoryRow.style.gridTemplateColumns = inventoryRow.classList.contains('inventory--checkbox-hidden')
                ? 'repeat(4, minmax(0, 1fr))'
                : 'repeat(5, minmax(0, 1fr))';
        }
    } catch (e) {}

    const replaceWithText = (el, text) => {
        const span = document.createElement('div');
        span.textContent = text;
        span.style.background = '#00141a';
        span.style.color = '#00f0ff';
        span.style.padding = '6px 8px';
        span.style.border = '1px solid rgba(0,240,255,0.12)';
        span.style.fontWeight = '700';
        span.style.fontFamily = window.getComputedStyle(el).fontFamily || 'Rajdhani, sans-serif';
        const baseFont = parseFloat(window.getComputedStyle(el).fontSize) || 16;
        span.style.fontSize = (baseFont >= 16 ? baseFont : 14) + 'px';
        span.style.lineHeight = '1.1';
        span.style.minHeight = (el.offsetHeight || 20) + 'px';
        span.style.boxSizing = 'border-box';
        span.style.display = 'inline-block';
        span.style.verticalAlign = 'middle';

        try {
            if (el.classList && el.classList.contains('attr-bonus-input')) {
                span.style.minWidth = '46px';
                span.style.padding = '4px 6px';
                span.style.textAlign = 'center';
                span.style.fontSize = Math.max(12, baseFont - 2) + 'px';
            } else if (el.classList && el.classList.contains('weapon-total')) {
                span.style.minWidth = '56px';
                span.style.padding = '4px 6px';
                span.style.textAlign = 'right';
            } else if (el.tagName && el.tagName.toLowerCase() === 'textarea') {
                span.style.display = 'block';
                span.style.whiteSpace = 'pre-wrap';
                span.style.padding = '8px';
            }
        } catch (e) {}

        return span;
    };

    clone.querySelectorAll('input, textarea, select').forEach(el => {
        try {
            let value = '';
            if (el.tagName.toLowerCase() === 'select') {
                value = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : el.value || '';
            } else if (el.type === 'checkbox' || el.type === 'radio') {
                value = el.checked ? '✔' : '';
            } else {
                value = el.value || '';
            }

            const replacement = replaceWithText(el, value);
            el.parentNode && el.parentNode.replaceChild(replacement, el);
        } catch (e) {}
    });

    clone.querySelectorAll('.attr-bonus-label').forEach(lbl => {
        lbl.style.color = '#00f0ff';
        lbl.style.fontWeight = '800';
        lbl.style.fontSize = '12px';
        lbl.style.letterSpacing = '0.06em';
        lbl.style.display = 'block';
        lbl.style.marginBottom = '4px';
    });

    clone.querySelectorAll('.section-box').forEach(sb => {
        sb.style.clipPath = 'none';
        sb.style.borderRadius = '0';
    });

    clone.style.padding = '12px 14px';
    clone.style.margin = '0';
    clone.style.boxSizing = 'border-box';
    clone.style.overflow = 'hidden';

    try {
        clone.querySelectorAll('p').forEach(p => {
            const t = (p.textContent || '').trim();
            if (t.startsWith('©') || t.toLowerCase().includes('©')) p.style.display = 'none';
        });
    } catch (e) {}

    clone.style.position = 'fixed';
    clone.style.left = preserveClone ? '0' : '-10000px';
    clone.style.top = '0';
    clone.style.zIndex = '99999';
    clone.style.pointerEvents = 'none';
    document.body.appendChild(clone);

    hidden.forEach(item => { item.el.style.visibility = item.vis || ''; });

    await new Promise(r => setTimeout(r, 40));

    const opts = {
        scale: Math.min(3, (window.devicePixelRatio || 1) * 1.3),
        useCORS: true,
        logging: false,
        backgroundColor: null,
        width: Math.ceil(clone.scrollWidth),
        height: Math.ceil(clone.scrollHeight),
        scrollX: 0,
        scrollY: 0,
        windowWidth: exportLayoutWidth,
        windowHeight: Math.max(1600, Math.ceil(clone.scrollHeight))
    };

    try {
        window.__lastPdfExportMeta = {
            forcedDesktopLayout: true,
            sourceViewportWidth: window.innerWidth,
            renderWidth: Math.ceil(clone.scrollWidth),
            renderHeight: Math.ceil(clone.scrollHeight),
            renderWindowWidth: opts.windowWidth,
            renderWindowHeight: opts.windowHeight,
            previewCloneVisible: preserveClone
        };
    } catch (e) {}

    return {
        target,
        clone,
        opts,
        cleanup: function() {
            if (!preserveClone && clone && clone.parentNode) clone.remove();
        }
    };
}

async function preparePdfExportPreviewForTests() {
    const result = await buildPdfExportClone({ preserveClone: true });
    return window.__lastPdfExportMeta;
}

async function exportScreenshotPDF() {
    const btn = document.getElementById('screenshotPdfBtn');
    try {
        if (btn) { btn.disabled = true; btn.textContent = 'Génération...'; }

        const { target, clone, opts, cleanup } = await buildPdfExportClone();

        let canvas = await html2canvas(clone, opts);
        // capture background color used for the clone so we can detect empty bottom rows
        const cloneBg = clone.style.background || window.getComputedStyle(target).backgroundColor || '';
        // remove the clone now that capture is done
        cleanup();

        // Crop canvas to remove trailing empty/background-only rows at the bottom
        try {
            const parseRGB = (s) => {
                const m = String(s).match(/rgba?\(([^)]+)\)/);
                if (!m) return null;
                const parts = m[1].split(',').map(p => Number(p.trim()));
                return parts; // [r,g,b] or [r,g,b,a]
            };
            let bg = parseRGB(cloneBg);
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height;
            const img = ctx.getImageData(0, 0, w, h);
            const data = img.data;

            // If cloneBg couldn't be parsed (transparent or complex background),
            // fallback to sampling the top-left pixel of the rendered canvas as background.
            if (!bg) {
                const idx0 = 0; // pixel at (0,0)
                bg = [data[idx0], data[idx0 + 1], data[idx0 + 2]];
            }

            const tol = 8; // tolerance for anti-aliasing / minor differences
            let lastNonBgY = -1;
            for (let y = h - 1; y >= 0; y--) {
                let rowHasContent = false;
                // sample horizontally with a stride to speed up scan on wide canvases
                const stride = Math.max(1, Math.floor(w / 120));
                for (let x = 0; x < w; x += stride) {
                    const idx = (y * w + x) * 4;
                    const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
                    if (a === 0) { rowHasContent = true; break; }
                    if (Math.abs(r - bg[0]) > tol || Math.abs(g - bg[1]) > tol || Math.abs(b - bg[2]) > tol) { rowHasContent = true; break; }
                }
                if (rowHasContent) { lastNonBgY = y; break; }
            }
            if (lastNonBgY >= 0 && lastNonBgY < h - 1) {
                const newH = lastNonBgY + 1;
                const cropped = document.createElement('canvas');
                cropped.width = w;
                cropped.height = newH;
                const cctx = cropped.getContext('2d');
                cctx.drawImage(canvas, 0, 0, w, newH, 0, 0, w, newH);
                canvas = cropped;
            }
        } catch (e) {
            // if anything fails, fall back to original canvas
            console.warn('Canvas cropping failed, using full canvas', e);
        }
        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgProps = pdf.getImageProperties(imgData);
        const imgWidthMm = pageWidth;
        const imgHeightMm = (imgProps.height * imgWidthMm) / imgProps.width;

        if (imgHeightMm <= pageHeight) {
            pdf.addImage(imgData, 'JPEG', 0, 0, imgWidthMm, imgHeightMm);
        } else {
            // If image is taller than a single page, split it into multiple pages
            const pxPerMm = imgProps.width / imgWidthMm; // pixels per mm for this image
            const canvasPageHeight = Math.floor(pageHeight * pxPerMm); // height in pixels per PDF page

            let remainingHeight = canvas.height;
            let sourceY = 0;
            let first = true;
            while (remainingHeight > 0) {
                const sliceHeight = Math.min(canvasPageHeight, remainingHeight);
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = sliceHeight;
                const ctx = pageCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
                const pageData = pageCanvas.toDataURL('image/jpeg', 0.95);
                const pageImgProps = pdf.getImageProperties(pageData);
                const pageImgHeightMm = (pageImgProps.height * imgWidthMm) / pageImgProps.width;

                if (!first) pdf.addPage();
                pdf.addImage(pageData, 'JPEG', 0, 0, imgWidthMm, pageImgHeightMm);

                remainingHeight -= sliceHeight;
                sourceY += sliceHeight;
                first = false;
            }
        }

        const name = (document.getElementById('char_name')?.value || 'fiche') + '.pdf';
        pdf.save(name);
    } catch (err) {
        console.error(err);
        alert('Erreur lors de la génération du PDF.');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Exporter en PDF'; }
    }
}



