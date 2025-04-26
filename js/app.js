// js/app.js
// Requires: JSZip loaded from CDN via <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js"></script>

document.addEventListener('DOMContentLoaded', () => {
  // ─── Helpers ────────────────────────────────────────────────────────────
  const toastEl = document.getElementById('toast');
  function showToast(msg, isError = false) {
    toastEl.textContent = msg;
    toastEl.className = 'status-toast ' + (isError ? 'toast-error' : 'toast-success');
    toastEl.style.opacity = '1';
    setTimeout(() => { toastEl.style.opacity = '0'; }, 3000);
  }

  function setSpinner(on) {
    document.getElementById('spinner').style.display = on ? 'block' : 'none';
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsArrayBuffer(file);
    });
  }

  function readJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result));
        } catch (e) {
          reject(new Error('Invalid JSON in file'));
        }
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsText(file);
    });
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function generateUniqueCode() {
    return Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
  }

  // ─── App Toggle ────────────────────────────────────────────────────────
  const splitterApp = document.getElementById('splitterApp');
  const backupApp   = document.getElementById('backupApp');
  document.getElementById('showSplitterBtn').addEventListener('click', () => {
    splitterApp.style.display = 'block';
    backupApp.style.display   = 'none';
  });
  document.getElementById('showBackupBtn').addEventListener('click', () => {
    backupApp.style.display   = 'block';
    splitterApp.style.display = 'none';
  });

  // ─── EPUB CHAPTER SPLITTER ─────────────────────────────────────────────
  let epubFile = null;
  const splitBtn = document.getElementById('split-btn');

  document.getElementById('epub-upload').addEventListener('change', e => {
    epubFile = e.target.files[0];
    if (epubFile) {
      document.getElementById('file-name').textContent = `Selected: ${epubFile.name}`;
      splitBtn.disabled = false;
      document.querySelector('#splitterApp .download-section').style.display = 'none';
    }
  });

  document.getElementById('mode-select').addEventListener('change', function() {
    document.getElementById('group-size-group').style.display =
      this.value === 'grouped' ? 'block' : 'none';
  });

  splitBtn.addEventListener('click', () => {
    if (epubFile) processEPUB(epubFile);
  });

  async function processEPUB(file) {
    setSpinner(true);
    try {
      const buf = await readFileAsArrayBuffer(file);
      const zip = await JSZip.loadAsync(buf);
      const chapters = [];

      await Promise.all(Object.keys(zip.files).map(async path => {
        if (/\.(xhtml|html)$/.test(path)) {
          const text = await zip.files[path].async('text');
          const doc = new DOMParser().parseFromString(text, 'text/html');
          const secs = doc.querySelectorAll(
            'section[epub\\:type="chapter"], div[epub\\:type="chapter"], section.chapter, div.chapter'
          );
          if (secs.length) {
            secs.forEach(sec => {
              const ps = Array.from(sec.querySelectorAll('p'))
                .map(p => p.textContent.trim())
                .filter(t => t)
                .join('\n');
              if (ps) chapters.push(ps);
            });
          } else {
            const bodyText = doc.body.textContent.trim();
            if (bodyText) chapters.push(bodyText);
          }
        }
      }));

      const offset = Math.max(0, parseInt(document.getElementById('offset').value) || 0);
      const trimmed = chapters.slice(offset);
      if (!trimmed.length) {
        showToast('No chapters after offset.', true);
        return;
      }

      const mode   = document.getElementById('mode-select').value;
      const prefix = document.getElementById('chapter-pattern').value.trim() || 'chapter';
      let startNum = Math.max(1, parseInt(document.getElementById('start-number').value) || 1);

      const outZip = new JSZip();
      if (mode === 'single') {
        trimmed.forEach((text, i) => {
          const num = String(startNum + i).padStart(2, '0');
          outZip.file(`${prefix}${num}.txt`, text);
        });
      } else {
        let groupSize = Math.max(1, parseInt(document.getElementById('group-size').value) || 1);
        for (let i = 0; i < trimmed.length; i += groupSize) {
          const s = startNum + i;
          const e = Math.min(startNum + trimmed.length - 1, s + groupSize - 1);
          const name = s === e
            ? `${prefix} C${String(s).padStart(2,'0')}.txt`
            : `${prefix} C${String(s).padStart(2,'0')}-${String(e).padStart(2,'0')}.txt`;
          let content = '';
          for (let j = 0; j < groupSize && i + j < trimmed.length; j++) {
            if (j) content += "\n---------------- END ----------------\n";
            content += trimmed[i + j];
          }
          outZip.file(name, content);
        }
      }

      const blob = await outZip.generateAsync({ type: 'blob' });
      const link = document.getElementById('download-link');
      link.href = URL.createObjectURL(blob);
      link.download = `${prefix}_chapters.zip`;
      document.querySelector('#splitterApp .download-section').style.display = 'block';
      showToast(`Extracted ${trimmed.length} chapters`);
    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message}`, true);
    } finally {
      setSpinner(false);
    }
  }

  // ─── NOVEL BACKUP UTILITY ───────────────────────────────────────────────
  document.getElementById('operationSelect').addEventListener('change', () => {
    ['create','extend','merge','findReplace'].forEach(op => {
      document.getElementById(op + 'Section').style.display =
        document.getElementById('operationSelect').value === op ? 'block' : 'none';
    });
  });

  // Create New Backup File
  document.getElementById('createBtn').addEventListener('click', () => {
    setSpinner(true);
    try {
      const title     = document.getElementById('createProjectTitle').value.trim();
      const desc      = document.getElementById('createDescription').value.trim();
      const codeInput = document.getElementById('createUniqueCode').value.trim();
      const count     = parseInt(document.getElementById('createChapters').value, 10) || 0;
      const prefix    = document.getElementById('createPrefix').value;
      const showTOC   = document.getElementById('createTOC').value === 'true';
      const indent    = document.getElementById('createIndentation').value === 'true';

      if (!title || !desc || count < 1) {
        throw new Error('Please fill in title, description, and at least 1 chapter.');
      }

      const now        = Date.now();
      const uniqueCode = codeInput || generateUniqueCode();
      const scenes     = [];
      const sections   = [];

      for (let i = 1; i <= count; i++) {
        const t = prefix ? prefix + i : i.toString();
        scenes.push({
          code:   'scene' + i,
          title:  t,
          text:   JSON.stringify({ blocks: [{ type: 'text', align: 'left', text: '' }] }),
          ranking: i,
          status: '1'
        });
        sections.push({
          code:           'section' + i,
          title:          t,
          synopsis:       '',
          ranking:        i,
          section_scenes: [{ code: 'scene' + i, ranking: 1 }]
        });
      }

      const backup = {
        version: 4,
        code:    uniqueCode,
        title,
        description: desc,
        show_table_of_contents:         showTOC,
        apply_automatic_indentation:    indent,
        last_update_date:               now,
        last_backup_date:               now,
        revisions: [{
          number: 1,
          date:   now,
          book_progresses: [{
            year:       new Date().getFullYear(),
            month:      new Date().getMonth() + 1,
            day:        new Date().getDate(),
            word_count: 0
          }],
          statuses: [{ code: '1', title: 'Todo', color: -2697255, ranking: 1 }],
          scenes,
          sections
        }]
      };

      downloadJSON(JSON.stringify(backup, null, 2), 'new_backup_file.json');
      showToast('Backup file created');
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setSpinner(false);
    }
  });

  // Extend Existing Backup File
  document.getElementById('extendBtn').addEventListener('click', () => {
    const input  = document.getElementById('extendBackupFile');
    if (!input.files.length) {
      showToast('Please upload a backup file.', true);
      return;
    }
    setSpinner(true);

    const extra  = parseInt(document.getElementById('extendExtraChapters').value, 10) || 0;
    const prefix = document.getElementById('extendPrefix').value;
    const reader = new FileReader();

    reader.onerror = () => {
      showToast('File read error', true);
      setSpinner(false);
    };

    reader.onload = evt => {
      try {
        const backup = JSON.parse(evt.target.result);
        const rev    = backup.revisions?.[0];
        if (!rev) throw new Error('Invalid backup structure.');

        const existing = rev.scenes?.length || 0;
        rev.scenes   = rev.scenes || [];
        rev.sections = rev.sections || [];

        for (let i = 1; i <= extra; i++) {
          const num = existing + i;
          const t   = prefix ? prefix + num : num.toString();
          rev.scenes.push({
            code:    'scene' + num,
            title:   t,
            text:    JSON.stringify({ blocks: [{ type: 'text', align: 'left', text: '' }] }),
            ranking: num,
            status:  '1'
          });
          rev.sections.push({
            code:           'section' + num,
            title:          t,
            synopsis:       '',
            ranking:        num,
            section_scenes: [{ code: 'scene' + num, ranking: 1 }]
          });
        }

        const now = Date.now();
        backup.last_update_date = backup.last_backup_date = rev.date = now;

        downloadJSON(JSON.stringify(backup, null, 2), 'extended_backup_file.json');
        showToast('Backup extended');
      } catch (err) {
        showToast(err.message, true);
      } finally {
        setSpinner(false);
      }
    };

    reader.readAsText(input.files[0]);
  });

  // Merge Backup Files
  async function mergeBackups(files, prefix) {
    let scenes   = [];
    let sections = [];

    for (let f of files) {
      const data = await readJSON(f);
      const rev  = data.revisions?.[0];
      if (rev?.scenes)    scenes   = scenes.concat(rev.scenes);
      if (rev?.sections) sections = sections.concat(rev.sections);
    }

    scenes.forEach((s, i) => {
      const num = i + 1;
      const t   = prefix ? prefix + num : num.toString();
      s.code    = 'scene' + num;
      s.title   = t;
      s.ranking = num;
    });

    sections.forEach((s, i) => {
      const num = i + 1;
      const t   = prefix ? prefix + num : num.toString();
      s.code    = 'section' + num;
      s.title   = t;
      s.ranking = num;
      if (s.section_scenes?.[0]) {
        s.section_scenes[0].code    = 'scene' + num;
        s.section_scenes[0].ranking = 1;
      }
    });

    return {
      version: 4,
      code:    generateUniqueCode(),
      title:   document.getElementById('mergeProjectTitle').value,
      description: document.getElementById('mergeDescription').value,
      show_table_of_contents:      true,
      apply_automatic_indentation: true,
      last_update_date:            Date.now(),
      last_backup_date:            Date.now(),
      revisions: [{
        number: 1,
        date:   Date.now(),
        statuses: [{ code: '1', title: 'Todo', color: -2697255, ranking: 1 }],
        scenes,
        sections
      }]
    };
  }

  document.getElementById('mergeBtn').addEventListener('click', async () => {
    const files = document.getElementById('mergeBackupFiles').files;
    if (!files.length) {
      showToast('Select at least one file.', true);
      return;
    }
    setSpinner(true);
    try {
      const merged = await mergeBackups(files, document.getElementById('mergePrefix').value);
      downloadJSON(JSON.stringify(merged, null, 2), 'merged_backup_file.json');
      showToast('Files merged');
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setSpinner(false);
    }
  });

  // Find & Replace in Backup File
  let frBackupData    = null;
  let frCurrentPointer = { scene: 0, block: 0, offset: 0 };
  let frCurrentMatch   = null;

  function displayCurrentMatch(md) {
    const d = document.getElementById('currentMatchDisplay');
    if (md) {
      d.textContent = `Match in "${md.chapterTitle}":\n${md.matchLine}`;
    } else {
      d.textContent = 'No further matches found.';
    }
  }

  function findNextMatch() {
    const pat      = document.getElementById('findPattern').value;
    const useRegex = document.getElementById('useRegex').checked;
    if (!frBackupData || !pat) return null;
    const scenes = frBackupData.revisions[0].scenes;

    for (let i = frCurrentPointer.scene; i < scenes.length; i++) {
      const blocks = JSON.parse(scenes[i].text).blocks;
      for (let j = (i === frCurrentPointer.scene ? frCurrentPointer.block : 0); j < blocks.length; j++) {
        const txt = blocks[j].text || '';
        let start = (i === frCurrentPointer.scene && j === frCurrentPointer.block)
                    ? frCurrentPointer.offset
                    : 0;
        let idx = -1;

        if (useRegex) {
          try {
            const rx = new RegExp(pat, 'g');
            rx.lastIndex = start;
            const m = rx.exec(txt);
            if (m) idx = m.index;
          } catch {
            showToast('Invalid regular expression.', true);
            return null;
          }
        } else {
          idx = txt.indexOf(pat, start);
        }

        if (idx !== -1) {
          // find line
          const lines = txt.split('\n');
          let cum = 0, line = '';
          for (let L of lines) {
            if (idx >= cum && idx < cum + L.length) {
              line = L;
              break;
            }
            cum += L.length + 1;
          }
          frCurrentMatch = {
            sceneIndex:   i,
            blockIndex:   j,
            matchIndex:   idx,
            chapterTitle: scenes[i].title,
            matchLine:    line
          };
          frCurrentPointer = { scene: i, block: j, offset: idx + 1 };
          return frCurrentMatch;
        }
        frCurrentPointer.offset = 0;
      }
      frCurrentPointer = { scene: i + 1, block: 0, offset: 0 };
    }
    return null;
  }

  function findPreviousMatch() {
    const pat      = document.getElementById('findPattern').value;
    const useRegex = document.getElementById('useRegex').checked;
    if (!frBackupData || !pat) return null;
    const scenes = frBackupData.revisions[0].scenes;

    for (let i = frCurrentPointer.scene; i >= 0; i--) {
      const blocks     = JSON.parse(scenes[i].text).blocks;
      const startBlock = (i === frCurrentPointer.scene)
                         ? frCurrentPointer.block
                         : blocks.length - 1;
      for (let j = startBlock; j >= 0; j--) {
        const txt    = blocks[j].text || '';
        let endIdx   = (i === frCurrentPointer.scene && j === frCurrentPointer.block)
                       ? frCurrentPointer.offset
                       : txt.length;
        let idx      = -1;

        if (useRegex) {
          try {
            const rx   = new RegExp(pat, 'g');
            let last   = -1;
            let m;
            while ((m = rx.exec(txt)) && m.index < endIdx) {
              last = m.index;
              if (rx.lastIndex === m.index) rx.lastIndex++;
            }
            idx = last;
          } catch {
            showToast('Invalid regular expression.', true);
            return null;
          }
        } else {
          idx = txt.lastIndexOf(pat, endIdx - 1);
        }

        if (idx !== -1) {
          // find line
          const lines = txt.split('\n');
          let cum = 0, line = '';
          for (let L of lines) {
            if (idx >= cum && idx < cum + L.length) {
              line = L;
              break;
            }
            cum += L.length + 1;
          }
          frCurrentMatch = {
            sceneIndex:   i,
            blockIndex:   j,
            matchIndex:   idx,
            chapterTitle: scenes[i].title,
            matchLine:    line
          };
          frCurrentPointer = { scene: i, block: j, offset: idx };
          return frCurrentMatch;
        }
        // reset offset for previous block
        frCurrentPointer.offset = (j > 0 ? txt.length : 0);
      }
      frCurrentPointer = { scene: i - 1, block: 0, offset: 0 };
    }
    return null;
  }

  document.getElementById('findNextBtn').addEventListener('click', () => {
    const input = document.getElementById('frBackupFile');
    if (!frBackupData) {
      if (!input.files.length) {
        showToast('Please upload a backup file first.', true);
        return;
      }
      readJSON(input.files[0])
        .then(data => {
          frBackupData = data;
          frCurrentPointer = { scene: 0, block: 0, offset: 0 };
          displayCurrentMatch(findNextMatch());
        })
        .catch(err => showToast(err.message, true));
    } else {
      displayCurrentMatch(findNextMatch());
    }
  });

  document.getElementById('findPreviousBtn').addEventListener('click', () => {
    const input = document.getElementById('frBackupFile');
    if (!frBackupData) {
      if (!input.files.length) {
        showToast('Please upload a backup file first.', true);
        return;
      }
      readJSON(input.files[0])
        .then(data => {
          frBackupData = data;
          const scenes = data.revisions[0].scenes;
          frCurrentPointer = {
            scene:  scenes.length - 1,
            block:  0,
            offset: JSON.parse(scenes[scenes.length - 1].text).blocks[0].text.length
          };
          displayCurrentMatch(findPreviousMatch());
        })
        .catch(err => showToast(err.message, true));
    } else {
      displayCurrentMatch(findPreviousMatch());
    }
  });

  document.getElementById('replaceNextBtn').addEventListener('click', () => {
    if (!frBackupData || !frCurrentMatch) {
      showToast('No current match to replace.', true);
      return;
    }
    try {
      const pat      = document.getElementById('findPattern').value;
      const rep      = document.getElementById('replaceText').value;
      const useRegex = document.getElementById('useRegex').checked;
      const scene    = frBackupData.revisions[0].scenes[frCurrentMatch.sceneIndex];
      const blocks   = JSON.parse(scene.text).blocks;
      let txt        = blocks[frCurrentMatch.blockIndex].text || '';
      const before   = txt.slice(0, frCurrentMatch.matchIndex);
      let after      = txt.slice(frCurrentMatch.matchIndex);

      if (useRegex) {
        after = after.replace(new RegExp(pat), rep);
      } else {
        after = after.replace(pat, rep);
      }

      blocks[frCurrentMatch.blockIndex].text = before + after;
      scene.text = JSON.stringify({ blocks });
      frCurrentMatch = null;
      showToast('Replacement performed.');
      displayCurrentMatch(findNextMatch());
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById('replaceAllBtn').addEventListener('click', () => {
    const input = document.getElementById('frBackupFile');
    if (!input.files.length) {
      showToast('Please upload a backup file.', true);
      return;
    }
    setSpinner(true);
    readJSON(input.files[0])
      .then(backup => {
        if (!backup.revisions?.length) {
          throw new Error('Invalid backup structure.');
        }
        const rev     = backup.revisions[0];
        const pat     = document.getElementById('findPattern').value;
        const rep     = document.getElementById('replaceText').value;
        const useRegex = document.getElementById('useRegex').checked;
        let replacer;

        if (useRegex) {
          const rx = new RegExp(pat, 'g');
          replacer = txt => txt.replace(rx, rep);
        } else {
          replacer = txt => txt.split(pat).join(rep);
        }

        rev.scenes.forEach(scene => {
          const obj = JSON.parse(scene.text);
          obj.blocks.forEach(b => {
            if (typeof b.text === 'string') {
              b.text = replacer(b.text);
            }
          });
          scene.text = JSON.stringify(obj);
        });

        const now = Date.now();
        backup.last_update_date = backup.last_backup_date = rev.date = now;
        downloadJSON(JSON.stringify(backup, null, 2), 'find_replace_backup_file.json');
        showToast('All replacements done');
      })
      .catch(err => showToast(err.message, true))
      .finally(() => setSpinner(false));
  });

});
