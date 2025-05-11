// js/backup-utility.js

// We'll pass showAppToast and toggleAppSpinner from main.js
// JSZip is global from CDN

// Find & Replace state variables (scoped to this module)
let frData = null;
let frPtr = { scene: 0, block: 0, offset: 0 };
let frMatch = null;

// --- Helper function for Find & Replace ---
function displayMatchText(matchDisplayElement, matchDetails) {
    if (!matchDisplayElement) return;
    matchDisplayElement.textContent = matchDetails
        ? `Match in "${matchDetails.chapterTitle}":\n${matchDetails.matchLine}`
        : 'No further matches found.';
}

// --- START OF FIND & REPLACE CORE LOGIC (findNext, findPrev) ---

// --- COMPLETE findNextMatch ---
function findNextMatch(findPatternValue, useRegexValue, showAppToast) {
    if (!frData || !frData.revisions || !frData.revisions[0] || !frData.revisions[0].scenes) {
        console.error("FindNext: frData or scenes array is missing/invalid.");
        return null;
    }
    const scenes = frData.revisions[0].scenes;

    // Handle invalid initial frPtr.scene (e.g., after FindPrev reached beginning)
    if (typeof frPtr.scene !== 'number' || frPtr.scene < 0) {
        // console.warn("FindNext: frPtr.scene was < 0, resetting to 0 for forward search.", frPtr);
        frPtr = { scene: 0, block: 0, offset: 0 };
    }
    
    // If pointer is already at or past the end, no more searching.
    if (frPtr.scene >= scenes.length) {
        // console.log("FindNext: Pointer already at or past end of scenes.");
        return null; 
    }

    for (let i = frPtr.scene; i < scenes.length; i++) {
        const currentSceneObject = scenes[i];

        if (!currentSceneObject) {
            console.warn(`FindNext: Scene at index ${i} is undefined. Advancing pointer.`);
            frPtr = { scene: scenes.length, block: 0, offset: 0 }; // Mark as end
            return null;
        }

        const sceneText = currentSceneObject.text;
        if (typeof sceneText !== 'string' || sceneText.trim() === '') {
            if (i === frPtr.scene) { // If current search started in this empty/invalid scene
                frPtr.block = 0;      // Reset block and offset for the next scene
                frPtr.offset = 0;
            }
            // No need to set frPtr.scene = i + 1 here; the outer loop will do that.
            continue; 
        }

        let blocks;
        try {
            const parsedContent = JSON.parse(sceneText);
            blocks = parsedContent.blocks;
            if (!Array.isArray(blocks)) blocks = [];
        } catch (e) {
            console.warn(`FindNext: Skipping scene "${currentSceneObject.title || 'Untitled'}" (index ${i}) due to invalid JSON:`, e.message);
            if (i === frPtr.scene) { frPtr.block = 0; frPtr.offset = 0; }
            continue;
        }

        for (let j = (i === frPtr.scene ? frPtr.block : 0); j < blocks.length; j++) {
            const currentBlock = blocks[j];
            if (!currentBlock) {
                 if (i === frPtr.scene && j === frPtr.block) { frPtr.offset = 0; frPtr.block = j + 1; } // Skip bad block
                continue;
            }

            const blockText = currentBlock.hasOwnProperty('text') ? (currentBlock.text || '') : '';
            
            let searchStartIndex = 0;
            if (i === frPtr.scene && j === frPtr.block) {
                searchStartIndex = frPtr.offset;
            }

            if (searchStartIndex >= blockText.length && blockText.length > 0) {
                if (i === frPtr.scene && j === frPtr.block) { frPtr.offset = 0; }
                continue; 
            }
            if (!blockText && findPatternValue) {
                if (i === frPtr.scene && j === frPtr.block) { frPtr.offset = 0; }
                continue;
            }

            let matchIndex = -1;
            let matchedText = '';

            if (blockText || (useRegexValue && !findPatternValue)) { // Allow empty pattern for some regex like ^ $
                if (useRegexValue) {
                    try {
                        if (findPatternValue === undefined || findPatternValue === null) { // Should not happen if UI validates
                             showAppToast('Regex pattern is undefined.', true); return null;
                        }
                        const rx = new RegExp(findPatternValue, 'g'); 
                        rx.lastIndex = searchStartIndex;
                        const m = rx.exec(blockText);
                        if (m) {
                            matchIndex = m.index;
                            matchedText = m[0];
                        }
                    } catch (err) {
                        showAppToast('Invalid regular expression.', true); return null; 
                    }
                } else {
                    if (findPatternValue) { // Only search if pattern is not empty for string search
                        matchIndex = blockText.indexOf(findPatternValue, searchStartIndex);
                        if (matchIndex !== -1) matchedText = findPatternValue;
                    }
                }
            } 

            if (matchIndex !== -1) {
                const lines = blockText.split('\n'); 
                let cumulativeLength = 0, lineContent = '';
                for (const line of lines) {
                    if (matchIndex >= cumulativeLength && matchIndex <= cumulativeLength + line.length) { 
                        lineContent = line; break;
                    }
                    cumulativeLength += line.length + 1; 
                }
                frMatch = {
                    sceneIndex: i, blockIndex: j, matchIndex: matchIndex,
                    matchLength: matchedText.length, chapterTitle: currentSceneObject.title,
                    matchLine: lineContent
                };
                frPtr = { scene: i, block: j, offset: matchIndex + matchedText.length }; 
                return frMatch;
            }
            
            if (i === frPtr.scene && j === frPtr.block) {
                frPtr.offset = 0; // Searched current block from offset, no match, reset offset for next block.
            }
        } // End block loop

        // Finished searching all blocks in scene 'i'.
        // If scene 'i' was the scene frPtr was pointing to, update frPtr for the next scene.
        if (i === frPtr.scene) {
            frPtr.block = 0; 
            frPtr.offset = 0;
            // frPtr.scene will be incremented by the outer loop 'for (let i = frPtr.scene...)'
        }
    } // End scene loop

    frPtr = { scene: scenes.length, block: 0, offset: 0 }; // Reached end of all scenes
    return null; 
}


