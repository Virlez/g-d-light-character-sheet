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
    const container = document.getElementById('weapons-container');
    const weaponItem = document.createElement('div');
    weaponItem.className = 'weapon-item flex gap-1';
    weaponItem.innerHTML = `
        <input type="text" class="weapon-input w-full p-1 text-xs" placeholder="Arme">
        <button onclick="deleteWeapon(this)" type="button" class="text-xs bg-[#002e33] hover:bg-red-900 hover:text-red-500 text-[#00f0ff] px-2 py-1 rounded clip-corner transition-colors">-</button>
    `;
    container.appendChild(weaponItem);
}

function deleteWeapon(button) {
    const container = document.getElementById('weapons-container');
    // Don't delete if it's the last weapon
    if (container.querySelectorAll('.weapon-item').length > 1) {
        button.parentElement.remove();
    }
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
}

// Attach listeners and compute derived stats once DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Attach listeners to keep fields in sync
    ['inv_pa','inv_bp','inv_shield','attr_con','attr_con_bonus','attr_dist','attr_dist_bonus','attr_phy','attr_phy_bonus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', computeDerivedStats);
    });

    // Compute once on load
    computeDerivedStats();
});

// --- EXPORT JSON ---
function exportJSON() {
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

    // Ajoute les armes dynamiques
    const weapons = [];
    document.querySelectorAll('.weapon-input').forEach(input => {
        if (input.value) weapons.push(input.value);
    });
    if (weapons.length > 0) {
        data['weapons'] = weapons;
    }

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
                // Clear existing weapons except the first one
                const items = container.querySelectorAll('.weapon-item');
                for (let i = items.length - 1; i > 0; i--) {
                    items[i].remove();
                }
                // Set the first weapon
                const firstInput = container.querySelector('.weapon-input');
                if (firstInput && data['weapons'][0]) {
                    firstInput.value = data['weapons'][0];
                }
                // Add remaining weapons
                for (let i = 1; i < data['weapons'].length; i++) {
                    addWeapon();
                    const lastInput = container.querySelector('.weapon-item:last-child .weapon-input');
                    if (lastInput) lastInput.value = data['weapons'][i];
                }
            } else if (data['wep_main'] || data['wep_sec']) {
                // Backward compatibility: convert old wep_main/wep_sec to new weapons array
                const container = document.getElementById('weapons-container');
                const items = container.querySelectorAll('.weapon-item');
                for (let i = items.length - 1; i > 0; i--) {
                    items[i].remove();
                }
                const firstInput = container.querySelector('.weapon-input');
                if (firstInput) {
                    firstInput.value = data['wep_main'] || '';
                }
                if (data['wep_sec']) {
                    addWeapon();
                    const lastInput = container.querySelector('.weapon-item:last-child .weapon-input');
                    if (lastInput) lastInput.value = data['wep_sec'];
                }
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

    // 2. Reset Image
    resetImage();
    // Recompute derived stats after reset
    computeDerivedStats();
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



