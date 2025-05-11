// js/epub-to-zip.js

// --- State Variables (module-scoped) ---
let currentZipInstance = null; // Renamed from currentZip to avoid conflict if JSZip is global
let currentTocEntries = [];
let currentOpfDirPath = '';
let currentEpubFilename = '';
const domParser = new DOMParser(); // Reuse parser instance


// --- Helper Functions (copied or adapted from reference) ---

        /** Reads a File object as an ArrayBuffer using Promises */
        function readFileAsArrayBuffer(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target.result);
                reader.onerror = (error) => reject(new Error(`FileReader error: ${error}`));
                reader.readAsArrayBuffer(file);
            });
        }

        /** Safely reads a file from the JSZip object, handling potential errors */
        async function readFileFromZip(zip, path) {
            // Normalize path: remove leading slashes if any, handle potential encoding? (JSZip usually handles this)
            const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
            const fileEntry = zip.file(normalizedPath);

            if (!fileEntry) {
                 console.error(`File not found in EPUB archive: ${normalizedPath}`);
                 return null; // Indicate failure clearly
            }
            try {
                 // Read file content as a string (UTF-8 assumed by default by JSZip)
                 const content = await fileEntry.async('string');
                 return { path: normalizedPath, content: content }; // Return path and content
            } catch (err) {
                 console.error(`Error reading file "${normalizedPath}" from zip:`, err);
                 return null; // Indicate failure
            }
         }

        /** Parses an XML string, returns a DOM Document or null on error */
        function parseXml(xmlString, sourceFileName = 'XML') {
            try {
                const doc = domParser.parseFromString(xmlString, 'application/xml');
                // Standard check for parser errors in XML
                const errorNode = doc.querySelector('parsererror');
                if (errorNode) {
                    console.error(`XML Parsing Error in ${sourceFileName}:`, errorNode.textContent);
                    // Try to log the problematic XML snippet if possible/short
                    // console.error("Source XML snippet:", xmlString.substring(0, 500));
                    return null; // Indicate parsing failure
                }
                return doc; // Success
            } catch (e) {
                console.error(`Exception during XML parsing of ${sourceFileName}:`, e);
                return null; // Indicate failure due to exception
            }
        }

        /** Parses an HTML string, returns a DOM Document or null on error */
        function parseHtml(htmlString, sourceFileName = 'HTML') {
             try {
                 // Use 'text/html' parser, which is more lenient for potentially non-XHTML NAV files
                const doc = domParser.parseFromString(htmlString, 'text/html');
                 // HTML parser is forgiving; check if we got a minimal structure at least
                 if (!doc || (!doc.body && !doc.documentElement)) {
                     console.warn(`Parsed HTML for ${sourceFileName} seems empty or invalid.`);
                     // Depending on requirements, might return null or the potentially empty doc
                     // Returning the doc allows downstream checks like querySelector to fail gracefully
                 }
                 // Note: HTML parser often doesn't produce a <parsererror> node like XML
                return doc; // Return the document, even if potentially minimal/empty
             } catch (e) {
                 console.error(`Exception during HTML parsing of ${sourceFileName}:`, e);
                 return null; // Indicate failure due to exception
             }
         }

                 /**
         * Extracts and cleans text content from an HTML string,
         * attempting to preserve paragraph breaks (double newline) and line breaks (single newline).
         */
        function extractTextFromHtml(htmlString) {
            try {
                // Define unique markers unlikely to appear in actual text content.
                // Add spaces around them to prevent accidental merging with words.
                const PARA_BREAK_MARKER = " \uE000P\uE000 "; // Using Private Use Area Unicode characters
                const LINE_BREAK_MARKER = " \uE000L\uE000 ";

                // 1. Pre-process HTML: Insert markers strategically
                let processedHtml = htmlString;

                // Replace closing tags of common block elements with a paragraph break marker.
                // Include optional whitespace (\s*) after the closing tag.
                processedHtml = processedHtml.replace(/<\/(p|h[1-6]|div|li|blockquote|pre|section|article|aside|header|footer|nav|figure|figcaption|table|tr|th|td)>\s*/gi, '$&' + PARA_BREAK_MARKER);
                // '$&' inserts the matched closing tag back, ensuring we add the marker *after* it.

                // Replace <br> tags (both <br> and <br/>) with a line break marker.
                processedHtml = processedHtml.replace(/<br\s*\/?>/gi, LINE_BREAK_MARKER);

                // 2. Parse the modified HTML string
                 const doc = domParser.parseFromString(processedHtml, 'text/html'); 
                const body = doc.body;

                if (!body) {
                     console.warn("HTML string appears to lack a <body> tag, attempting fallback.");
                     // Fallback for body-less content - markers might not be present or work as expected.
                     // Use innerText for basic structure preservation if possible.
                     let fallbackText = doc.documentElement?.innerText || doc.documentElement?.textContent || '';
                     return fallbackText.trim();
                }

                // 3. Remove script and style elements AFTER parsing
                body.querySelectorAll('script, style').forEach(el => el.remove());

                // 4. Get the text content - this will include our markers
                // Use textContent here because we want the raw text nodes and our markers,
                // not the formatting interpretation of innerText at this stage.
                let text = body.textContent || "";

                // 5. Post-process the extracted text: Replace markers and normalize whitespace

                // Replace paragraph markers with double newlines
                text = text.replace(new RegExp(PARA_BREAK_MARKER.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '\n\n');
                // Replace line break markers with single newlines
                text = text.replace(new RegExp(LINE_BREAK_MARKER.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '\n');

                 // --- Whitespace Normalization ---
                 // a) Replace multiple spaces/tabs with a single space
                 text = text.replace(/[ \t]+/g, ' ');
                 // b) Trim spaces around newlines (e.g., " \n " becomes "\n")
                 text = text.replace(/ *\n */g, '\n');
                 // c) Collapse multiple consecutive newlines into a maximum of two (handles cases where markers might stack)
                 text = text.replace(/\n{3,}/g, '\n\n');

                // 6. Final trim of leading/trailing whitespace
                return text.trim();

            } catch (e) {
                console.error("Error extracting text from HTML:", e);
                return ''; // Return empty string on error
            }
        }

        /**
         * Resolves a relative path against a base directory path. Robustly handles "../" etc.
         * @param {string} relativePath - The relative path (e.g., from an href).
         * @param {string} baseDirPath - The directory path to resolve against (e.g., OPF directory).
         * @returns {string} The resolved path, relative to the EPUB root.
         */
        function resolvePath(relativePath, baseDirPath) {
            if (!relativePath) return ''; // Handle empty input
             // If baseDirPath is empty or null, assume relativePath is already relative to root
             if (!baseDirPath) {
                return relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
             }

            try {
                 // Use the URL constructor for robust path resolution.
                 // Create a dummy base URL ending with '/' to represent the directory.
                 // Using 'file:///' as a base scheme.
                 const baseUrl = `file:///${baseDirPath}/`;
                 // Resolve the relative path against the base URL
                 const resolvedUrl = new URL(relativePath, baseUrl);
                 // Get the pathname, which will include the base path + resolved relative path.
                 // Remove the leading '/' that 'file:///' adds.
                 let resolved = resolvedUrl.pathname.substring(1);
                 // Decode URI components that might have been encoded (e.g., spaces to %20)
                 return decodeURIComponent(resolved);
            } catch (e) {
                 console.error(`Error resolving path: relative="${relativePath}", base="${baseDirPath}"`, e);
                 // Fallback: simple concatenation (less reliable for complex paths like '../')
                 // Ensure no double slashes
                 const simplePath = (baseDirPath + '/' + relativePath).replace(/\/+/g, '/');
                 console.warn(`Falling back to simple path concatenation: ${simplePath}`);
                 return simplePath;
            }
         }

            function sanitizeFilenameForZip(name) { // <<<< MAKE SURE THE NAME IS EXACTLY THIS
                if (!name) return 'download'; 
                let sanitized = name.replace(/[^\p{L}\p{N}._-]+/gu, '_');
                sanitized = sanitized.replace(/__+/g, '_');
                sanitized = sanitized.replace(/^[_.-]+|[_.-]+$/g, '');
                sanitized = sanitized.substring(0, 100); // Limit length for the chapter part
                return sanitized || 'file';
            }


        /** Triggers a browser download for a given Blob object and filename */
        function triggerBrowserDownload(blob, filename) {
            const link = document.createElement('a'); // Create temporary link element
            const url = URL.createObjectURL(blob); // Create a URL for the Blob

            link.href = url;
            link.download = filename; // Set the desired download filename
            document.body.appendChild(link); // Append link to body (required for Firefox)
            link.click(); // Programmatically click the link to trigger download

            // Clean up: remove the link and revoke the object URL
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

         /** Simple asynchronous delay utility */
         function delay(ms) {
             return new Promise(resolve => setTimeout(resolve, ms));
         }

        /**
         * Finds the path to the OPF file from META-INF/container.xml.
         * @param {JSZip} zip
         * @returns {Promise<{path: string, dir: string} | null>} Object with full path and directory, or null on error.
         */
        async function findOpfPath(zip) {
            const containerPath = 'META-INF/container.xml';
            const containerContent = await readFileFromZip(zip, containerPath);
            if (!containerContent) return null; // Error logged within readFileFromZip

            const containerDoc = parseXml(containerContent.content, containerPath);
            if (!containerDoc) return null; // Error logged within parseXml

            const rootfileElement = containerDoc.querySelector('rootfile[full-path]');
            const rootfilePath = rootfileElement?.getAttribute('full-path');

            if (!rootfilePath) {
                console.error('Cannot find rootfile[full-path] attribute in container.xml');
                return null;
            }

            // Determine the directory containing the OPF file
            const opfDir = rootfilePath.includes('/') ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/')) : '';
            return { path: rootfilePath, dir: opfDir };
        }

        /**
         * Finds the ToC file reference (NAV or NCX) within the parsed OPF document.
         * @param {XMLDocument} opfDoc - Parsed OPF XML document.
         * @returns {{href: string, type: 'nav' | 'ncx'} | null} Info about the ToC file or null if not found.
         */
        function findTocHref(opfDoc) {
            // Priority 1: EPUB 3 NAV document
            // Look for manifest item with 'nav' property
            const navItem = opfDoc.querySelector('manifest > item[properties~="nav"]'); // Use ~= to handle space-separated list
            if (navItem) {
                const href = navItem.getAttribute('href');
                if (href) {
                    console.log("Found EPUB3 NAV ToC reference:", href);
                    return { href: href, type: 'nav' };
                }
            }

            // Priority 2: EPUB 2 NCX file
            // Look for the 'toc' attribute on the <spine> element, which points to the manifest ID
            const spineTocAttr = opfDoc.querySelector('spine[toc]');
            if (spineTocAttr) {
                const ncxId = spineTocAttr.getAttribute('toc');
                if (ncxId) {
                    // Find the manifest item with that ID
                    const ncxItem = opfDoc.querySelector(`manifest > item[id="${ncxId}"]`);
                    if (ncxItem) {
                        const href = ncxItem.getAttribute('href');
                        if (href) {
                            console.log("Found EPUB2 NCX ToC reference:", href);
                            return { href: href, type: 'ncx' };
                        }
                    }
                }
            }

            // No standard ToC found
            return null;
        }

        /**
         * Extracts chapter titles and hrefs from a parsed NCX document.
         * @param {XMLDocument} ncxDoc - Parsed NCX XML document.
         * @param {string} baseDir - The directory of the OPF file for resolving relative paths.
         * @returns {Array<{title: string, href: string}>}
         */
        function extractChaptersFromNcx(ncxDoc, baseDir) {
            const chapters = [];
            // Select all <navPoint> elements within the <navMap>
            const navPoints = ncxDoc.querySelectorAll('navMap navPoint');
            navPoints.forEach(point => {
                const label = point.querySelector('navLabel > text')?.textContent.trim();
                const contentSrc = point.querySelector('content')?.getAttribute('src');
                if (label && contentSrc) {
                    // Resolve the path relative to the OPF directory
                    // Remove URL fragment (e.g., #section1) as we want the whole file
                    const href = resolvePath(contentSrc.split('#')[0], baseDir);
                    chapters.push({ title: label, href: href });
                }
            });
            return chapters;
        }

        /**
         * Extracts chapter titles and hrefs from a parsed NAV HTML document.
         * @param {Document} navDoc - Parsed NAV HTML document.
         * @param {string} baseDir - The directory of the OPF file for resolving relative paths.
         * @returns {Array<{title: string, href: string}>}
         */
        function extractChaptersFromNav(navDoc, baseDir) {
            const chapters = [];
            // Try common structures for the main ToC list in NAV documents
            // 1. Standard: <nav epub:type="toc"> <ol> ... </ol> </nav>
            // 2. Common fallback: <nav id="toc"> or <nav class="toc">
            let tocList = navDoc.querySelector('nav[epub\\:type="toc"] ol, nav#toc ol, nav.toc ol');

            // 3. Less specific fallback if the above fail (might grab other lists)
            if (!tocList && navDoc.body) {
                 tocList = navDoc.body.querySelector('ol'); // Look for the first <ol> in the body
                 if (tocList) console.warn("Using generic 'ol' fallback for NAV ToC list.");
            }

            if (tocList) {
                // Get direct children links ('> li > a') to avoid nested lists (like sub-chapters within a single entry)
                 // Use :scope to ensure we query only direct children of the found tocList
                const links = tocList.querySelectorAll(':scope > li > a[href]'); // Ensure link has an href
                links.forEach(link => {
                    // Clean up whitespace in the label
                    const label = link.textContent.replace(/\s+/g, ' ').trim();
                    const rawHref = link.getAttribute('href');
                    if (label && rawHref) {
                         // Resolve the path relative to the OPF directory
                         // Remove URL fragment (e.g., #section1)
                         const href = resolvePath(rawHref.split('#')[0], baseDir);
                         chapters.push({ title: label, href: href });
                    }
                });
            } else {
                 console.warn("Could not find a suitable <ol> list within the NAV document for the Table of Contents.");
            }
            return chapters;
        }

        /**
         * Removes duplicate chapter entries based on the resolved href.
         * @param {Array<{title: string, href: string}>} chapters - The raw list of chapters.
         * @returns {Array<{title: string, href: string}>} - The list with duplicates removed.
         */
        function deduplicateChapters(chapters) {
            const uniqueChapters = [];
            const seenHrefs = new Set();
            for (const chapter of chapters) {
                // Check if href is valid and hasn't been seen before
                if (chapter.href && !seenHrefs.has(chapter.href)) {
                    uniqueChapters.push(chapter);
                    seenHrefs.add(chapter.href);
                } else if (seenHrefs.has(chapter.href)) {
                     console.log(`Duplicate chapter href found and removed: ${chapter.href} (Title: ${chapter.title})`);
                } else {
                     console.warn(`Chapter entry skipped due to missing href: (Title: ${chapter.title})`);
                }
            }
            return uniqueChapters;
        }



/**
 * Orchestrates finding the OPF, parsing ToC, and returning chapter entries.
 * (Adapted from reference app's parseTocForChapters)
 */
async function getChapterListFromEpub(zip, updateAppStatus) {
    currentOpfDirPath = ''; // Reset for current EPUB
    currentTocEntries = [];

    const opfPathData = await findOpfPath(zip); // findOpfPath will use local helpers
    if (!opfPathData) {
        updateAppStatus("Error: Could not find EPUB's OPF file.", true);
        return [];
    }
    currentOpfDirPath = opfPathData.dir;

    const opfContentFile = await readFileFromZip(zip, opfPathData.path);
    if (!opfContentFile) {
        updateAppStatus(`Error: Could not read OPF file at ${opfPathData.path}`, true);
        return [];
    }
    const opfDoc = parseXml(opfContentFile.content, opfContentFile.path);
    if (!opfDoc) {
        updateAppStatus(`Error: Could not parse OPF XML at ${opfPathData.path}`, true);
        return [];
    }

    const tocInfo = findTocHref(opfDoc);
    if (!tocInfo) {
        updateAppStatus("Warning: No standard Table of Contents (NAV/NCX) link found in OPF.", true);
        return [];
    }

    const tocFullPath = resolvePath(tocInfo.href, currentOpfDirPath);
    const tocContentFile = await readFileFromZip(zip, tocFullPath);
    if (!tocContentFile) {
        updateAppStatus(`Error: ToC file not found at ${tocFullPath}`, true);
        return [];
    }

    let chapters;
    if (tocInfo.type === 'ncx') {
        const ncxDoc = parseXml(tocContentFile.content, tocContentFile.path);
        chapters = ncxDoc ? extractChaptersFromNcx(ncxDoc, currentOpfDirPath) : [];
        if (!ncxDoc) updateAppStatus(`Error: Could not parse NCX file XML at ${tocContentFile.path}`, true);
    } else { // nav
        const navDoc = parseHtml(tocContentFile.content, tocContentFile.path);
        chapters = navDoc ? extractChaptersFromNav(navDoc, currentOpfDirPath) : [];
        if (!navDoc) updateAppStatus(`Error: Could not parse NAV file HTML at ${tocContentFile.path}`, true);
    }
    
    currentTocEntries = deduplicateChapters(chapters);
    return currentTocEntries;
}


export function initializeEpubToZip(showAppToast, toggleAppSpinner) {
    const fileInput = document.getElementById('epubUploadForTxt');
    const fileNameEl = document.getElementById('epubFileNameForTxt');
    const extractBtn = document.getElementById('extractChaptersBtn');
    const statusEl = document.getElementById('statusMessageEpubToZip');
    const downloadSec = document.getElementById('downloadSectionEpubToZip');
    const downloadLink = document.getElementById('downloadLinkZipFromEpub');

    if (!fileInput || !extractBtn) {
        console.error("EPUB to ZIP UI elements not found.");
        return;
    }

    function updateLocalStatus(message, isError = false) {
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.display = 'block';
            statusEl.className = isError ? 'status error' : 'status success'; // Use your app's classes
        }
        // We can also call showAppToast for more prominent global messages if needed
        if (isError) showAppToast(message, true);
    }
    
    function resetUIState() {
        updateLocalStatus('Select an EPUB file.');
        if (downloadSec) downloadSec.style.display = 'none';
        extractBtn.disabled = true;
        currentZipInstance = null;
        currentTocEntries = [];
        currentOpfDirPath = '';
        currentEpubFilename = '';
        fileInput.value = ''; // Reset file input
    }

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        resetUIState();

        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.epub')) {
            updateLocalStatus('Error: Please select a valid .epub file.', true);
            return;
        }

        currentEpubFilename = file.name;
        fileNameEl.textContent = `Selected: ${file.name}`;
        updateLocalStatus(`Reading ${file.name}...`);
        toggleAppSpinner(true);

        try {
            const arrayBuffer = await readFileAsArrayBuffer(file);
            updateLocalStatus('Unzipping EPUB...');
            currentZipInstance = await JSZip.loadAsync(arrayBuffer);
            
            updateLocalStatus('Parsing Table of Contents...');
            const chapters = await getChapterListFromEpub(currentZipInstance, updateLocalStatus);

            if (chapters.length > 0) {
                updateLocalStatus(`Found ${chapters.length} chapters. Ready to extract.`);
                extractBtn.disabled = false;
            } else {
                if (!statusEl.textContent.toLowerCase().includes('error') && !statusEl.textContent.toLowerCase().includes('warning')) {
                     updateLocalStatus('No chapters found or ToC unparsable.', true);
                }
                // Keep button disabled
            }
        } catch (error) {
            console.error("EPUB selection/parsing Error:", error);
            updateLocalStatus(`Error: ${error.message || 'Could not process EPUB.'}`, true);
            resetUIState();
        } finally {
            toggleAppSpinner(false);
        }
    });

    extractBtn.addEventListener('click', async () => {
        if (!currentZipInstance || currentTocEntries.length === 0) {
            updateLocalStatus("Cannot extract: No EPUB loaded or no chapters found.", true);
            return;
        }

        extractBtn.disabled = true;
        extractBtn.textContent = 'Extracting...';
        toggleAppSpinner(true);

        const outputZip = new JSZip();
        let filesAdded = 0;
        const totalChapters = currentTocEntries.length;

        try {
            updateLocalStatus(`Starting chapter extraction (0/${totalChapters})...`);

            for (let i = 0; i < totalChapters; i++) {
                const entry = currentTocEntries[i];
                const chapterIndex = String(i + 1).padStart(2, '0');
                updateLocalStatus(`Processing chapter ${i + 1}/${totalChapters}: ${entry.title.substring(0,30)}...`);

                const chapterFile = currentZipInstance.file(entry.href); // entry.href is already resolved
                if (!chapterFile) {
                    console.warn(`Chapter file not found in EPUB: ${entry.href}`);
                    continue;
                }

                const chapterHtml = await chapterFile.async("string");
                const chapterText = extractTextFromHtml(chapterHtml);

                if (chapterText && chapterText.trim().length > 0) {
                    const txtFilename = `C${chapterIndex}.txt`; 
                    outputZip.file(txtFilename, chapterText);
                    filesAdded++;
                } else {
                    console.warn(`No text content extracted from: ${entry.href}`);
                }
                await delay(5); // Allow UI update
            }

            if (filesAdded > 0) {
                updateLocalStatus(`Generating ZIP file with ${filesAdded} chapters...`);
                const zipBlob = await outputZip.generateAsync({ type: "blob", compression: "DEFLATE" });
                
                const downloadFilenameBase = currentEpubFilename.replace(/\.epub$/i, '') || 'epub_content';
                triggerBrowserDownload(zipBlob, `${sanitizeFilenameForZip(downloadFilenameBase)}.zip`);
                
                updateLocalStatus(`Download started (${filesAdded}/${totalChapters} chapters).`);
                if (downloadSec && downloadLink) { // Show download link (though direct trigger is used)
                    downloadLink.href = URL.createObjectURL(zipBlob); // For potential re-download
                    downloadLink.download = `${sanitizeFilenameForZip(downloadFilenameBase)}_chapters.zip`;
                    downloadSec.style.display = 'block';
                }

            } else {
                updateLocalStatus("Extraction complete, but no chapter content was retrieved.", true);
            }

        } catch (err) {
            console.error("Error during chapter extraction or ZIP creation:", err);
            updateLocalStatus(`Error: ${err.message}`, true);
        } finally {
            extractBtn.disabled = false;
            extractBtn.textContent = 'Extract Chapters to ZIP';
            toggleAppSpinner(false);
        }
    });


}