// --- COMPLETE findPreviousMatch ---
function findPreviousMatch(findPatternValue, useRegexValue, showAppToast) {
    if (!frData || !frData.revisions || !frData.revisions[0] || !frData.revisions[0].scenes) {
        console.error("FindPrev: frData or scenes array is missing/invalid.");
        return null;
    }
    const scenes = frData.revisions[0].scenes;

    // Handle invalid initial frPtr.scene (e.g., after FindNext reached end)
    if (typeof frPtr.scene !== 'number' || frPtr.scene >= scenes.length) {
        // console.warn("FindPrev: frPtr.scene was >= scenes.length, resetting to end for backward search.", frPtr);
        if (scenes.length > 0) {
            frPtr = { scene: scenes.length - 1, block: 0, offset: 0 }; // block & offset will be set
        } else { // No scenes to search
            return null;
        }
    }
    
    // If pointer is already at or before the beginning, no more searching.
    if (frPtr.scene < 0) {
        // console.log("FindPrev: Pointer already at or before beginning of scenes.");
        return null;
    }

    for (let i = frPtr.scene; i >= 0; i--) {
        const currentSceneObject = scenes[i];

        if (!currentSceneObject) {
            console.warn(`FindPrev: Scene at index ${i} is undefined. Advancing pointer.`);
            frPtr = { scene: -1, block: 0, offset: 0 }; // Mark as beginning
            return null;
        }

        const sceneText = currentSceneObject.text;
        if (typeof sceneText !== 'string' || sceneText.trim() === '') {
            if (i === frPtr.scene) { // If current search started in this empty/invalid scene
                // frPtr.block and frPtr.offset will be set when loop continues to scene i-1
            }
            continue;
        }

        let blocks;
        try {
            const parsedContent = JSON.parse(sceneText);
            blocks = parsedContent.blocks;
            if (!Array.isArray(blocks)) blocks = [];
        } catch (e) {
            console.warn(`FindPrev: Skipping scene "${currentSceneObject.title || 'Untitled'}" (index ${i}) due to invalid JSON:`, e.message);
            if (i === frPtr.scene) { /* pointer will adjust with loop */ }
            continue;
        }

        if (blocks.length === 0) continue; // No blocks to search

        let startBlockIndex;
        if (i < frPtr.scene) { // Moved to a new scene (searching backwards)
            startBlockIndex = blocks.length - 1;
        } else { // Still in the same scene as frPtr.scene
            startBlockIndex = frPtr.block;
            if (startBlockIndex >= blocks.length) startBlockIndex = blocks.length -1; // Safety for bad frPtr.block
            if (startBlockIndex < 0) continue; // No valid block to start from
        }


        for (let j = startBlockIndex; j >= 0; j--) {
            const currentBlock = blocks[j];
            if (!currentBlock) {
                if (i === frPtr.scene && j === frPtr.block) {frPtr.offset = 0; frPtr.block = j-1;}
                continue;
            }

            const blockText = currentBlock.hasOwnProperty('text') ? (currentBlock.text || '') : '';

            let searchEndOffset; // This is the point *before* which the match must occur
            if (i === frPtr.scene && j === frPtr.block) {
                searchEndOffset = frPtr.offset;
            } else { 
                searchEndOffset = blockText.length;
            }
            
            if (searchEndOffset <= 0 && blockText.length > 0) {
                if (i === frPtr.scene && j === frPtr.block) { /* pointer will adjust */ }
                continue;
            }
            if (!blockText && findPatternValue) {
                if (i === frPtr.scene && j === frPtr.block) { /* pointer will adjust */ }
                continue;
            }

            let matchIndex = -1;
            let matchedText = '';

            if (blockText || (useRegexValue && !findPatternValue)) {
                if (useRegexValue) {
                    try {
                        if (findPatternValue === undefined || findPatternValue === null) {
                            showAppToast('Regex pattern is undefined.', true); return null;
                        }
                        const rx = new RegExp(findPatternValue, 'g');
                        let lastMatchResult = null;
                        let currentMatchRegexResult; 
                        while ((currentMatchRegexResult = rx.exec(blockText)) !== null) {
                            if (currentMatchRegexResult.index < searchEndOffset) {
                                lastMatchResult = currentMatchRegexResult;
                            } else {
                                break; 
                            }
                            if (rx.lastIndex === currentMatchRegexResult.index && findPatternValue) rx.lastIndex++; 
                            else if (rx.lastIndex === currentMatchRegexResult.index && !findPatternValue) break; 
                        }
                        if (lastMatchResult) {
                            matchIndex = lastMatchResult.index;
                            matchedText = lastMatchResult[0];
                        }
                    } catch(err) {
                        showAppToast('Invalid regular expression.', true); return null;
                    }
                } else { // Plain string search
                    if (findPatternValue && searchEndOffset > 0) { 
                        let effectiveSearchStartForLastIndexOf = searchEndOffset;
                        if (findPatternValue.length > 0) {
                            effectiveSearchStartForLastIndexOf = searchEndOffset - findPatternValue.length;
                        } else { // Searching for empty string, point before searchEndOffset
                            effectiveSearchStartForLastIndexOf = searchEndOffset -1;
                        }
                        if (effectiveSearchStartForLastIndexOf >=0) {
                           matchIndex = blockText.lastIndexOf(findPatternValue, effectiveSearchStartForLastIndexOf);
                        }
                        if (matchIndex !== -1) matchedText = findPatternValue;
                    }
                }
            } 
    
            if (matchIndex !== -1) {
                const lines = blockText.split('\n');
                let cumulativeLength = 0, lineContent = '';
                for (const line of lines) {
                    if (matchIndex >= cumulativeLength && matchIndex <= cumulativeLength + line.length) {
                        lineContent = line; break;
                    }
                    cumulativeLength += line.length + 1;
                }
                frMatch = { 
                    sceneIndex: i, blockIndex: j, matchIndex: matchIndex,
                    matchLength: matchedText.length, chapterTitle: currentSceneObject.title,
                    matchLine: lineContent
                };
                frPtr = { scene: i, block: j, offset: matchIndex }; 
                return frMatch;
            }

            if (i === frPtr.scene && j === frPtr.block) {
                // Searched current block (from offset backwards), no match.
                // For next iteration (j-1), searchEndOffset will be blockText.length of block j-1.
                // So, effectively, frPtr.offset is "consumed" for this block.
            }
        } // End block loop

        // Finished searching all blocks in scene 'i' backwards.
        // If scene 'i' was the scene frPtr was pointing to, update frPtr for the previous scene.
        if (i === frPtr.scene) {
            // frPtr.scene will be decremented by the outer loop 'for (let i = frPtr.scene...)'
            // When it enters scene i-1, startBlockIndex will be blocks.length-1
            // and searchEndOffset will be blockText.length for that first block.
        }
    } // End scene loop

    frPtr = { scene: -1, block: 0, offset: 0 }; // Reached beginning of all scenes
    return null; 
}
// --- END OF FIND & REPLACE CORE LOGIC ---


