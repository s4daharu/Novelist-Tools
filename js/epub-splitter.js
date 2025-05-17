// js/epub-splitter.js
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
                    structure[path] = { 
                        dir: file.dir, 
                        contentType: file.options.contentType 
                    };

                    if (!file.dir && (path.endsWith('.xhtml') || path.endsWith('.html') || 
                                       path.includes('content.opf') || path.includes('toc.ncx'))) {
                        // Fixed: Use arraybuffer + TextDecoder for UTF-8
                        promises.push(
                            file.async('arraybuffer').then(buf => {
                                const decoder = new TextDecoder('utf-8');
                                structure[path].content = decoder.decode(buf);
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
                    
                    if (!info.dir && info.content) {
                        try {
                            // First try XML parser
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(info.content, 'application/xhtml+xml');
                            
                            // Check for parser errors
                            const parserError = doc.querySelector('parsererror');
                            if (parserError) {
                                throw new Error(`XML parse error in ${path}: ${parserError.textContent}`);
                            }

                            // Extract chapters by common selectors
                            const sections = doc.querySelectorAll(
                                'section[epub\\:type="chapter"], div[epub\\:type="chapter"], ' +
                                'section.chapter, div.chapter, section[role="chapter"], div[role="chapter"]'
                            );

                            if (sections.length) {
                                sections.forEach(sec => {
                                    // Remove headings
                                    sec.querySelectorAll('h1,h2,h3,.title,.chapter-title').forEach(el => el.remove());
                                    
                                    // Extract paragraphs
                                    const paras = sec.querySelectorAll('p');
                                    const text = paras.length 
                                        ? Array.from(paras)
                                            .map(p => p.textContent.trim())
                                            .filter(t => t)
                                            .join('\n')
                                        : sec.textContent.replace(/\s*\n\s*/g, '\n').trim();

                                    if (text) chapters.push(text);
                                });
                            } else {
                                // Fallback: Extract by headings
                                const headings = doc.querySelectorAll('h1,h2,h3');
                                if (headings.length > 1) {
                                    for (let i = 0; i < headings.length; i++) {
                                        let node = headings[i].nextSibling;
                                        let content = '';
                                        
                                        while (node && !(node.nodeType === 1 && /H[1-3]/.test(node.tagName))) {
                                            content += node.nodeType === 1 
                                                ? node.textContent + '\n' 
                                                : node.textContent;
                                            node = node.nextSibling;
                                        }
                                        
                                        content = content.replace(/\n{3,}/g, '\n').trim();
                                        if (content) chapters.push(content);
                                    }
                                }
                            }
                        } catch (xmlErr) {
                            console.warn(`Falling back to HTML parser for ${path}:`, xmlErr);
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(info.content, 'text/html');
                            
                            // Try extracting from HTML document
                            const paras = doc.querySelectorAll('p');
                            if (paras.length) {
                                const text = Array.from(paras)
                                    .map(p => p.textContent.trim())
                                    .filter(t => t)
                                    .join('\n');
                                if (text) chapters.push(text);
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
                const effectiveStart = startNumber + offset;
                const zip = new JSZip();
                
                if (mode === 'single') {
                    usableChaps.forEach((text, i) => {
                        const chapNum = String(effectiveStart + i).padStart(2, '0');
                        zip.file(`${pattern}${chapNum}.txt`, text);
                    });
                } else {
                    // Grouped mode
                    let groupSize = parseInt(groupSizeEl.value, 10) || 1;
                    for (let i = 0; i < usableChaps.length; i += groupSize) {
                        const groupStart = effectiveStart + i;
                        const groupEnd = Math.min(
                            effectiveStart + i + groupSize - 1,
                            effectiveStart + usableChaps.length - 1
                        );
                        
                        const name = groupStart === groupEnd
                            ? `${pattern} C${String(groupStart).padStart(2, '0')}.txt`
                            : `${pattern} C${String(groupStart).padStart(2, '0')}-${String(groupEnd).padStart(2, '0')}.txt`;
                        
                        let content = '';
                        for (let j = 0; j < groupSize && (i + j) < usableChaps.length; j++) {
                            if (j > 0) content += '\n---------------- END ----------------\n';
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
