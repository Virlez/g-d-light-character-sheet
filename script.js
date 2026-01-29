// --- AUTO-EXPAND TEXTAREAS ---
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
    const container = document.getElementById('weapons-container');
    const item = button.closest('.weapon-item');
    if (!item) return;
    // Don't delete if it's the last weapon
    if (container.querySelectorAll('.weapon-item').length > 1) {
        item.remove();
        computeAllWeaponTotals();
    }
}

// Create and append a weapon row. Accepts optional data: {name, base, attr, bonus}
function renderWeapon(data = {}) {
    const container = document.getElementById('weapons-container');
    const weaponItem = document.createElement('div');
    weaponItem.className = 'weapon-item grid grid-cols-5 gap-2 items-center';
    // Match the static HTML layout: five grid cells, last cell contains total + delete button
    weaponItem.innerHTML = `
        <input type="text" class="weapon-name w-full p-1 text-xs" placeholder="Nom arme">
        <input type="number" class="weapon-base w-full p-1 text-xs text-right" value="0" min="0">
        <select class="weapon-attr w-full p-1 text-xs">
            <option value="phy">Physique</option>
            <option value="dist">Distance</option>
        </select>
        <input type="number" class="weapon-bonus w-full p-1 text-xs text-right" value="0" step="1" min="0">
        <div class="flex items-center gap-2">
            <input type="number" class="weapon-total w-full p-1 text-xs bg-transparent text-right" value="0" readonly>
            <button type="button" class="weapon-delete text-xs bg-[#002e33] hover:bg-red-900 hover:text-red-500 text-[#00f0ff] px-2 py-1 rounded clip-corner transition-colors">-</button>
        </div>
    `;
    container.appendChild(weaponItem);

    // Populate defaults
    const nameEl = weaponItem.querySelector('.weapon-name');
    const baseEl = weaponItem.querySelector('.weapon-base');
    const attrEl = weaponItem.querySelector('.weapon-attr');
    const bonusEl = weaponItem.querySelector('.weapon-bonus');
    const totalEl = weaponItem.querySelector('.weapon-total');
    const delBtn = weaponItem.querySelector('.weapon-delete');

    if (data.name) nameEl.value = data.name;
    if (typeof data.base !== 'undefined') baseEl.value = data.base;
    if (data.attr) attrEl.value = data.attr;
    if (typeof data.bonus !== 'undefined') bonusEl.value = data.bonus;

    // wire events
    [nameEl, baseEl, attrEl, bonusEl].forEach(el => {
        el.addEventListener('input', computeAllWeaponTotals);
        el.addEventListener('change', computeAllWeaponTotals);
    });
    delBtn.addEventListener('click', function() { deleteWeapon(this); });

    // initial total
    computeAllWeaponTotals();
    // no debug calc displayed
}

// Wire an existing weapon-item element so its inputs trigger recalculation
function wireWeaponRow(item) {
    if (!item) return;
    const nameEl = item.querySelector('.weapon-name');
    const baseEl = item.querySelector('.weapon-base');
    const attrEl = item.querySelector('.weapon-attr');
    const bonusEl = item.querySelector('.weapon-bonus');
    const delBtn = item.querySelector('.weapon-delete');

    [nameEl, baseEl, attrEl, bonusEl].forEach(el => {
        if (!el) return;
        el.addEventListener('input', computeAllWeaponTotals);
        el.addEventListener('change', computeAllWeaponTotals);
    });
    if (delBtn) delBtn.addEventListener('click', function() { deleteWeapon(this); });
    // no debug calc to attach
}

function computeAllWeaponTotals() {
    const phyTotal = toNumber(document.getElementById('attr_phy')?.value) + toNumber(document.getElementById('attr_phy_bonus')?.value);
    const distTotal = toNumber(document.getElementById('attr_dist')?.value) + toNumber(document.getElementById('attr_dist_bonus')?.value);
    document.querySelectorAll('.weapon-item').forEach(item => {
        const base = toNumber(item.querySelector('.weapon-base')?.value);
        const attr = item.querySelector('.weapon-attr')?.value || 'phy';
        const bonus = toNumber(item.querySelector('.weapon-bonus')?.value);
        const totalEl = item.querySelector('.weapon-total');
        const attrVal = attr === 'dist' ? distTotal : phyTotal;
        const total = base + attrVal + bonus;
        if (totalEl) totalEl.value = total;
    });
}

