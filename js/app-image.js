(function (global) {
    function applyImageData(options) {
        const imgInput = options.imgInput;
        const imgPreview = options.imgPreview;
        const imageData = options.imageData;
        const ensureMoveUI = options.ensureMoveUI;

        if (!imageData) return null;

        if (imgPreview) {
            imgPreview.style.backgroundImage = `url(${imageData})`;
            imgPreview.classList.remove('hidden');
            imgPreview.style.backgroundSize = 'cover';
            imgPreview.style.backgroundPosition = '50% 50%';
        }

        const container = imgInput?.closest('.char-img-placeholder');
        if (container) container.classList.add('has-image');
        try { ensureMoveUI(); } catch (error) {}

        return imageData;
    }

    function readImageFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                resolve(null);
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => resolve(event?.target?.result || null);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function enableMoveMode(placeholder) {
        if (!placeholder) return;
        placeholder.classList.add('move-mode');
        const label = placeholder.querySelector('label[for="imgUpload"]');
        if (label) label.style.pointerEvents = 'none';
        const moveButton = placeholder.querySelector('.move-handle');
        if (moveButton) moveButton.textContent = 'Terminer';
    }

    function bindImageInput(options) {
        const imgInput = options.imgInput;
        const onImageChange = options.onImageChange;
        const ensureMoveUI = options.ensureMoveUI;

        if (!imgInput) return;

        const handleImageFile = async (file, autoEnableMoveMode) => {
            const imageData = await readImageFile(file);
            if (!imageData) return;

            const nextImageData = applyImageData({
                imgInput: options.imgInput,
                imgPreview: options.imgPreview,
                imageData,
                ensureMoveUI
            });

            if (typeof onImageChange === 'function') onImageChange(nextImageData);

            if (autoEnableMoveMode) {
                setTimeout(() => {
                    try { ensureMoveUI(); } catch (error) {}
                    enableMoveMode(imgInput.closest('.char-img-placeholder'));
                }, 80);
            }
        };

        imgInput.addEventListener('change', function (event) {
            const file = event.target.files?.[0];
            handleImageFile(file, false);
        });

        const placeholder = imgInput.closest('.char-img-placeholder');
        if (!placeholder) return;

        const onDragOver = (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            placeholder.classList.add('dragover');
        };
        const onDragEnter = (event) => {
            event.preventDefault();
            placeholder.classList.add('dragover');
        };
        const onDragLeave = (event) => {
            event.preventDefault();
            placeholder.classList.remove('dragover');
        };
        const onDrop = (event) => {
            event.preventDefault();
            placeholder.classList.remove('dragover');
            const dt = event.dataTransfer;
            if (!dt) return;

            const file = dt.files && dt.files[0];
            if (file && file.type && file.type.startsWith('image/')) {
                handleImageFile(file, true);
                return;
            }

            if (!(dt.items && dt.items.length)) return;
            for (let index = 0; index < dt.items.length; index += 1) {
                const item = dt.items[index];
                if (item.kind !== 'file') continue;
                const droppedFile = item.getAsFile();
                if (droppedFile && droppedFile.type && droppedFile.type.startsWith('image/')) {
                    handleImageFile(droppedFile, true);
                    break;
                }
            }
        };

        placeholder.addEventListener('dragover', onDragOver);
        placeholder.addEventListener('dragenter', onDragEnter);
        placeholder.addEventListener('dragleave', onDragLeave);
        placeholder.addEventListener('drop', onDrop);
    }

    function ensureMoveUI(options) {
        const imgInput = options.imgInput;
        const imgPreview = options.imgPreview;
        const placeholder = imgInput?.closest('.char-img-placeholder');
        if (!placeholder) return;

        let moveButton = placeholder.querySelector('.move-handle');
        if (!moveButton) {
            moveButton = document.createElement('button');
            moveButton.type = 'button';
            moveButton.className = 'move-handle';
            moveButton.textContent = 'Déplacer';
            moveButton.style.display = 'inline-block';
            moveButton.style.zIndex = '99999';
            moveButton.style.pointerEvents = 'auto';
            placeholder.appendChild(moveButton);
        }

        let isPanning = false;
        let startX = 0;
        let startY = 0;
        let pos = { x: 50, y: 50 };
        const clamp = (value) => Math.max(0, Math.min(100, value));

        const updateBackgroundPosition = () => {
            if (imgPreview) imgPreview.style.backgroundPosition = `${pos.x}% ${pos.y}%`;
        };

        if (!moveButton._moveListenerAttached) {
            const toggleMove = function (event) {
                event && event.stopPropagation && event.stopPropagation();
                const moving = placeholder.classList.toggle('move-mode');
                moveButton.textContent = moving ? 'Terminer' : 'Déplacer';
                const label = placeholder.querySelector('label[for="imgUpload"]');
                if (label) label.style.pointerEvents = moving ? 'none' : '';
            };
            moveButton.addEventListener('pointerdown', function (event) {
                event.preventDefault();
                toggleMove(event);
            });
            moveButton._moveListenerAttached = true;
        }

        placeholder._imgState = placeholder._imgState || { scale: 100, pos: { x: 50, y: 50 } };
        const state = placeholder._imgState;

        let zoomWrap = placeholder.querySelector('.zoom-controls');
        if (!zoomWrap) {
            zoomWrap = document.createElement('div');
            zoomWrap.className = 'zoom-controls';
            const zoomIn = document.createElement('button');
            zoomIn.type = 'button';
            zoomIn.className = 'zoom-in';
            zoomIn.textContent = '+';
            const zoomOut = document.createElement('button');
            zoomOut.type = 'button';
            zoomOut.className = 'zoom-out';
            zoomOut.textContent = '−';
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'zoom-slider';
            slider.min = 20;
            slider.max = 400;
            slider.step = 1;
            zoomWrap.appendChild(zoomOut);
            zoomWrap.appendChild(slider);
            zoomWrap.appendChild(zoomIn);
            placeholder.appendChild(zoomWrap);
        }

        const updateBackgroundSize = () => {
            if (!imgPreview) return;
            imgPreview.style.backgroundSize = state.scale ? `${state.scale}%` : 'cover';
            imgPreview.style.backgroundPosition = `${state.pos.x}% ${state.pos.y}%`;
            const slider = placeholder.querySelector('.zoom-slider');
            if (slider) slider.value = String(state.scale);
        };

        const clampScale = (scale) => Math.max(20, Math.min(400, scale));
        const setScale = (scale) => {
            state.scale = clampScale(Math.round(scale));
            updateBackgroundSize();
        };

        if (!placeholder._zoomHandlersAttached) {
            const zoomInButton = placeholder.querySelector('.zoom-in');
            const zoomOutButton = placeholder.querySelector('.zoom-out');
            const slider = placeholder.querySelector('.zoom-slider');
            if (zoomInButton) zoomInButton.addEventListener('click', () => setScale(state.scale + 10));
            if (zoomOutButton) zoomOutButton.addEventListener('click', () => setScale(state.scale - 10));
            if (slider) slider.addEventListener('input', (event) => setScale(Number(event.target.value)));

            const onWheel = (event) => {
                if (!placeholder.classList.contains('move-mode')) return;
                event.preventDefault();
                if (event.deltaY < 0) setScale(state.scale + 8);
                else setScale(state.scale - 8);
            };
            placeholder.addEventListener('wheel', onWheel, { passive: false });
            placeholder._zoomHandlersAttached = true;
        }

        updateBackgroundSize();

        const onPointerDown = (event) => {
            if (!placeholder.classList.contains('move-mode') || !imgPreview) return;
            isPanning = true;
            startX = event.clientX;
            startY = event.clientY;
            const backgroundPosition = (imgPreview.style.backgroundPosition || '50% 50%').split(' ');
            pos.x = parseFloat(backgroundPosition[0]) || 50;
            pos.y = parseFloat(backgroundPosition[1]) || 50;
            event.target.setPointerCapture && event.target.setPointerCapture(event.pointerId);
        };

        const onPointerMove = (event) => {
            if (!isPanning) return;
            event.preventDefault();
            const rect = imgPreview.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            const dxPct = ((event.clientX - startX) / rect.width) * 100;
            const dyPct = ((event.clientY - startY) / rect.height) * 100;
            pos.x = clamp(pos.x + dxPct);
            pos.y = clamp(pos.y + dyPct);
            startX = event.clientX;
            startY = event.clientY;
            updateBackgroundPosition();
        };

        const onPointerUp = (event) => {
            if (!isPanning) return;
            isPanning = false;
            try { event.target.releasePointerCapture && event.target.releasePointerCapture(event.pointerId); } catch (error) {}
        };

        if (!placeholder._moveHandlersAttached) {
            placeholder.addEventListener('pointerdown', onPointerDown);
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            placeholder._moveHandlersAttached = true;
        }
    }

    function resetImageUI(options) {
        const imgInput = options.imgInput;
        const imgPreview = options.imgPreview;

        if (imgPreview) {
            imgPreview.style.backgroundImage = '';
            imgPreview.classList.add('hidden');
        }
        if (imgInput) imgInput.value = '';

        const container = imgInput?.closest('.char-img-placeholder');
        if (!container) return;

        container.classList.remove('has-image');
        const moveButton = container.querySelector('.move-handle');
        if (moveButton) moveButton.remove();
        const zoomControls = container.querySelector('.zoom-controls');
        if (zoomControls) zoomControls.remove();
        container.classList.remove('move-mode');
        const label = container.querySelector('label[for="imgUpload"]');
        if (label) label.style.pointerEvents = '';
        try {
            delete container._imgState;
            container._moveHandlersAttached = false;
            container._zoomHandlersAttached = false;
        } catch (error) {}
    }

    global.CharacterSheetImage = {
        applyImageData,
        bindImageInput,
        ensureMoveUI,
        resetImageUI
    };
})(window);
