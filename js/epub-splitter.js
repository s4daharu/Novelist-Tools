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
                        if (path.toLowerCase().endsWith('.xhtml') || path.toLowerCase().endsWith('.html')) {
                            const parser = new DOMParser();
                            let doc;
                            // Try parsing as XML (XHTML) first
                            doc = parser.parseFromString(info.content, 'application/xml');
                            const parserError = doc.querySelector('parsererror');
                            if (parserError) {
                                console.warn(`XML parsing error in ${path}, falling back to HTML parser:`, parserError.textContent);
                                // Fallback to HTML parser if XML parsing fails (common for malformed XHTML)
                                doc = parser.parseFromString(info.content, 'text/html');
                            }

                            if (!doc) {
                                console.warn(`Could not parse ${path}. Skipping.`);
                                continue;
                            }

                            // Attempt to find chapter-like sections
                            // Prioritize epub:type attributes as they are more semantic
                            let sections = doc.querySelectorAll(
                                'section[epub\\:type="chapter"], div[epub\\:type="chapter"], ' +
                                'article[epub\\:type="chapter"]' // Added article
                            );

                            if (!sections.length) {
                                // Fallback to common class names or general structure if no epub:type
                                sections = doc.querySelectorAll(
                                    'section.chapter, div.chapter, article.chapter, ' + // Common class names
                                    'section[role="doc-chapter"], div[role="doc-chapter"], article[role="doc-chapter"]' // ARIA roles
                                );
                            }

                            if (sections.length) {
                                sections.forEach(sec => {
                                    // Clone the section to avoid modifying the original DOM during iteration
                                    const tempSec = sec.cloneNode(true);
                                    // Remove known heading elements to avoid them being duplicated in text content
                                    tempSec.querySelectorAll('h1,h2,h3,h4,h5,h6,.title,.chapter-title').forEach(el => el.remove());

                                    // Extract text, trying to preserve some structure by joining paragraphs
                                    const paragraphs = tempSec.querySelectorAll('p');
                                    let textContent;
                                    if (paragraphs.length > 0) {
                                        textContent = Array.from(paragraphs)
                                            .map(p => p.textContent.trim())
                                            .filter(t => t) // Remove empty paragraphs
                                            .join('\n\n'); // Join paragraphs with double newline
                                    } else {
                                        // Fallback for sections without <p> tags
                                        textContent = tempSec.textContent.replace(/\s*\n\s*/g, '\n').trim();
                                    }
                                    if (textContent) chapters.push(textContent);
                                });
                            } else if (path.toLowerCase().endsWith('.xhtml') || path.toLowerCase().endsWith('.html')) {
                                // More generic fallback if no sections are found: look for body content or headings.
                                // This is less reliable for "chapters" but might grab content.
                                const body = doc.body;
                                if (body) {
                                    // Try extracting from headings if multiple are present (indicative of structure)
                                    const headings = body.querySelectorAll('h1, h2, h3, h4'); // Common heading levels
                                    if (headings.length > 1) {
                                        for (let i = 0; i < headings.length; i++) {
                                            let node = headings[i].nextSibling;
                                            let contentBetweenHeadings = '';
                                            while (node && !(node.nodeType === 1 && /H[1-4]/.test(node.tagName.toUpperCase()))) {
                                                if (node.textContent) {
                                                    contentBetweenHeadings += node.textContent + '\n';
                                                }
                                                node = node.nextSibling;
                                            }
                                            contentBetweenHeadings = contentBetweenHeadings.replace(/\n{2,}/g, '\n').trim(); // Normalize newlines
                                            if (contentBetweenHeadings) chapters.push(contentBetweenHeadings);
                                        }
                                    } else if (body.textContent.trim()) {
                                        // If no clear structure, take the whole body text of the file, cleaned up.
                                        // This might grab non-chapter files if they are XHTML/HTML.
                                        // A more sophisticated filter might be needed based on manifest item properties.
                                        let fullBodyText = body.textContent.replace(/\s*\n\s*/g, '\n').trim();
                                        if (fullBodyText) chapters.push(fullBodyText);
                                    }
                                }
                            }
                        }
                    }
                }
                return chapters;
            })
            .then(chapters => {
                if (!chapters.length) throw new Error('No chapters found. Check EPUB structure or content parsing logic.');

                const pattern = (document.getElementById('chapterPattern').value.trim() || 'chapter').replace(/[^\w\s-]/g, ''); // Sanitize pattern
                const startNumber = parseInt(document.getElementById('startNumber').value, 10) || 1;
                const offset = Math.max(0, parseInt(document.getElementById('offsetNumber').value, 10) || 0);
                const mode = document.getElementById('modeSelect').value;

                const usableChaps = chapters.slice(offset);
                if (usableChaps.length === 0 && chapters.length > 0) {
                    throw new Error(`Offset (${offset}) is too large, no chapters remaining to process (total found: ${chapters.length}).`);
                }
                const effectiveStart = startNumber; // Start numbering from user input, not affected by offset visually

                const zip = new JSZip();

                if (mode === 'single') {
                    usableChaps.forEach((text, i) => {
                        const chapNum = String(effectiveStart + i).padStart(3, '0'); // Pad to 3 digits for better sorting
                        zip.file(`${pattern}_${chapNum}.txt`, text);
                    });
                } else { // grouped
                    let groupSize = parseInt(document.getElementById('groupSize').value, 10) || 1;
                    if (groupSize < 1) groupSize = 1;

                    for (let i = 0; i < usableChaps.length; i += groupSize) {
                        const groupStartNum = effectiveStart + i;
                        const groupEndNum = Math.min(
                            effectiveStart + i + groupSize - 1,
                            effectiveStart + usableChaps.length - 1
                        );
                        const groupFileName = groupStartNum === groupEndNum ?
                            `${pattern}_C${String(groupStartNum).padStart(3, '0')}.txt` :
                            `${pattern}_C${String(groupStartNum).padStart(3, '0')}-C${String(groupEndNum).padStart(3, '0')}.txt`;

                        let content = '';
                        for (let j = 0; j < groupSize && (i + j) < usableChaps.length; j++) {
                            if (j > 0) content += '\n\n\n<!-- ebook_divider -->\n\n\n'; // Clearer divider
                            content += usableChaps[i + j];
                        }
                        zip.file(groupFileName, content);
                    }
                }
                return zip.generateAsync({ type: 'blob' })
                    .then(blob => ({ blob, count: usableChaps.length, skipped: offset, originalFound: chapters.length }));
            })
            .then(({ blob, count, skipped, originalFound }) => {
                if (downloadLink) {
                    downloadLink.href = URL.createObjectURL(blob);
                    const safePattern = (document.getElementById('chapterPattern').value.trim() || 'chapters').replace(/[^\w\s-]/g, '');
                    downloadLink.download = `${safePattern}_split.zip`;
                }
                if (downloadSec) downloadSec.style.display = 'block';
                if (statusEl) {
                    statusEl.textContent = `Extracted ${count} chapter(s) (skipped ${skipped} from ${originalFound} potential content blocks).`;
                    statusEl.className = 'status success'; // Assuming you have CSS for .success / .error
                    statusEl.style.display = 'block';
                }
                showAppToast(`Extracted ${count} chapter(s).`);
            })
            .catch(err => {
                console.error("EPUB Splitter Error:", err);
                if (statusEl) {
                    statusEl.textContent = `Error: ${err.message}`;
                    statusEl.className = 'status error';
                    statusEl.style.display = 'block';
                }
                showAppToast(`Splitter Error: ${err.message}`, true);
            })
            .finally(() => {
                toggleAppSpinner(false); // Hide spinner
            });
    });
}
/* ==== END - epub-splitter.js ==== */