// --- LOGIQUE IMAGE PREVIEW ---
const imgInput = document.getElementById('imgUpload');
const imgPreview = document.getElementById('imgPreview');
let currentImageData = null; // Stocke l'image en Base64

if (imgInput) {
    imgInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                currentImageData = e.target.result;
                imgPreview.style.backgroundImage = `url(${currentImageData})`;
                imgPreview.classList.remove('hidden');
                // Mark container as having an image so placeholder content disappears,
                // but keep the label clickable to allow replacing the image.
                const container = imgInput.closest('.char-img-placeholder');
                if (container) container.classList.add('has-image');
            }
            reader.readAsDataURL(file);
        }
    });
}

// --- DERIVED STATS AUTOMATIONS ---
const toNumber = v => {
    if (v === null || v === undefined) return 0;
    const n = Number(String(v).replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(n) ? n : 0;
};

// Update displayed inv_pa based on base value, exotic checkbox and armor select
function updateInvPA() {
    const invPaEl = document.getElementById('inv_pa');
    if (!invPaEl) return;
    const armorSelect = document.getElementById('armor_type');
    const exoticEl = document.getElementById('armor_exotic');

    // Determine base value (priority: armor select -> stored base -> current value)
    let base = 0;
    if (armorSelect && armorSelect.value) {
        // Special case: 'none' means explicitly no armor -> clear value and ignore exotic
        if (armorSelect.value === 'none') {
            invPaEl.dataset.base = '';
            invPaEl.value = '';
            computeDerivedStats();
            return;
        }
        base = toNumber(armorSelect.value);
        invPaEl.dataset.base = String(base);
    } else if (invPaEl.dataset && invPaEl.dataset.base) {
        base = toNumber(invPaEl.dataset.base);
    } else {
        base = toNumber(invPaEl.value);
        invPaEl.dataset.base = String(base);
    }

    const isExotic = exoticEl && exoticEl.checked;
    const multiplier = isExotic ? 1.1 : 1;
    const final = Math.round(base * multiplier);
    invPaEl.value = final || '';
    computeDerivedStats();
}

function computeDerivedStats() {
    // Copy inv_pa -> stat_pa, inv_bp -> stat_bp, inv_shield -> stat_shield
    const invPa = document.getElementById('inv_pa');
    const invBp = document.getElementById('inv_bp');
    const invShield = document.getElementById('inv_shield');
    const statPa = document.getElementById('stat_pa');
    const statBp = document.getElementById('stat_bp');
    const statShield = document.getElementById('stat_shield');
    if (invPa && statPa) statPa.value = invPa.value || '';
    if (invBp && statBp) statBp.value = invBp.value || '';
    if (invShield && statShield) statShield.value = invShield.value || '';

    // stat_hp = (attr_con + attr_con_bonus) * 5
    const attrCon = document.getElementById('attr_con');
    const attrConBonus = document.getElementById('attr_con_bonus');
    const statHp = document.getElementById('stat_hp');
    if (statHp) {
        const con = toNumber(attrCon && attrCon.value);
        const conBonus = toNumber(attrConBonus && attrConBonus.value);
        statHp.value = (con + conBonus) * 5;
    }

    // stat_res = ceil( (attr_con + attr_con_bonus) / 2 )
    const statRes = document.getElementById('stat_res');
    if (statRes) {
        const con2 = toNumber(attrCon && attrCon.value);
        const conBonus2 = toNumber(attrConBonus && attrConBonus.value);
        statRes.value = Math.ceil((con2 + conBonus2) / 2);
    }

    // stat_def = ceil( max(attr_dist+bonus, attr_phy+bonus) / 2 )
    const attrDist = document.getElementById('attr_dist');
    const attrDistBonus = document.getElementById('attr_dist_bonus');
    const attrPhy = document.getElementById('attr_phy');
    const attrPhyBonus = document.getElementById('attr_phy_bonus');
    const statDef = document.getElementById('stat_def');
    if (statDef) {
        const dist = toNumber(attrDist && attrDist.value);
        const distBonus = toNumber(attrDistBonus && attrDistBonus.value);
        const phy = toNumber(attrPhy && attrPhy.value);
        const phyBonus = toNumber(attrPhyBonus && attrPhyBonus.value);
        const higher = Math.max(dist + distBonus, phy + phyBonus);
        statDef.value = Math.ceil(higher / 2);
    }

    // stat_init = higher of (attr_con + attr_con_bonus) and (attr_expl + attr_expl_bonus)
    // minus armor malus: none=0, légère=0, intermédiaire=1, lourde=2
    const statInit = document.getElementById('stat_init');
    if (statInit) {
        const conTotal = toNumber(attrCon && attrCon.value) + toNumber(attrConBonus && attrConBonus.value);
        const attrExpl = document.getElementById('attr_expl');
        const attrExplBonus = document.getElementById('attr_expl_bonus');
        const explTotal = toNumber(attrExpl && attrExpl.value) + toNumber(attrExplBonus && attrExplBonus.value);
        const higherCE = Math.max(conTotal, explTotal);

        let malus = 0;
        const armorSelect = document.getElementById('armor_type');
        if (armorSelect) {
            const v = String(armorSelect.value || 'none');
            if (v === '60') malus = 1; // Intermédiaire
            else if (v === '80') malus = 2; // Lourde
            else malus = 0; // 'none' or '40' (Légère) => 0
        }

        const initVal = Math.max(0, higherCE - malus);
        statInit.value = initVal;
    }
    // Recompute weapon totals whenever derived stats (attributes) change
    if (typeof computeAllWeaponTotals === 'function') computeAllWeaponTotals();
}

// Attach listeners and compute derived stats once DOM is ready
// Initialization routine: attach listeners and set initial visibility/state.
function initSheet() {
    // Attach listeners to keep fields in sync
    ['inv_pa','inv_bp','inv_shield','attr_con','attr_con_bonus','attr_dist','attr_dist_bonus','attr_phy','attr_phy_bonus','attr_expl','attr_expl_bonus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', computeDerivedStats);
    });

    // Wire any pre-existing weapon rows present in the HTML so their inputs trigger recalculation
    try {
        document.querySelectorAll('.weapon-item').forEach(item => wireWeaponRow(item));
    } catch (e) {}

    // Compute once on load
    computeDerivedStats();

    // Armor type <select> sync: set inv_pa when armor type is chosen,
    // keep the select in sync when inv_pa is edited manually and apply exotic modifier.
    const armorSelect = document.getElementById('armor_type');
    const invPaEl = document.getElementById('inv_pa');
    const exoticEl = document.getElementById('armor_exotic');

    if (armorSelect) {
        armorSelect.addEventListener('change', function() {
            // store base and update display
            if (armorSelect.value === 'none') {
                // clear PA when 'Aucune' is selected
                invPaEl.dataset.base = '';
                invPaEl.value = '';
                // hide exotic checkbox when none is selected
                const exoticContainer = document.getElementById('armor_exotic_container');
                const inventoryRow = document.getElementById('inventory_row');
                if (exoticContainer) exoticContainer.classList.add('hidden');
                if (inventoryRow) inventoryRow.classList.add('inventory--checkbox-hidden');
                computeDerivedStats();
            } else {
                invPaEl.dataset.base = armorSelect.value || '';
                updateInvPA();
                // show exotic checkbox when a real armor is selected
                const exoticContainer = document.getElementById('armor_exotic_container');
                const inventoryRow = document.getElementById('inventory_row');
                if (exoticContainer) exoticContainer.classList.remove('hidden');
                if (inventoryRow) inventoryRow.classList.remove('inventory--checkbox-hidden');
            }
        });
        // apply on load if a selection is present and set exotic visibility
        if (armorSelect.value) {
            invPaEl && (invPaEl.dataset.base = armorSelect.value);
        }
        // initial show/hide of exotic checkbox
        const exoticContainerInit = document.getElementById('armor_exotic_container');
        if (exoticContainerInit) {
            const inventoryRowInit = document.getElementById('inventory_row');
            if (armorSelect.value === 'none' || !armorSelect.value) {
                exoticContainerInit.classList.add('hidden');
                if (inventoryRowInit) inventoryRowInit.classList.add('inventory--checkbox-hidden');
            } else {
                exoticContainerInit.classList.remove('hidden');
                if (inventoryRowInit) inventoryRowInit.classList.remove('inventory--checkbox-hidden');
            }
        }
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
            const armorSelect = document.getElementById('armor_type');
            const exoticContainer = document.getElementById('armor_exotic_container');
            const inventoryRow = document.getElementById('inventory_row');
            if (armorSelect && armorSelect.value === 'none') {
                if (exoticContainer) exoticContainer.classList.add('hidden');
                if (inventoryRow) inventoryRow.classList.add('inventory--checkbox-hidden');
            } else {
                if (exoticContainer) exoticContainer.classList.remove('hidden');
                if (inventoryRow) inventoryRow.classList.remove('inventory--checkbox-hidden');
            }
        } catch (e) {
            // silent fallback
        }
    }
}

