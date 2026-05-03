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
    weaponItem.setAttribute('data-testid', 'weapon-row');
    weaponItem.className = 'weapon-item grid grid-cols-5 gap-2 items-center';
    // Match the static HTML layout: five grid cells, last cell contains total + delete button
    weaponItem.innerHTML = `
        <input type="text" data-testid="weapon-name" class="weapon-name w-full p-1 text-sm" placeholder="Nom arme">
        <input type="number" data-testid="weapon-base" class="weapon-base w-full p-1 text-sm text-right" value="0" min="0">
        <select data-testid="weapon-attr" class="weapon-attr w-full p-1 text-sm">
                <option value="none">Aucun</option>
                <option value="phy">Physique</option>
                <option value="dist">Distance</option>
            </select>
        <input type="number" data-testid="weapon-bonus" class="weapon-bonus w-full p-1 text-sm text-right" value="0" step="1" min="0">
        <div class="flex items-center gap-2">
            <input type="number" data-testid="weapon-total" class="weapon-total w-full p-1 text-sm bg-transparent text-right" value="0" readonly>
            <button type="button" data-testid="delete-weapon-button" class="weapon-delete text-sm bg-[#002e33] hover:bg-red-900 hover:text-red-500 text-[#00f0ff] px-2 py-1 rounded clip-corner transition-colors">-</button>
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
        let attrVal = 0;
        if (attr === 'dist') attrVal = distTotal;
        else if (attr === 'phy') attrVal = phyTotal;
        else attrVal = 0; // 'none' or unknown => contributes 0
        const total = base + attrVal + bonus;
        if (totalEl) totalEl.value = total;
    });
}

// --- LOGIQUE IMAGE PREVIEW ---
const imgInput = document.getElementById('imgUpload');
const imgPreview = document.getElementById('imgPreview');
let currentImageData = null; // Stocke l'image en Base64

if (imgInput) {
    // Unified file handler used by both input change and drop events
    const handleImageFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            currentImageData = e.target.result;
            if (imgPreview) imgPreview.style.backgroundImage = `url(${currentImageData})`;
            if (imgPreview) imgPreview.classList.remove('hidden');
            // Mark container as having an image so placeholder content disappears,
            // but keep the label clickable to allow replacing the image.
            const container = imgInput.closest('.char-img-placeholder');
            if (container) container.classList.add('has-image');
            if (imgPreview) {
                imgPreview.style.backgroundSize = 'cover';
                imgPreview.style.backgroundPosition = '50% 50%';
            }
            try { ensureMoveUI(); } catch (e) {}
        };
        reader.readAsDataURL(file);
    };

    imgInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        handleImageFile(file);
    });

    // Add drag & drop support on the placeholder container
    try {
        const placeholder = imgInput.closest('.char-img-placeholder');
        if (placeholder) {
            const onDragOver = (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; placeholder.classList.add('dragover'); };
            const onDragEnter = (ev) => { ev.preventDefault(); placeholder.classList.add('dragover'); };
            const onDragLeave = (ev) => { ev.preventDefault(); placeholder.classList.remove('dragover'); };
            const onDrop = (ev) => {
                ev.preventDefault();
                placeholder.classList.remove('dragover');
                const dt = ev.dataTransfer;
                if (!dt) return;
                const file = dt.files && dt.files[0];
                if (file && file.type && file.type.startsWith('image/')) {
                    handleImageFile(file);
                    // ensure move UI is available after drop (FileReader is async)
                    setTimeout(() => {
                        try { ensureMoveUI(); } catch (e) {}
                        try {
                            // try to enter move-mode automatically so the user can drag immediately
                            const pl = imgInput.closest('.char-img-placeholder');
                            if (pl) {
                                pl.classList.add('move-mode');
                                const lbl = pl.querySelector('label[for="imgUpload"]');
                                if (lbl) lbl.style.pointerEvents = 'none';
                                const btn = pl.querySelector('.move-handle');
                                if (btn) btn.textContent = 'Terminer';
                            }
                        } catch (e) {}
                    }, 80);
                } else if (dt.items && dt.items.length) {
                    // fallback: try to extract file from items (some browsers)
                    for (let i = 0; i < dt.items.length; i++) {
                        const it = dt.items[i];
                        if (it.kind === 'file') {
                            const f = it.getAsFile();
                            if (f && f.type && f.type.startsWith('image/')) { handleImageFile(f); break; }
                        }
                    }
                }
            };

            placeholder.addEventListener('dragover', onDragOver);
            placeholder.addEventListener('dragenter', onDragEnter);
            placeholder.addEventListener('dragleave', onDragLeave);
            placeholder.addEventListener('drop', onDrop);
        }
    } catch (e) {}
}

// --- DERIVED STATS AUTOMATIONS ---
// --- Image move / pan controls ---
function ensureMoveUI() {
    try {
        const placeholder = imgInput.closest('.char-img-placeholder');
        if (!placeholder) return;

        // create move button if not present
        let btn = placeholder.querySelector('.move-handle');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'move-handle';
            btn.textContent = 'Déplacer';
            // ensure visible even if CSS specificity issues occur
            btn.style.display = 'inline-block';
            btn.style.zIndex = '99999';
            btn.style.pointerEvents = 'auto';
            placeholder.appendChild(btn);
        }

        // state for panning
        let isPanning = false;
        let startX = 0, startY = 0;
        let pos = { x: 50, y: 50 };

        const updateBgPos = () => {
            if (imgPreview) imgPreview.style.backgroundPosition = `${pos.x}% ${pos.y}%`;
        };

        const clamp = v => Math.max(0, Math.min(100, v));

        // toggle move mode (attach handlers only once)
        if (!btn._moveListenerAttached) {
            const toggleMove = function(e) {
                e && e.stopPropagation && e.stopPropagation();
                const moving = placeholder.classList.toggle('move-mode');
                btn.textContent = moving ? 'Terminer' : 'Déplacer';
                // when entering move-mode, allow pointer events to reach the preview
                const label = placeholder.querySelector('label[for="imgUpload"]');
                if (label) label.style.pointerEvents = moving ? 'none' : '';
            };
            // Use pointerdown only to support mouse and touch without causing
            // a duplicate 'click' event that would toggle twice.
            btn.addEventListener('pointerdown', function(e){ e.preventDefault(); toggleMove(e); });
            btn._moveListenerAttached = true;
        }

        // --- Zoom controls and state ---
        // maintain per-placeholder image state: scale (%) and position {x,y}
        placeholder._imgState = placeholder._imgState || { scale: 100, pos: { x: 50, y: 50 } };
        const state = placeholder._imgState;

        // create zoom controls
        let zoomWrap = placeholder.querySelector('.zoom-controls');
        if (!zoomWrap) {
            zoomWrap = document.createElement('div');
            zoomWrap.className = 'zoom-controls';
            const zin = document.createElement('button'); zin.type = 'button'; zin.className = 'zoom-in'; zin.textContent = '+';
            const zout = document.createElement('button'); zout.type = 'button'; zout.className = 'zoom-out'; zout.textContent = '−';
            const slider = document.createElement('input');
            slider.type = 'range'; slider.className = 'zoom-slider';
            slider.min = 20; slider.max = 400; slider.step = 1;
            // order: minus, slider, plus (user requested inverted positions)
            zoomWrap.appendChild(zout);
            zoomWrap.appendChild(slider);
            zoomWrap.appendChild(zin);
            // place zoom controls to the left of move handle visually
            placeholder.appendChild(zoomWrap);
        }

        const updateBgSize = () => {
            if (!imgPreview) return;
            imgPreview.style.backgroundSize = (state.scale ? String(state.scale) + '%' : 'cover');
            imgPreview.style.backgroundPosition = `${state.pos.x}% ${state.pos.y}%`;
            // sync slider if present
            try {
                const s = placeholder.querySelector('.zoom-slider');
                if (s) s.value = String(state.scale);
            } catch (e) {}
        };

        const clampScale = s => Math.max(20, Math.min(400, s));
        const setScale = (s) => { state.scale = clampScale(Math.round(s)); updateBgSize(); };

        // Attach zoom handlers once
        if (!placeholder._zoomHandlersAttached) {
            const zinBtn = placeholder.querySelector('.zoom-in');
            const zoutBtn = placeholder.querySelector('.zoom-out');
            const sliderEl = placeholder.querySelector('.zoom-slider');
            if (zinBtn) zinBtn.addEventListener('click', () => setScale(state.scale + 10));
            if (zoutBtn) zoutBtn.addEventListener('click', () => setScale(state.scale - 10));
            if (sliderEl) sliderEl.addEventListener('input', (ev) => setScale(Number(ev.target.value)));

            // wheel to zoom when in move-mode
            const onWheel = (ev) => {
                if (!placeholder.classList.contains('move-mode')) return;
                ev.preventDefault();
                const delta = ev.deltaY;
                if (delta < 0) setScale(state.scale + 8); else setScale(state.scale - 8);
            };
            placeholder.addEventListener('wheel', onWheel, { passive: false });
            placeholder._zoomHandlersAttached = true;
        }

        // apply initial state to preview
        updateBgSize();

        // pointer handlers on the placeholder so users can drag anywhere
        const onPointerDown = (ev) => {
            if (!placeholder.classList.contains('move-mode')) return;
            if (!imgPreview) return;
            isPanning = true;
            startX = ev.clientX;
            startY = ev.clientY;
            // read current background position if set
            const bp = (imgPreview.style.backgroundPosition || '50% 50%').split(' ');
            pos.x = parseFloat(bp[0]) || 50;
            pos.y = parseFloat(bp[1]) || 50;
            ev.target.setPointerCapture && ev.target.setPointerCapture(ev.pointerId);
        };

        const onPointerMove = (ev) => {
            if (!isPanning) return;
            ev.preventDefault();
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            const rect = imgPreview.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            const dxPct = (dx / rect.width) * 100;
            const dyPct = (dy / rect.height) * 100;
            pos.x = clamp(pos.x + dxPct);
            pos.y = clamp(pos.y + dyPct);
            startX = ev.clientX;
            startY = ev.clientY;
            updateBgPos();
        };

        const onPointerUp = (ev) => {
            if (!isPanning) return;
            isPanning = false;
            try { ev.target.releasePointerCapture && ev.target.releasePointerCapture(ev.pointerId); } catch(e) {}
        };

        // attach once
        if (!placeholder._moveHandlersAttached) {
            placeholder.addEventListener('pointerdown', onPointerDown);
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            placeholder._moveHandlersAttached = true;
        }
    } catch (e) {}
}
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

    // --- Calcul dynamique du niveau ---
    // Niveau = somme de tous les attributs (sans les bonus) - 17, min 0
    const statLvl = document.getElementById('stat_lvl');
    if (statLvl) {
        const baseAttrs = ['attr_con','attr_str','attr_phy','attr_dist','attr_know','attr_soc','attr_pilot','attr_expl'];
        let sum = 0;
        baseAttrs.forEach(aid => {
            const ael = document.getElementById(aid);
            if (ael) sum += toNumber(ael.value);
        });
        const lvl = Math.max(0, sum - 17);
        statLvl.value = lvl;
    }

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
    // Attach listeners to keep fields in sync
    ['inv_pa','inv_bp','inv_shield','attr_con','attr_con_bonus','attr_dist','attr_dist_bonus','attr_phy','attr_phy_bonus','attr_expl','attr_expl_bonus','attr_str','attr_know','attr_soc','attr_pilot'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', computeDerivedStats);
    });

    // Wire any pre-existing weapon rows present in the HTML so their inputs trigger recalculation
    try {
        document.querySelectorAll('.weapon-item').forEach(item => wireWeaponRow(item));
    } catch (e) {}

    // Add small +/- steppers to base attribute inputs for easier editing
    try {
        const baseAttrs = ['attr_con','attr_str','attr_phy','attr_dist','attr_know','attr_soc','attr_pilot','attr_expl'];
        baseAttrs.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            // Avoid adding multiple steppers if already added
            if (el.dataset.stepper === '1') return;

            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'attr-stepper';

            const dec = document.createElement('button');
            dec.type = 'button';
            dec.className = 'attr-dec';
            dec.title = 'Décrémenter';
            dec.textContent = '−';

            const inc = document.createElement('button');
            inc.type = 'button';
            inc.className = 'attr-inc';
            inc.title = 'Incrémenter';
            inc.textContent = '+';

            // Adjust input appearance for stepper
            el.classList.add('attr-input');
            // Place elements: dec, input, inc
            el.parentNode && el.parentNode.replaceChild(wrapper, el);
            wrapper.appendChild(dec);
            wrapper.appendChild(el);
            wrapper.appendChild(inc);

            // mark as processed
            el.dataset.stepper = '1';

            // clamp function
            const clampValue = (v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return 0;
                return Math.min(Math.max(0, Math.round(n)), 7);
            };

            const stepFn = (delta, ev) => {
                const cur = toNumber(el.value);
                const step = (ev && ev.shiftKey) ? 5 : 1;
                const next = clampValue(cur + delta * step);
                el.value = next;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            };

            // clamp on manual input as well
            el.addEventListener('input', function() {
                const clamped = clampValue(this.value);
                if (String(this.value) !== String(clamped)) this.value = clamped;
            });

            dec.addEventListener('click', function(e) { stepFn(-1, e); });
            inc.addEventListener('click', function(e) { stepFn(1, e); });
        });
    } catch (e) {
        // silent
    }

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
    const isForceUser = document.getElementById('force_yes')?.checked;
    const row = document.getElementById('talent_force_row');
    if (!row) return;
    // Show row only when user is force-capable
    if (isForceUser) row.classList.remove('hidden'); else row.classList.add('hidden');

    if (!isForceUser) return;

    const str = toNumber(document.getElementById('attr_str')?.value);
    const strBonus = toNumber(document.getElementById('attr_str_bonus')?.value);
    const base = (str * 2) + strBonus;
    const baseEl = document.getElementById('talent_force_base');
    const bonusEl = document.getElementById('talent_force_bonus');
    const totalEl = document.getElementById('talent_force_total');
    if (baseEl) baseEl.value = base;
    const bonus = toNumber(bonusEl?.value);
    if (totalEl) totalEl.value = base + bonus;
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
            const baseAttrs = ['attr_con','attr_str','attr_phy','attr_dist','attr_know','attr_soc','attr_pilot','attr_expl'];
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
                        // If this is a base attribute, enforce max value 7 on import
                        if (baseAttrs.includes(key)) {
                            const n = Number(value);
                            el.value = String(Number.isFinite(n) ? Math.min(Math.max(0, n), 7) : 0);
                        } else {
                            el.value = value;
                        }
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
                    try { ensureMoveUI(); } catch (e) {}
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
    if (container) {
        container.classList.remove('has-image');
        // remove move UI if present
        const btn = container.querySelector('.move-handle');
        if (btn) btn.remove();
        const zoom = container.querySelector('.zoom-controls');
        if (zoom) zoom.remove();
        container.classList.remove('move-mode');
        const label = container.querySelector('label[for="imgUpload"]');
        if (label) label.style.pointerEvents = '';
        // clear stored state
        try { delete container._imgState; container._moveHandlersAttached = false; container._zoomHandlersAttached = false; } catch(e) {}
    }
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



