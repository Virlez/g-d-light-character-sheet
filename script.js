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
            }
            reader.readAsDataURL(file);
        }
    });
}

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

            // 1. Restaurer les champs
            for (const [key, value] of Object.entries(data)) {
                if (key === 'char_image_data') continue; 
                
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

            // 2. Restaurer l'image
            if (data['char_image_data']) {
                currentImageData = data['char_image_data'];
                imgPreview.style.backgroundImage = `url(${currentImageData})`;
                imgPreview.classList.remove('hidden');
            } else {
                resetImage();
            }

            alert("Fiche chargée avec succès !");
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la lecture du fichier JSON.");
        }
    };
    reader.readAsText(file);
    inputElement.value = ''; // Permet de recharger le même fichier si besoin
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
}

function resetImage() {
    currentImageData = null;
    imgPreview.style.backgroundImage = '';
    imgPreview.classList.add('hidden');
    if (imgInput) imgInput.value = ''; 
}