// --- EXPORT JSON ---
function exportJSON() {
    // Ensure all derived values (weapon totals, stats) are up-to-date before export
    try { if (typeof computeAllWeaponTotals === 'function') computeAllWeaponTotals(); } catch(e) {}
    try { if (typeof computeDerivedStats === 'function') computeDerivedStats(); } catch(e) {}
    const data = {};
    // Sélectionne tous les éléments qui ont un ID pertinent
    document.querySelectorAll('input[id], textarea[id], select[id]').forEach(el => {
        if (el.type === 'file') return;
        
        // Gestion spécifique des radios/checkbox
        if (el.type === 'radio') {
            if (el.checked) data[el.name] = el.value;
        } else if (el.type === 'checkbox') {
            data[el.id] = el.checked;
        } else {
            data[el.id] = el.value;
        }
    });

    // Ajoute les armes dynamiques (structured)
    const weapons = [];
    document.querySelectorAll('.weapon-item').forEach(item => {
        const name = item.querySelector('.weapon-name')?.value || '';
        const base = toNumber(item.querySelector('.weapon-base')?.value);
        const attr = item.querySelector('.weapon-attr')?.value || 'phy';
        const bonus = toNumber(item.querySelector('.weapon-bonus')?.value);
        const total = toNumber(item.querySelector('.weapon-total')?.value);
        // Include even if name is empty to preserve structure
        weapons.push({ name, base, attr, bonus, total });
    });
    if (weapons.length > 0) data['weapons'] = weapons;

    // Ajoute l'image si présente
    if (currentImageData) {
        data['char_image_data'] = currentImageData;
    }

    // Création du fichier
    const fileName = (data['char_name'] || 'personnage') + '_swtor.json';
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- IMPORT JSON ---
function importJSON(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            // 0. Clear all fields before importing
            document.querySelectorAll('input, textarea, select').forEach(el => {
                if (el.type === 'file') return;
                
                if (el.type === 'radio' || el.type === 'checkbox') {
                    el.checked = false;
                } else {
                    el.value = '';
                }
            });
            resetImage();

            // 1. Restaurer les champs
            for (const [key, value] of Object.entries(data)) {
                if (key === 'char_image_data' || key === 'weapons') continue; 
                
                // Cas spécial Radio Buttons (Force User)
                if (key === 'force') {
                    const radio = document.querySelector(`input[name="force"][value="${value}"]`);
                    if (radio) radio.checked = true;
                    continue;
                }

                const el = document.getElementById(key);
                if (el) {
                    if (el.type === 'checkbox') {
                        el.checked = value;
                    } else {
                        el.value = value;
                    }
                }
            }

            // 1.5 Restaurer les armes dynamiques
            if (data['weapons'] && Array.isArray(data['weapons'])) {
                const container = document.getElementById('weapons-container');
                // Clear existing weapons
                container.innerHTML = '';
                // Recreate weapons from structured data
                data['weapons'].forEach(w => {
                    if (typeof w === 'string') {
                        // legacy string entry -> name only
                        renderWeapon({ name: w, base: 0, attr: 'phy', bonus: 0 });
                    } else {
                        renderWeapon({ name: w.name || '', base: w.base || 0, attr: w.attr || 'phy', bonus: w.bonus || 0 });
                    }
                });
            } else if (data['wep_main'] || data['wep_sec']) {
                // Backward compatibility: convert old wep_main/wep_sec to new weapons array
                const container = document.getElementById('weapons-container');
                container.innerHTML = '';
                if (data['wep_main']) renderWeapon({ name: data['wep_main'], base: 0, attr: 'phy', bonus: 0 });
                if (data['wep_sec']) renderWeapon({ name: data['wep_sec'], base: 0, attr: 'phy', bonus: 0 });
            }

            // 2. Restaurer l'image
            if (data['char_image_data']) {
                currentImageData = data['char_image_data'];
                imgPreview.style.backgroundImage = `url(${currentImageData})`;
                imgPreview.classList.remove('hidden');
                // Mark container as having an image so placeholder content disappears,
                // but keep the label clickable to allow replacing the image.
                const container = imgInput.closest('.char-img-placeholder');
                if (container) container.classList.add('has-image');
            } else {
                resetImage();
            }


            // If armor type was present in imported data, ensure inv_pa follows it (handles 'none')
            try {
                if (typeof updateInvPA === 'function') updateInvPA();
            } catch (e) {
                // fallback
                computeDerivedStats();
            }

            alert("Fiche chargée avec succès !");
            // Expand all textareas to fit their content
            document.querySelectorAll('textarea').forEach(textarea => {
                autoExpandTextarea(textarea);
            });
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la lecture du fichier JSON.");
        }
    };
    reader.readAsText(file);
    inputElement.value = ''; // Permet de recharger le même fichier si besoin
    // Recompute derived stats after importing values
    computeDerivedStats();
}

