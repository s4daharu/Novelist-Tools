/* ==== START 3/10 - epub-splitter.js (Novelist-Tools-main/js/epub-splitter.js) ==== */
// js/epub-splitter.js

// Helper function (can be kept local or moved to a utils.js if used elsewhere)
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

export function initializeEpubSplitter(showAppToast, toggleAppSpinner) {
    const uploadInput = document.getElementById('epubUpload');
    const fileNameEl = document.getElementById('epubFileName');
    const splitBtn = document.getElementById('splitBtn');
    const modeSelect = document.getElementById('modeSelect');
    const groupSizeGrp = document.getElementById('groupSizeGroup');
    // const spinnerSpl = document.getElementById('spinnerSplitter'); // Spinner handled by toggleAppSpinner
    const statusEl = document.getElementById('statusMessage');
    const downloadSec = document.querySelector('#splitterApp .download-section');
    const downloadLink = document.getElementById('downloadLink');
    let selectedFile = null;

    if (!uploadInput || !splitBtn) {
        console.error("EPUB Splitter UI elements not found. Initialization failed.");
        return;
    }

    uploadInput.addEventListener('change', e => {
        selectedFile = e.target.files[0];
        if (selectedFile) {
            fileNameEl.textContent = `Selected: ${selectedFile.name}`;
            splitBtn.disabled = false;
            if (statusEl) statusEl.style.display = 'none';
            if (downloadSec) downloadSec.style.display = 'none';
        }
    });

    modeSelect.addEventListener('change', () => {
        if (groupSizeGrp) {
            groupSizeGrp.style.display = modeSelect.value === 'grouped' ? 'block' : 'none';
        }
    });

    splitBtn.addEventListener('click', () => {
        if (!selectedFile) {
            showAppToast("No file selected for EPUB splitting.", true);
            return;
        }

        toggleAppSpinner(true); // Show spinner
        if (statusEl) statusEl.style.display = 'none';
        if (downloadSec) downloadSec.style.display = 'none';

        const chapterPatternEl = document.getElementById('chapterPattern');
        const startNumberEl = document.getElementById('startNumber');
        const offsetNumberEl = document.getElementById('offsetNumber');
        const groupSizeEl = document.getElementById('groupSize');

        readFileAsArrayBuffer(selectedFile)
            .then(buffer => JSZip.loadAsync(buffer))
            .then(epub => {
                const structure = {};
                const promises = [];
                epub.forEach((path, file) => {
                    structure[path] = { dir: file.dir, contentType: file.options.contentType, content: null }; // Initialize content
                    if (!file.dir && (path.toLowerCase().endsWith('.xhtml') || path.toLowerCase().endsWith('.html') ||
                                        path.toLowerCase().includes('content.opf') || path.toLowerCase().includes('toc.ncx'))) {
                        // MODIFICATION START: Read as uint8array and decode as UTF-8
                        promises.push(
                            file.async('uint8array').then(bytes => {
                                try {
                                    const decoder = new TextDecoder('utf-8', { fatal: false }); // fatal:false will insert � for errors
                                    structure[path].content = decoder.decode(bytes);
                                } catch (e) {
                                    console.error(`Error decoding file ${path} as UTF-8:`, e);
                                    structure[path].content = ""; // Fallback to empty string if decoding fails
                                    showAppToast(`Warning: Could not decode '${path}'. It may be corrupted or not UTF-8.`, true);
                                }
                            }).catch(err => {
                                console.error(`Error reading file ${path} as uint8array:`, err);
                                structure[path].content = ""; // Fallback
                                showAppToast(`Error reading file '${path}' from EPUB.`, true);
                            })
                        );
                        // MODIFICATION END
                    }
                });
                return Promise.all(promises).then(() => structure);
            })
            .then(structure => {
                const chapters = [];
                for (let path in structure) {
                    const info = structure[path];
                    // Ensure content is not null and is a string before proceeding
                    if (!info.dir && typeof info.content === 'string' && info.content.length > 0) {
                         // Only process .xhtml and .html files for chapter content here
                        if (path.toLowerCase().endsWith('.xhtml') || path.toLowerCase().endsWith('.html')) {
                            const parser = new DOMParser();
                            let doc = parser.parseFromString(info.content, 'text/xml'); // Try as XML (XHTML) first
                            if (doc.querySelector('parsererror')) { // If XML parsing fails, try as HTML
                                doc = parser.parseFromString(info.content, 'text/html');
                            }
                            const sections = doc.querySelectorAll(
                                'section[epub\\:type="chapter"], div[epub\\:type="chapter"], ' +
                                'section.chapter, div.chapter, section[role="chapter"], div[role="chapter"]'
                            );
                            if (sections.length) {
                                sections.forEach(sec => {
                                    sec.querySelectorAll('h1,h2,h3,.title,.chapter-title').forEach(el => el.remove());
                                    const paras = sec.querySelectorAll('p');
                                    const text = paras.length ?
                                        Array.from(paras).map(p => p.textContent.trim()).filter(t => t).join('\n') :
                                        sec.textContent.replace(/\s*\n\s*/g, '\n').trim();
                                    if (text) chapters.push(text);
                                });
                            } else {
                                const headings = doc.querySelectorAll('h1,h2,h3');
                                if (headings.length > 1) {
                                    for (let i = 0; i < headings.length; i++) {
                                        let node = headings[i].nextSibling, content = '';
                                        while (node && !(node.nodeType === 1 && /H[1-3]/.test(node.tagName))) {
                                            content += node.nodeType === 1 ? node.textContent + '\n' : node.textContent;
                                            node = node.nextSibling;
                                        }
                                        content = content.replace(/\n{3,}/g, '\n').trim();
                                        if (content) chapters.push(content);
                                    }
                                }
                            }
                        }
                    }
                }
                return chapters;
            })
            .then(chapters => {
                if (!chapters.length) throw new Error('No chapters found. Check EPUB structure.');

                const pattern = chapterPatternEl.value.trim() || 'chapter';
                const startNumber = parseInt(startNumberEl.value, 10) || 1;
                const offset = Math.max(0, parseInt(offsetNumberEl.value, 10) || 0);
                const mode = modeSelect.value;

                const usableChaps = chapters.slice(offset);
                const effectiveStart = startNumber + offset; // Original logic for effectiveStart

                const zip = new JSZip();

                if (mode === 'single') {
                    usableChaps.forEach((text, i) => {
                        const chapNum = String(effectiveStart + i).padStart(2, '0');
                        zip.file(`${pattern}${chapNum}.txt`, text);
                    });
                } else { // grouped
                    let groupSize = parseInt(groupSizeEl.value, 10) || 1;
                    if (groupSize < 1) groupSize = 1; // Ensure group size is at least 1

                    for (let i = 0; i < usableChaps.length; i += groupSize) {
                        const groupStart = effectiveStart + i;
                        const groupEnd = Math.min(
                            effectiveStart + i + groupSize - 1,
                            effectiveStart + usableChaps.length - 1
                        );
                        const name = groupStart === groupEnd ?
                            `${pattern} C${String(groupStart).padStart(2, '0')}.txt` :
                            `${pattern} C${String(groupStart).padStart(2, '0')}-${String(groupEnd).padStart(2, '0')}.txt`;

                        let content = '';
                        for (let j = 0; j < groupSize && (i + j) < usableChaps.length; j++) {
                            if (j > 0) content += '\n\n\n---------------- END ----------------\n\n\n';
                            content += usableChaps[i + j];
                        }
                        zip.file(name, content);
                    }
                }
                return zip.generateAsync({ type: 'blob' })
                    .then(blob => ({ blob, count: usableChaps.length, skipped: offset }));
            })
            .then(({ blob, count, skipped }) => {
                if (downloadLink) {
                    downloadLink.href = URL.createObjectURL(blob);
                    downloadLink.download = `${(chapterPatternEl.value || 'chapter').replace(/[^\w\s-]/g, '')}_chapters.zip`;
                }
                if (downloadSec) downloadSec.style.display = 'block';
                if (statusEl) {
                    statusEl.textContent = `Extracted ${count} chapters (skipped ${skipped})`;
                    statusEl.className = 'status success'; // Assuming you have CSS for .success / .error
                    statusEl.style.display = 'block';
                }
                showAppToast(`Extracted ${count} chapters (skipped ${skipped})`);
            })
            .catch(err => {
                console.error("EPUB Splitter Error:", err);
                if (statusEl) {
                    statusEl.textContent = `Error: ${err.message}`;
                    statusEl.className = 'status error';
                    statusEl.style.display = 'block';
                }
                showAppToast(`Error: ${err.message}`, true);
            })
            .finally(() => {
                toggleAppSpinner(false); // Hide spinner
            });
    });
}
/* ==== END - epub-splitter.js ==== */
