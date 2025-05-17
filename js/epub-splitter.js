// js/epub-splitter.js

import JSZip from 'jszip';

/**
 * Reads a File object as an ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload    = () => resolve(reader.result);
    reader.onerror   = () => reject(new Error('Failed to read file as ArrayBuffer'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Initializes the EPUB splitter UI.
 *
 * @param {Function} showAppToast       - function(msg: string, isError?: boolean)
 * @param {Function} toggleAppSpinner   - function(isVisible: boolean)
 */
export function initializeEpubSplitter(showAppToast, toggleAppSpinner) {
  const uploadInput   = document.getElementById('epubUpload');
  const fileNameEl    = document.getElementById('epubFileName');
  const splitBtn      = document.getElementById('splitBtn');
  const modeSelect    = document.getElementById('modeSelect');
  const groupSizeGrp  = document.getElementById('groupSizeGroup');
  const statusEl      = document.getElementById('statusMessage');
  const downloadSec   = document.querySelector('#splitterApp .download-section');
  const downloadLink  = document.getElementById('downloadLink');
  let selectedFile    = null;

  if (!uploadInput || !splitBtn) {
    console.error("EPUB Splitter UI elements not found. Initialization failed.");
    return;
  }

  // 📁 File selection
  uploadInput.addEventListener('change', e => {
    selectedFile = e.target.files[0] || null;
    fileNameEl.textContent = selectedFile 
      ? `Selected: ${selectedFile.name}` 
      : 'No file selected';
    splitBtn.disabled = !selectedFile;
    if (statusEl)      statusEl.style.display = 'none';
    if (downloadSec)   downloadSec.style.display = 'none';
  });

  // 🔀 Toggle grouping options
  modeSelect.addEventListener('change', () => {
    if (groupSizeGrp) {
      groupSizeGrp.style.display = modeSelect.value === 'grouped' ? 'block' : 'none';
    }
  });

  // 🔪 Split action
  splitBtn.addEventListener('click', () => {
    if (!selectedFile) {
      showAppToast("Please select an EPUB file first.", true);
      return;
    }

    toggleAppSpinner(true);
    if (statusEl)    { statusEl.style.display = 'none'; }
    if (downloadSec) { downloadSec.style.display = 'none'; }

    // Gather user options
    const chapterPatternEl = document.getElementById('chapterPattern');
    const startNumberEl    = document.getElementById('startNumber');
    const offsetNumberEl   = document.getElementById('offsetNumber');
    const groupSizeEl      = document.getElementById('groupSize');

    // 1️⃣ Read EPUB ZIP
    readFileAsArrayBuffer(selectedFile)
      .then(buffer => JSZip.loadAsync(buffer))

      // 2️⃣ Extract only the relevant XML/HTML files, **decoding UTF-8 explicitly**
      .then(epub => {
        if (statusEl) {
          statusEl.textContent = 'Extracting EPUB contents…';
          statusEl.className   = 'status info';
          statusEl.style.display = 'block';
        }

        const structure = {};
        const promises  = [];

        epub.forEach((path, file) => {
          structure[path] = { dir: file.dir, contentType: file.options.contentType };
          if (!file.dir && (
               path.endsWith('.xhtml') || 
               path.endsWith('.html')  ||
               path.includes('content.opf') ||
               path.includes('toc.ncx')
             )) {
            // => replace text() with arraybuffer + TextDecoder
            promises.push(
              file.async('arraybuffer')
                .then(buffer2 => {
                  const text = new TextDecoder('utf-8').decode(buffer2);
                  structure[path].content = text;
                })
            );
          }
        });

        return Promise.all(promises).then(() => structure);
      })

      // 3️⃣ Parse out chapters as text blocks
      .then(structure => {
        const chapters = [];
        for (const path in structure) {
          const info = structure[path];
          if (!info.dir && info.content) {
            const parser = new DOMParser();
            let doc = parser.parseFromString(info.content, 'application/xhtml+xml');
            if (doc.querySelector('parsererror')) {
              doc = parser.parseFromString(info.content, 'text/html');
            }

            // look for explicit chapter containers
            const sections = doc.querySelectorAll(
              'section[epub\\:type="chapter"], div[epub\\:type="chapter"], ' +
              'section.chapter, div.chapter, section[role="chapter"], div[role="chapter"]'
            );
            if (sections.length) {
              sections.forEach(sec => {
                // strip headings inside
                sec.querySelectorAll('h1,h2,h3,.title,.chapter-title').forEach(el => el.remove());
                const paras = sec.querySelectorAll('p');
                const text = paras.length
                  ? Array.from(paras).map(p => p.textContent.trim()).filter(t => t).join('\n')
                  : sec.textContent.replace(/\s*\n\s*/g, '\n').trim();
                if (text) chapters.push(text);
              });
            } else {
              // fallback: split by top-level headings
              const heads = doc.querySelectorAll('h1,h2,h3');
              if (heads.length > 1) {
                for (let i = 0; i < heads.length; i++) {
                  let node = heads[i].nextSibling, content = '';
                  while (node && !(node.nodeType === 1 && /^H[1-3]$/.test(node.tagName))) {
                    content += node.textContent || '';
                    node = node.nextSibling;
                  }
                  content = content.replace(/\n{3,}/g, '\n').trim();
                  if (content) chapters.push(content);
                }
              }
            }
          }
        }
        return chapters;
      })

      // 4️⃣ Package into ZIP according to user’s mode/options
      .then(chapters => {
        if (!chapters.length) {
          throw new Error('No chapters found. Check EPUB structure.');
        }

        const pattern     = chapterPatternEl.value.trim() || 'chapter';
        const startNumber = parseInt(startNumberEl.value, 10) || 1;
        const offset      = Math.max(0, parseInt(offsetNumberEl.value, 10) || 0);
        const mode        = modeSelect.value;
        const usableChaps = chapters.slice(offset);
        const effectiveStart = startNumber + offset;
        const zip = new JSZip();

        if (mode === 'single') {
          usableChaps.forEach((text, i) => {
            const num = String(effectiveStart + i).padStart(2, '0');
            zip.file(`${pattern}${num}.txt`, text);
          });
        } else {
          let groupSize = parseInt(groupSizeEl.value, 10) || 1;
          for (let i = 0; i < usableChaps.length; i += groupSize) {
            const groupStart = effectiveStart + i;
            const groupEnd   = Math.min(effectiveStart + i + groupSize - 1, effectiveStart + usableChaps.length - 1);
            const name = groupStart === groupEnd
              ? `${pattern} C${String(groupStart).padStart(2, '0')}.txt`
              : `${pattern} C${String(groupStart).padStart(2, '0')}-${String(groupEnd).padStart(2, '0')}.txt`;

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

      // 5️⃣ Deliver download link & status
      .then(({ blob, count, skipped }) => {
        if (downloadLink) {
          downloadLink.href     = URL.createObjectURL(blob);
          downloadLink.download = `${chapterPatternEl.value || 'chapter'}_chapters.zip`;
        }
        if (downloadSec) downloadSec.style.display = 'block';
        if (statusEl) {
          statusEl.textContent = `Extracted ${count} chapters (skipped ${skipped})`;
          statusEl.className   = 'status success';
          statusEl.style.display = 'block';
        }
        showAppToast(`Extracted ${count} chapters (skipped ${skipped})`);
      })

      // ❗️ Error handling
      .catch(err => {
        console.error("EPUB Splitter Error:", err);
        if (statusEl) {
          statusEl.textContent = `Error: ${err.message}`;
          statusEl.className   = 'status error';
          statusEl.style.display = 'block';
        }
        showAppToast(`Error: ${err.message}`, true);
      })

      // 🚦 Cleanup spinner
      .finally(() => {
        toggleAppSpinner(false);
      });
  });
}
