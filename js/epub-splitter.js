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

        toggleAppSpinner(true);
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
                    // Initialize with basic info; content will be populated by the promise
                    structure[path] = { dir: file.dir, contentType: file.options.contentType, content: null };

                    if (!file.dir && (path.endsWith('.xhtml') || path.endsWith('.html') ||
                                        path.includes('content.opf') || path.includes('toc.ncx'))) {
                        promises.push(
                            file.async('uint8array') // Always read as raw bytes first
                                .then(bytes => {
                                    try {
                                        // Explicitly decode as UTF-8
                                        const decoder = new TextDecoder('utf-8', { fatal: false }); // fatal:false to allow replacement chars for truly bad sequences
                                        structure[path].content = decoder.decode(bytes);

                                        // DIAGNOSTIC LOG: Check for the problematic character sequence directly after decoding
                                        if (path.includes("content.xhtml") || path.includes("chapter81")) { // Adjust if your filename is different
                                            if (structure[path].content.includes("Lao’er")) {
                                                console.log(`SUCCESSFUL DECODE for ${path} containing "Lao’er": Partial content:`, structure[path].content.substring(0, 500));
                                            } else if (structure[path].content.includes("Laoâ€™er")) {
                                                console.error(`PROBLEM STILL EXISTS in ${path} *after TextDecoder* for "Laoâ€™er": Partial content:`, structure[path].content.substring(0, 500));
                                            }
                                        }

                                    } catch (decodeError) {
                                        console.error(`UTF-8 Decoding Error for ${path}:`, decodeError);
                                        structure[path].content = `DECODING_ERROR: ${decodeError.message}`; // Store error
                                        showAppToast(`Error decoding file: ${path}`, true);
                                    }
                                })
                                .catch(readError => {
                                    console.error(`Error reading file ${path} as uint8array:`, readError);
                                    structure[path].content = `READ_ERROR: ${readError.message}`; // Store error
                                    showAppToast(`Error reading file from EPUB: ${path}`, true);
                                })
                        );
                    }
                });
                return Promise.all(promises).then(() => structure);
            })
            .then(structure => {
                const chapters = [];
                for (let path in structure) {
                    const info = structure[path];

                    // Check if content is a valid string and not an error marker from the previous step
                    if (info.content && typeof info.content === 'string' && !info.content.startsWith('DECODING_ERROR') && !info.content.startsWith('READ_ERROR')) {
                        if (path.endsWith('.xhtml') || path.endsWith('.html')) { // Only process XHTML/HTML for chapters here
                            const parser = new DOMParser();
                            let doc = parser.parseFromString(info.content, 'application/xml'); // text/xml or application/xhtml+xml
                            
                            const parserError = doc.querySelector('parsererror');
                            if (parserError) {
                                console.warn(`XML parsing error in ${path} (likely XHTML issue), falling back to HTML parser. Error:`, parserError.textContent);
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
                                // Original fallback for heading-based structures
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
                                } else if (doc.body && doc.body.textContent.trim().length > 0 && !sections.length && !(doc.documentElement.namespaceURI === "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul" && doc.documentElement.tagName === "parsererror") ) {
                                    // If no sections and no multiple headings, but body has text, consider it.
                                    // Avoid taking content if it's just a parser error document.
                                    // This part of the heuristic can be risky as it might grab non-chapter files.
                                    // For now, let's keep it close to original but be mindful.
                                    // console.log(`Taking full body content for ${path} as no specific sections/headings found.`);
                                    // chapters.push(doc.body.textContent.replace(/\s*\n\s*/g, '\n').trim());
                                }
                            }
                        }
                    } else if (info.content && (info.content.startsWith('DECODING_ERROR') || info.content.startsWith('READ_ERROR'))) {
                        console.warn(`Skipping DOM parsing for ${path} due to: ${info.content}`);
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
                const effectiveStart = startNumber + offset;

                const zip = new JSZip();

                if (mode === 'single') {
                    usableChaps.forEach((text, i) => {
                        const chapNum = String(effectiveStart + i).padStart(2, '0');
                        zip.file(`${pattern}${chapNum}.txt`, text);
                    });
                } else { // grouped
                    let groupSize = parseInt(groupSizeEl.value, 10) || 1;
                    if (groupSize < 1) groupSize = 1;
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
                    downloadLink.download = `${chapterPatternEl.value || 'chapter'}_chapters.zip`;
                }
                if (downloadSec) downloadSec.style.display = 'block';
                if (statusEl) {
                    statusEl.textContent = `Extracted ${count} chapters (skipped ${skipped})`;
                    statusEl.className = 'status success';
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
                toggleAppSpinner(false);
            });
    });
}