export function initializeBackupUtility(showAppToast, toggleAppSpinner) {
    const opSelect = document.getElementById('operationSelect');
    if (!opSelect) {
        console.error("Backup utility operation select not found. Initialization failed.");
        return;
    }

    opSelect.addEventListener('change', () => {
        ['create', 'createFromZip', 'extend', 'merge', 'findReplace'].forEach(op => {
            const sectionElement = document.getElementById(op + 'Section');
            if (sectionElement) {
                sectionElement.style.display = opSelect.value === op ? 'block' : 'none';
            }
        });
    });

    // --- Create New Backup ---
    const createBtn = document.getElementById('createBtn');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            toggleAppSpinner(true);
            try {
                const title = document.getElementById('createProjectTitle').value;
                const desc = document.getElementById('createDescription').value;
                const codeInput = document.getElementById('createUniqueCode').value.trim();
                const count = parseInt(document.getElementById('createChapters').value, 10) || 0;
                const prefix = document.getElementById('createPrefix').value;
                const showTOC = document.getElementById('createTOC').value === 'true';
                const autoIndent = document.getElementById('createIndentation').value === 'true';

                if (!title || count < 1) { // Simplified check, desc can be optional
                    showAppToast('Project Title and at least 1 chapter are required.', true);
                    throw new Error('Validation failed for create new backup.');
                }

                const uniqueCode = codeInput || Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
                const now = Date.now();
                const scenes = [];
                const sections = [];
                for (let i = 1; i <= count; i++) {
                    const chapTitle = prefix ? prefix + i : i.toString();
                    const sceneCode = 'scene' + i; // Consistent scene code
                    scenes.push({
                        code: sceneCode, title: chapTitle,
                        text: JSON.stringify({ blocks: [{ type: 'text', align: 'left', text: '' }] }),
                        ranking: i, status: '1'
                    });
                    sections.push({
                        code: 'section' + i, title: chapTitle, // Consistent section code
                        synopsis: '', ranking: i,
                        section_scenes: [{ code: sceneCode, ranking: 1 }]
                    });
                }
                const backup = {
                    version: 4, code: uniqueCode, title, description: desc,
                    show_table_of_contents: showTOC,
                    apply_automatic_indentation: autoIndent,
                    last_update_date: now, last_backup_date: now,
                    revisions: [{
                        number: 1, date: now,
                        book_progresses: [{
                            year: new Date().getFullYear(),
                            month: new Date().getMonth() + 1,
                            day: new Date().getDate(),
                            word_count: 0
                        }],
                        statuses: [{ code: '1', title: 'Todo', color: -2697255, ranking: 1 }],
                        scenes, sections
                    }]
                };
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${title.replace(/[^a-z0-9_\-\s]/gi, '_').replace(/\s+/g, '_') || 'new_backup'}_file.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showAppToast('Backup file created successfully.');
            } catch (err) {
                if (err.message !== 'Validation failed for create new backup.') { // Avoid double toast
                    showAppToast(err.message || 'Error creating backup.', true);
                }
                console.error("Create Backup Error:", err);
            } finally {
                toggleAppSpinner(false);
            }
        });
    } else { console.warn("Create button not found"); }

    // --- Create Backup from ZIP --- (This is the function we just worked on)
    const createFromZipBtn = document.getElementById('createFromZipBtn');
    if (createFromZipBtn) {
        createFromZipBtn.addEventListener('click', async () => {
            toggleAppSpinner(true);
            const zipFileInput = document.getElementById('zipBackupFile');
            const projectTitle = document.getElementById('zipProjectTitle').value;
            const description = document.getElementById('zipDescription').value;
            const uniqueCodeInput = document.getElementById('zipUniqueCode').value.trim();
            const showTOC = document.getElementById('zipCreateTOC').value === 'true';
            const autoIndent = document.getElementById('zipCreateIndentation').value === 'true';

            if (!zipFileInput.files.length) {
                showAppToast('Please upload a ZIP file.', true);
                toggleAppSpinner(false); return;
            }
            if (!projectTitle) { // Simplified check
                showAppToast('Project Title is required.', true);
                toggleAppSpinner(false); return;
            }

            const file = zipFileInput.files[0];

            try {
                const zip = await JSZip.loadAsync(file); // JSZip must be available globally
                const scenes = [];
                const sections = [];
                let chapterCounter = 0;
                const chapterFilePromises = [];

                zip.forEach((relativePath, zipEntry) => {
                    if (!zipEntry.dir && zipEntry.name.toLowerCase().endsWith('.txt')) {
                        chapterFilePromises.push(
                            zipEntry.async('string').then(text => ({ name: zipEntry.name, text }))
                        );
                    }
                });

                const chapterFiles = await Promise.all(chapterFilePromises);
                chapterFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

                for (const chapterFile of chapterFiles) {
                    chapterCounter++;
                    const chapterTitle = chapterFile.name.replace(/\.txt$/i, '');
                    
                    const rawChapterText = chapterFile.text;
                    const normalizedText = rawChapterText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                    const contentSegments = normalizedText.split(/\n{2,}/)
                                                    .map(s => s.trim())
                                                    .filter(s => s !== '');
                    const blocks = [];
                    for (let i = 0; i < contentSegments.length; i++) {
                        blocks.push({ type: 'text', align: 'left', text: contentSegments[i] });
                        blocks.push({ type: 'text', align: 'left' }); // Spacer
                    }
                    if (contentSegments.length === 0) {
                        if (rawChapterText.trim() === '' && rawChapterText.length > 0) {
                            blocks.push({ type: 'text', align: 'left' });
                        } else if (rawChapterText.trim() === '') {
                            blocks.push({ type: 'text', align: 'left', text: '' });
                        }
                    }
                    if (blocks.length === 0) { // Safeguard
                        blocks.push({ type: 'text', align: 'left', text: '' });
                    }
                    const sceneText = JSON.stringify({ blocks });

                    const sceneCode = `scene${chapterCounter}`;
                    scenes.push({
                        code: sceneCode, title: chapterTitle, text: sceneText,
                        ranking: chapterCounter, status: '1'
                    });
                    sections.push({
                        code: `section${chapterCounter}`, title: chapterTitle, synopsis: '',
                        ranking: chapterCounter, section_scenes: [{ code: sceneCode, ranking: 1 }]
                    });
                }

                if (scenes.length === 0) throw new Error('No .txt files found in the ZIP archive.');

                const uniqueCode = uniqueCodeInput || Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0');
                const now = Date.now();
                let totalWordCount = 0;
                scenes.forEach(scene => {
                    try {
                        const sceneContent = JSON.parse(scene.text);
                        sceneContent.blocks.forEach(block => {
                            if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
                                totalWordCount += block.text.trim().split(/\s+/).length;
                            }
                        });
                    } catch (e) { console.warn("Word count parse error:", e); }
                });

                const backupData = {
                    version: 4, code: uniqueCode, title: projectTitle, description: description,
                    show_table_of_contents: showTOC, apply_automatic_indentation: autoIndent,
                    last_update_date: now, last_backup_date: now,
                    revisions: [{
                        number: 1, date: now,
                        book_progresses: [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate(), word_count: totalWordCount }],
                        statuses: [{ code: '1', title: 'Todo', color: -2697255, ranking: 1 }],
                        scenes, sections
                    }]
                };

                const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const safeFileName = projectTitle.replace(/[^a-z0-9_\-\s]/gi, '_').replace(/\s+/g, '_');
                a.download = `${safeFileName || 'backup_from_zip'}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showAppToast(`Backup file created with ${scenes.length} chapter(s).`);
            } catch (err) {
                showAppToast(`Error: ${err.message}`, true);
                console.error("Create Backup from ZIP Error:", err);
            } finally {
                toggleAppSpinner(false);
            }
        });
    } else { console.warn("Create from ZIP button not found"); }

    // --- Extend Existing Backup ---
    const extendBtn = document.getElementById('extendBtn');
    if (extendBtn) {
        extendBtn.addEventListener('click', () => {
            const inp = document.getElementById('extendBackupFile');
            if (!inp.files.length) {
                showAppToast('Please upload a backup file to extend.', true); return;
            }
            toggleAppSpinner(true);
            const extraChapters = parseInt(document.getElementById('extendExtraChapters').value, 10) || 0;
            const prefix = document.getElementById('extendPrefix').value;
            const reader = new FileReader();
            reader.onerror = () => {
                showAppToast('Error reading file.', true); toggleAppSpinner(false);
            };
            reader.onload = e => {
                try {
                    const backup = JSON.parse(e.target.result);
                    const rev = backup.revisions && backup.revisions[0];
                    if (!rev || !rev.scenes || !rev.sections) throw new Error('Invalid backup file structure for extending.');
                    
                    const existingCount = rev.scenes.length;
                    for (let i = 1; i <= extraChapters; i++) {
                        const num = existingCount + i;
                        const chapTitle = prefix ? prefix + num : num.toString();
                        const sceneCode = 'scene' + num;
                        rev.scenes.push({
                            code: sceneCode, title: chapTitle,
                            text: JSON.stringify({ blocks: [{ type: 'text', align: 'left', text: '' }] }),
                            ranking: num, status: '1'
                        });
                        rev.sections.push({
                            code: 'section' + num, title: chapTitle, synopsis: '', ranking: num,
                            section_scenes: [{ code: sceneCode, ranking: 1 }]
                        });
                    }
                    const now = Date.now();
                    backup.last_update_date = now;
                    backup.last_backup_date = now;
                    rev.date = now;
                    // Optional: update word count if you track it meticulously, though these are empty.

                    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${backup.title.replace(/[^a-z0-9_\-\s]/gi, '_').replace(/\s+/g, '_') || 'extended_backup'}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showAppToast('Backup extended successfully.');
                } catch (err) {
                    showAppToast(err.message || 'Error extending backup.', true);
                    console.error("Extend Backup Error:", err);
                } finally {
                    toggleAppSpinner(false);
                }
            };
            reader.readAsText(inp.files[0]);
        });
    } else { console.warn("Extend button not found"); }

    // --- Merge Backup Files ---
    // Helper for merge (can be kept inside or moved to top of module if preferred)
    async function processMergeBackupFiles(files, mergedTitle, mergedDesc, chapterPrefix) {
        let combinedScenes = [];
        let combinedSections = [];
        // Assuming all files have at least one revision and standard statuses.
        // We'll take statuses from the first file if available, or use a default.
        let baseStatuses = [{ code: '1', title: 'Todo', color: -2697255, ranking: 1 }];
        let firstFileProcessed = false;

        for (const file of files) {
            try {
                const data = JSON.parse(await file.text());
                const rev = data.revisions && data.revisions[0];
                if (rev) {
                    if (rev.scenes) combinedScenes = combinedScenes.concat(rev.scenes);
                    if (rev.sections) combinedSections = combinedSections.concat(rev.sections);
                    if (!firstFileProcessed && rev.statuses && rev.statuses.length > 0) {
                        baseStatuses = rev.statuses;
                        firstFileProcessed = true;
                    }
                }
            } catch (e) {
                console.warn(`Skipping file ${file.name} in merge due to parse error:`, e);
                showAppToast(`Skipped ${file.name} during merge (invalid format).`, true);
            }
        }

        // Re-index and re-title
        combinedScenes.forEach((s, i) => {
            const n = i + 1;
            s.code = 'scene' + n;
            s.title = chapterPrefix ? chapterPrefix + n : n.toString();
            s.ranking = n;
        });
        combinedSections.forEach((s, i) => {
            const n = i + 1;
            s.code = 'section' + n;
            s.title = chapterPrefix ? chapterPrefix + n : n.toString();
            s.ranking = n;
            if (s.section_scenes && s.section_scenes[0]) {
                s.section_scenes[0].code = 'scene' + n; // Link to the re-indexed scene
                s.section_scenes[0].ranking = 1;
            }
        });

        const now = Date.now();
        let totalWordCount = 0; // Recalculate word count for merged content
        combinedScenes.forEach(scene => {
            try {
                const sceneContent = JSON.parse(scene.text);
                sceneContent.blocks.forEach(block => {
                    if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
                        totalWordCount += block.text.trim().split(/\s+/).length;
                    }
                });
            } catch (e) { console.warn("Word count error in merged scene:", e); }
        });

        return {
            version: 4,
            code: Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0'),
            title: mergedTitle,
            description: mergedDesc,
            show_table_of_contents: true, // Default for merged
            apply_automatic_indentation: true, // Default for merged
            last_update_date: now,
            last_backup_date: now,
            revisions: [{
                number: 1, date: now,
                book_progresses: [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate(), word_count: totalWordCount }],
                statuses: baseStatuses,
                scenes: combinedScenes,
                sections: combinedSections
            }]
        };
    }

    const mergeBtn = document.getElementById('mergeBtn');
    if (mergeBtn) {
        mergeBtn.addEventListener('click', async () => {
            const files = document.getElementById('mergeBackupFiles').files;
            const mergedTitle = document.getElementById('mergeProjectTitle').value;
            const mergedDesc = document.getElementById('mergeDescription').value;
            const chapterPrefix = document.getElementById('mergePrefix').value;

            if (!files.length) {
                showAppToast('Select at least one backup file to merge.', true); return;
            }
            if (!mergedTitle) {
                showAppToast('Merged Project Title is required.', true); return;
            }
            toggleAppSpinner(true);
            try {
                const mergedData = await processMergeBackupFiles(Array.from(files), mergedTitle, mergedDesc, chapterPrefix);
                if (mergedData.revisions[0].scenes.length === 0) {
                    showAppToast('No valid chapters found in the selected files to merge.', true);
                    throw new Error('Merge resulted in no scenes.');
                }
                const blob = new Blob([JSON.stringify(mergedData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${mergedTitle.replace(/[^a-z0-9_\-\s]/gi, '_').replace(/\s+/g, '_') || 'merged_backup'}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showAppToast('Backup files merged successfully.');
            } catch (err) {
                 if (err.message !== 'Merge resulted in no scenes.') {
                    showAppToast(err.message || 'Error merging backup files.', true);
                 }
                console.error("Merge Backup Error:", err);
            } finally {
                toggleAppSpinner(false);
            }
        });
    } else { console.warn("Merge button not found"); }


    // --- Find & Replace ---
    const frBackupFileInput = document.getElementById('frBackupFile');
    const findPatternInput = document.getElementById('findPattern');
    const useRegexCheckbox = document.getElementById('useRegex');
    const currentMatchDisplay = document.getElementById('currentMatchDisplay');
    const replaceTextInput = document.getElementById('replaceText');

    // Load file for Find & Replace
    if (frBackupFileInput) {
        frBackupFileInput.addEventListener('change', (e) => {
            if (!e.target.files.length) {
                frData = null;
                frMatch = null;
                displayMatchText(currentMatchDisplay, null);
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    frData = JSON.parse(event.target.result);
                    if (!frData.revisions || !frData.revisions[0] || !frData.revisions[0].scenes) {
                        throw new Error("Invalid backup structure for Find & Replace.");
                    }
                    frPtr = { scene: 0, block: 0, offset: 0 }; // Reset pointer
                    frMatch = null; // Reset current match
                    displayMatchText(currentMatchDisplay, null);
                    showAppToast("Backup file loaded for Find & Replace.");
                } catch (err) {
                    showAppToast(err.message || "Error loading F&R backup.", true);
                    frData = null;
                    console.error("F&R Load Error:", err);
                }
            };
            reader.onerror = () => {
                showAppToast("Error reading F&R backup file.", true);
                frData = null;
            };
            reader.readAsText(e.target.files[0]);
        });
    }


    const findNextBtn = document.getElementById('findNextBtn');
    if (findNextBtn) {
        findNextBtn.addEventListener('click', () => {
            if (!frData) {
                showAppToast('Upload a backup file first for Find & Replace.', true); return;
            }
            const pattern = findPatternInput.value;
            const useRegex = useRegexCheckbox.checked;
            if (!pattern) {
                showAppToast('Enter a find pattern.', true); return;
            }
            const match = findNextMatch(pattern, useRegex, showAppToast);
            displayMatchText(currentMatchDisplay, match);
            if (!match && frPtr.scene >= frData.revisions[0].scenes.length) { // To indicate end of search
                 showAppToast('Reached end of document.', false);
            }
        });
    }

    const findPreviousBtn = document.getElementById('findPreviousBtn');
    if (findPreviousBtn) {
        findPreviousBtn.addEventListener('click', () => {
            if (!frData) {
                showAppToast('Upload a backup file first for Find & Replace.', true); return;
            }
            const pattern = findPatternInput.value;
            const useRegex = useRegexCheckbox.checked;
             if (!pattern) {
                showAppToast('Enter a find pattern.', true); return;
            }
            // If frPtr is at the very beginning, or frMatch is null (meaning no current selection or fresh load)
            // set the pointer to the end of the document to start searching backwards correctly.
            if (!frMatch || (frPtr.scene === 0 && frPtr.block === 0 && frPtr.offset === 0)) {
                const scenes = frData.revisions[0].scenes;
                if (scenes.length > 0) {
                    const lastScene = scenes[scenes.length - 1];
                    let lastBlockIndex = 0;
                    let lastBlockTextLength = 0;
                    try {
                        const lastSceneBlocks = JSON.parse(lastScene.text).blocks;
                        if (lastSceneBlocks && lastSceneBlocks.length > 0) {
                            lastBlockIndex = lastSceneBlocks.length - 1;
                            lastBlockTextLength = lastSceneBlocks[lastBlockIndex].text ? lastSceneBlocks[lastBlockIndex].text.length : 0;
                        }
                    } catch(e) { /* ignore parse error for setting pointer */ }
                    frPtr = { scene: scenes.length - 1, block: lastBlockIndex, offset: lastBlockTextLength };
                }
            }

            const match = findPreviousMatch(pattern, useRegex, showAppToast);
            displayMatchText(currentMatchDisplay, match);
            if (!match && frPtr.scene < 0) { // To indicate start of search
                 showAppToast('Reached beginning of document.', false);
            }
        });
    }

    const replaceNextBtn = document.getElementById('replaceNextBtn');
    if (replaceNextBtn) {
        replaceNextBtn.addEventListener('click', () => {
            if (!frData || !frMatch) {
                showAppToast('No current match to replace. Use "Find Next" first.', true); return;
            }
            try {
                const replacementText = replaceTextInput.value;
                const scene = frData.revisions[0].scenes[frMatch.sceneIndex];
                const parsedText = JSON.parse(scene.text); //
                const targetBlock = parsedText.blocks[frMatch.blockIndex];
                
                const originalBlockText = targetBlock.text || '';
                const textBeforeMatch = originalBlockText.substring(0, frMatch.matchIndex);
                const textAfterMatch = originalBlockText.substring(frMatch.matchIndex + frMatch.matchLength);
                
                targetBlock.text = textBeforeMatch + replacementText + textAfterMatch;
                scene.text = JSON.stringify(parsedText);

                showAppToast('Match replaced.', false);
                
                // Adjust pointer for next find based on the length of the replacement
                frPtr.offset = frMatch.matchIndex + replacementText.length; 
                frMatch = null; // Clear current match, force findNext to search from new pointer
                
                // Automatically find next
                const pattern = findPatternInput.value;
                const useRegex = useRegexCheckbox.checked;
                const nextMatchToShow = findNextMatch(pattern, useRegex, showAppToast);
                displayMatchText(currentMatchDisplay, nextMatchToShow);
                 if (!nextMatchToShow && frPtr.scene >= frData.revisions[0].scenes.length) {
                    showAppToast('Reached end of document.', false);
                }

            } catch (err) {
                showAppToast(err.message || 'Error replacing text.', true);
                console.error("Replace Next Error:", err);
            }
        });
    }

    const replaceAllBtn = document.getElementById('replaceAllBtn');
    if (replaceAllBtn) {
        replaceAllBtn.addEventListener('click', () => {
            if (!frData) {
                showAppToast('Upload a backup file first.', true); return;
            }
            const findPattern = findPatternInput.value;
            const replacementText = replaceTextInput.value;
            const useRegex = useRegexCheckbox.checked;

            if (!findPattern && !useRegex) { // Allow empty find pattern only if it's a regex (e.g. ^ for start of line)
                showAppToast('Enter a find pattern.', true); return;
            }
            toggleAppSpinner(true);
            try {
                const rev = frData.revisions[0];
                let replacementsCount = 0;
                const replacerRegex = useRegex ? new RegExp(findPattern, 'g') : null;

                rev.scenes.forEach(scene => {
                    try {
                        const sceneContent = JSON.parse(scene.text);
                        sceneContent.blocks.forEach(block => {
                            if (block.type === 'text' && typeof block.text === 'string') {
                                let originalText = block.text;
                                if (useRegex) {
                                    block.text = block.text.replace(replacerRegex, (match) => {
                                        replacementsCount++;
                                        return replacementText; // Simple replacement, not handling regex groups here
                                    });
                                } else {
                                    // Count occurrences for non-regex replace
                                    let tempText = block.text;
                                    let count = 0;
                                    let pos = tempText.indexOf(findPattern);
                                    while(pos !== -1){
                                        count++;
                                        pos = tempText.indexOf(findPattern, pos + findPattern.length);
                                    }
                                    replacementsCount += count;
                                    block.text = block.text.split(findPattern).join(replacementText);
                                }
                            }
                        });
                        scene.text = JSON.stringify(sceneContent);
                    } catch (e) {
                        console.warn(`Error processing scene "${scene.title}" during Replace All:`, e);
                    }
                });

                const now = Date.now();
                frData.last_update_date = now;
                frData.last_backup_date = now;
                rev.date = now;
                // Consider updating word count if it's important for Replace All
                // recalculateWordCount(frData); 

                const blob = new Blob([JSON.stringify(frData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${frData.title.replace(/[^a-z0-9_\-\s]/gi, '_').replace(/\s+/g, '_') || 'replaced_backup'}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showAppToast(`Replaced ${replacementsCount} occurrence(s). Download started.`);
                
                // Reset F&R state after replace all & download
                frMatch = null;
                frPtr = { scene: 0, block: 0, offset: 0 };
                displayMatchText(currentMatchDisplay, null);

            } catch (err) {
                showAppToast(err.message || 'Error during Replace All.', true);
                console.error("Replace All Error:", err);
            } finally {
                toggleAppSpinner(false);
            }
        });
    }
} // End of initializeBackupUtility