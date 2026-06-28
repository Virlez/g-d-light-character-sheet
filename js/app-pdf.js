(function (global) {
    const EXPORT_LAYOUT_WIDTH = 1440;

    function wait(milliseconds) {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    function clearPdfExportPreviewClone() {
        try {
            const existing = document.getElementById('pdfExportSnapshotRoot');
            if (existing) existing.remove();
        } catch (error) {}
    }

    function syncCloneSelectValues(target, clone) {
        try {
            const originalSelects = target.querySelectorAll('select');
            const cloneSelects = clone.querySelectorAll('select');
            const count = Math.min(originalSelects.length, cloneSelects.length);
            for (let index = 0; index < count; index += 1) {
                cloneSelects[index].value = originalSelects[index].value;
            }
            clone.querySelectorAll('.char-img-placeholder.move-mode').forEach((element) => element.classList.remove('move-mode'));
        } catch (error) {}
    }

    function applyCloneLayout(target, clone) {
        clone.style.background = global.getComputedStyle(target).backgroundColor || '#001111';
        clone.style.boxSizing = 'border-box';
        clone.style.padding = global.getComputedStyle(target).padding || '12px';
        clone.style.width = `${EXPORT_LAYOUT_WIDTH}px`;
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

            clone.querySelectorAll('.md\\:grid-cols-2').forEach((element) => {
                element.style.display = 'grid';
                element.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
            });

            clone.querySelectorAll('.md\\:grid-cols-4').forEach((element) => {
                element.style.display = 'grid';
                element.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
            });

            clone.querySelectorAll('.weapons-headers, .weapon-item').forEach((element) => {
                element.style.display = 'grid';
                element.style.gridTemplateColumns = 'repeat(5, minmax(0, 1fr))';
                element.style.gap = '8px';
            });

            const inventoryRow = clone.querySelector('#inventory_row');
            if (inventoryRow) {
                inventoryRow.style.display = 'grid';
                inventoryRow.style.gridTemplateColumns = inventoryRow.classList.contains('inventory--checkbox-hidden')
                    ? 'repeat(4, minmax(0, 1fr))'
                    : 'repeat(5, minmax(0, 1fr))';
            }
        } catch (error) {}
    }

    function createTextReplacement(element, text) {
        const replacement = document.createElement('div');
        replacement.textContent = text;
        replacement.style.background = '#00141a';
        replacement.style.color = '#00f0ff';
        replacement.style.padding = '6px 8px';
        replacement.style.border = '1px solid rgba(0,240,255,0.12)';
        replacement.style.fontWeight = '700';
        replacement.style.fontFamily = global.getComputedStyle(element).fontFamily || 'Rajdhani, sans-serif';
        const baseFont = parseFloat(global.getComputedStyle(element).fontSize) || 16;
        replacement.style.fontSize = `${baseFont >= 16 ? baseFont : 14}px`;
        replacement.style.lineHeight = '1.1';
        replacement.style.minHeight = `${element.offsetHeight || 20}px`;
        replacement.style.boxSizing = 'border-box';
        replacement.style.display = 'inline-block';
        replacement.style.verticalAlign = 'middle';

        try {
            if (element.classList && element.classList.contains('attr-bonus-input')) {
                replacement.style.minWidth = '46px';
                replacement.style.padding = '4px 6px';
                replacement.style.textAlign = 'center';
                replacement.style.fontSize = `${Math.max(12, baseFont - 2)}px`;
            } else if (element.classList && element.classList.contains('weapon-total')) {
                replacement.style.minWidth = '56px';
                replacement.style.padding = '4px 6px';
                replacement.style.textAlign = 'right';
            } else if (element.tagName && element.tagName.toLowerCase() === 'textarea') {
                replacement.style.display = 'block';
                replacement.style.whiteSpace = 'pre-wrap';
                replacement.style.padding = '8px';
            }
        } catch (error) {}

        return replacement;
    }

    function replaceCloneFormControls(clone) {
        clone.querySelectorAll('input, textarea, select').forEach((element) => {
            try {
                let value = '';
                if (element.tagName.toLowerCase() === 'select') {
                    value = element.options && element.selectedIndex >= 0 ? element.options[element.selectedIndex].text : element.value || '';
                } else if (element.type === 'checkbox' || element.type === 'radio') {
                    value = element.checked ? '✔' : '';
                } else {
                    value = element.value || '';
                }

                const replacement = createTextReplacement(element, value);
                element.parentNode && element.parentNode.replaceChild(replacement, element);
            } catch (error) {}
        });

        clone.querySelectorAll('.attr-bonus-label').forEach((label) => {
            label.style.color = '#00f0ff';
            label.style.fontWeight = '800';
            label.style.fontSize = '12px';
            label.style.letterSpacing = '0.06em';
            label.style.display = 'block';
            label.style.marginBottom = '4px';
        });
    }

    function finalizeCloneAppearance(clone, preserveClone) {
        clone.querySelectorAll('.section-box').forEach((section) => {
            section.style.clipPath = 'none';
            section.style.borderRadius = '0';
        });

        clone.style.padding = '12px 14px';
        clone.style.margin = '0';
        clone.style.boxSizing = 'border-box';
        clone.style.overflow = 'hidden';

        try {
            clone.querySelectorAll('p').forEach((paragraph) => {
                const text = (paragraph.textContent || '').trim();
                if (text.startsWith('©') || text.toLowerCase().includes('©')) paragraph.style.display = 'none';
            });
        } catch (error) {}

        clone.style.position = 'fixed';
        clone.style.left = preserveClone ? '0' : '-10000px';
        clone.style.top = '0';
        clone.style.zIndex = '99999';
        clone.style.pointerEvents = 'none';
    }

    function buildCanvasOptions(clone) {
        return {
            scale: Math.min(3, (global.devicePixelRatio || 1) * 1.3),
            useCORS: true,
            logging: false,
            backgroundColor: null,
            width: Math.ceil(clone.scrollWidth),
            height: Math.ceil(clone.scrollHeight),
            scrollX: 0,
            scrollY: 0,
            windowWidth: EXPORT_LAYOUT_WIDTH,
            windowHeight: Math.max(1600, Math.ceil(clone.scrollHeight))
        };
    }

    function updatePdfExportMeta(clone, options, preserveClone) {
        try {
            global.__lastPdfExportMeta = {
                forcedDesktopLayout: true,
                sourceViewportWidth: global.innerWidth,
                renderWidth: Math.ceil(clone.scrollWidth),
                renderHeight: Math.ceil(clone.scrollHeight),
                renderWindowWidth: options.windowWidth,
                renderWindowHeight: options.windowHeight,
                previewCloneVisible: preserveClone
            };
        } catch (error) {}
    }

    async function buildPdfExportClone(options = {}) {
        const preserveClone = !!options.preserveClone;
        const target = document.getElementById('sheetRoot') || document.body;

        clearPdfExportPreviewClone();

        const hidden = [];
        document.querySelectorAll('.no-print, .scanline, .move-handle, .zoom-controls').forEach((element) => {
            hidden.push({ element, visibility: element.style.visibility });
            element.style.visibility = 'hidden';
        });

        await wait(50);

        const clone = target.cloneNode(true);
        clone.id = 'pdfExportSnapshotRoot';
        clone.setAttribute('data-testid', 'pdf-export-preview');

        syncCloneSelectValues(target, clone);
        applyCloneLayout(target, clone);
        replaceCloneFormControls(clone);
        finalizeCloneAppearance(clone, preserveClone);

        document.body.appendChild(clone);

        hidden.forEach((item) => {
            item.element.style.visibility = item.visibility || '';
        });

        await wait(40);

        const canvasOptions = buildCanvasOptions(clone);
        updatePdfExportMeta(clone, canvasOptions, preserveClone);

        return {
            target,
            clone,
            opts: canvasOptions,
            cleanup() {
                if (!preserveClone && clone && clone.parentNode) clone.remove();
            }
        };
    }

    function parseRgbColor(value) {
        const match = String(value).match(/rgba?\(([^)]+)\)/);
        if (!match) return null;
        return match[1].split(',').map((part) => Number(part.trim()));
    }

    function cropTrailingBackground(canvas, backgroundValue) {
        let nextCanvas = canvas;

        try {
            const context = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;
            const image = context.getImageData(0, 0, width, height);
            const data = image.data;
            let background = parseRgbColor(backgroundValue);

            if (!background) {
                background = [data[0], data[1], data[2]];
            }

            const tolerance = 8;
            let lastNonBackgroundRow = -1;
            for (let y = height - 1; y >= 0; y -= 1) {
                let rowHasContent = false;
                const stride = Math.max(1, Math.floor(width / 120));
                for (let x = 0; x < width; x += stride) {
                    const index = (y * width + x) * 4;
                    const red = data[index];
                    const green = data[index + 1];
                    const blue = data[index + 2];
                    const alpha = data[index + 3];
                    if (alpha === 0) {
                        rowHasContent = true;
                        break;
                    }
                    if (
                        Math.abs(red - background[0]) > tolerance ||
                        Math.abs(green - background[1]) > tolerance ||
                        Math.abs(blue - background[2]) > tolerance
                    ) {
                        rowHasContent = true;
                        break;
                    }
                }
                if (rowHasContent) {
                    lastNonBackgroundRow = y;
                    break;
                }
            }

            if (lastNonBackgroundRow >= 0 && lastNonBackgroundRow < height - 1) {
                const croppedCanvas = document.createElement('canvas');
                const nextHeight = lastNonBackgroundRow + 1;
                croppedCanvas.width = width;
                croppedCanvas.height = nextHeight;
                const croppedContext = croppedCanvas.getContext('2d');
                croppedContext.drawImage(canvas, 0, 0, width, nextHeight, 0, 0, width, nextHeight);
                nextCanvas = croppedCanvas;
            }
        } catch (error) {
            console.warn('Canvas cropping failed, using full canvas', error);
        }

        return nextCanvas;
    }

    function addCanvasToPdf(pdf, canvas, imageData) {
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imageProperties = pdf.getImageProperties(imageData);
        const imageWidthMm = pageWidth;
        const imageHeightMm = (imageProperties.height * imageWidthMm) / imageProperties.width;

        if (imageHeightMm <= pageHeight) {
            pdf.addImage(imageData, 'JPEG', 0, 0, imageWidthMm, imageHeightMm);
            return;
        }

        const pixelsPerMm = imageProperties.width / imageWidthMm;
        const canvasPageHeight = Math.floor(pageHeight * pixelsPerMm);
        let remainingHeight = canvas.height;
        let sourceY = 0;
        let firstPage = true;

        while (remainingHeight > 0) {
            const sliceHeight = Math.min(canvasPageHeight, remainingHeight);
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = sliceHeight;
            const pageContext = pageCanvas.getContext('2d');
            pageContext.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

            const pageData = pageCanvas.toDataURL('image/jpeg', 0.95);
            const pageProperties = pdf.getImageProperties(pageData);
            const pageImageHeightMm = (pageProperties.height * imageWidthMm) / pageProperties.width;

            if (!firstPage) pdf.addPage();
            pdf.addImage(pageData, 'JPEG', 0, 0, imageWidthMm, pageImageHeightMm);

            remainingHeight -= sliceHeight;
            sourceY += sliceHeight;
            firstPage = false;
        }
    }

    async function preparePdfExportPreviewForTests() {
        await buildPdfExportClone({ preserveClone: true });
        return global.__lastPdfExportMeta;
    }

    async function exportScreenshotPDF() {
        const button = document.getElementById('screenshotPdfBtn');
        try {
            if (button) {
                button.disabled = true;
                button.textContent = 'Génération...';
            }

            const { target, clone, opts, cleanup } = await buildPdfExportClone();
            let canvas = await global.html2canvas(clone, opts);
            const cloneBackground = clone.style.background || global.getComputedStyle(target).backgroundColor || '';
            cleanup();

            canvas = cropTrailingBackground(canvas, cloneBackground);

            const imageData = canvas.toDataURL('image/jpeg', 0.95);
            const pdf = new global.jspdf.jsPDF('p', 'mm', 'a4');
            addCanvasToPdf(pdf, canvas, imageData);

            const fileName = `Fiche ${document.getElementById('char_name')?.value || 'fiche'}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error(error);
            alert('Erreur lors de la génération du PDF.');
        } finally {
            if (button) {
                button.disabled = false;
                button.title = 'Exporter en PDF';
                button.setAttribute('aria-label', 'Exporter en PDF');
                button.innerHTML = '<span>PDF</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m8 9 4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
            }
        }
    }

    async function exportScreenshotJPEG() {
        const button = document.getElementById('screenshotJpegBtn');
        try {
            if (button) {
                button.disabled = true;
                button.textContent = 'Génération...';
            }

            const { target, clone, opts, cleanup } = await buildPdfExportClone();
            let canvas = await global.html2canvas(clone, opts);
            const cloneBackground = clone.style.background || global.getComputedStyle(target).backgroundColor || '';
            cleanup();

            canvas = cropTrailingBackground(canvas, cloneBackground);

            const imageData = canvas.toDataURL('image/jpeg', 0.95);
            const charName = document.getElementById('char_name')?.value || 'fiche';
            const fileName = `Fiche ${charName}.jpeg`;

            const link = document.createElement('a');
            link.href = imageData;
            link.download = fileName;
            link.click();
        } catch (error) {
            console.error(error);
            alert('Erreur lors de la génération du JPEG.');
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = '&#x1F5BC;';
            }
        }
    }

    global.CharacterSheetPdf = {
        clearPdfExportPreviewClone,
        buildPdfExportClone,
        preparePdfExportPreviewForTests,
        exportScreenshotPDF,
        exportScreenshotJPEG
    };
})(window);