// --- REINITIALISER LA FICHE ---
function resetSheet() {
    if (!confirm("Attention : Vous êtes sur le point d'effacer toutes les données de la fiche. Continuer ?")) {
        return;
    }

    // 1. Reset des inputs texte, nombre, select et textarea
    document.querySelectorAll('input, textarea, select').forEach(el => {
        if (el.type === 'file') return;
        
        if (el.type === 'radio' || el.type === 'checkbox') {
            if (el.defaultChecked) {
                el.checked = true;
            } else {
                el.checked = false;
            }
        } else {
            // Remet la valeur par défaut (value="1" etc) ou vide
            el.value = el.defaultValue; 
        }
    });

    // Ensure armor type explicitly resets to 'none' (Aucune) and update layout
    try {
        const armorSelect = document.getElementById('armor_type');
        const exoticContainer = document.getElementById('armor_exotic_container');
        const inventoryRow = document.getElementById('inventory_row');
        if (armorSelect) {
            armorSelect.value = 'none';
        }
        if (exoticContainer) exoticContainer.classList.add('hidden');
        if (inventoryRow) inventoryRow.classList.add('inventory--checkbox-hidden');
    } catch (e) {
        // ignore if elements not present
    }

    // 2. Reset Image
    resetImage();
    // Ensure weapons area resets to a single empty weapon row
    try {
        const container = document.getElementById('weapons-container');
        if (container) {
            container.innerHTML = '';
            renderWeapon();
        }
    } catch (e) {}
    // Recompute derived stats after reset (prefer updateInvPA if available)
    if (typeof updateInvPA === 'function') updateInvPA();
    else computeDerivedStats();
}

function resetImage() {
    currentImageData = null;
    imgPreview.style.backgroundImage = '';
    imgPreview.classList.add('hidden');
    if (imgInput) imgInput.value = '';
    // Remove the has-image marker so the placeholder content becomes visible again
    const container = imgInput?.closest('.char-img-placeholder');
    if (container) container.classList.remove('has-image');
}



