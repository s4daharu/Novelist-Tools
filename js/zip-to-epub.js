// js/zip-to-epub.js

// Helper: Generate a UUID (simple version)
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Helper: Sanitize string for use in XML IDs or filenames
function sanitizeForXML(str) {
    if (!str) return '';
    return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Helper: Convert plain text to basic XHTML for a chapter
function textToXHTML(text, chapterTitle) {
    let bodyContent = `<h2>${escapeHTML(chapterTitle)}</h2>\n`;
    const paragraphs = text.replace(/\r\n/g, '\n').split(/\n\n+/); // Split by one or more blank lines
    paragraphs.forEach(p => {
        const trimmedP = p.trim();
        if (trimmedP) {
            bodyContent += `    <p>${escapeHTML(trimmedP)}</p>\n`;
        }
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head>
  <title>${escapeHTML(chapterTitle)}</title>
  <link rel="stylesheet" type="text/css" href="../css/style.css" /> 
</head>
<body>
  <section epub:type="chapter">\n${bodyContent}  </section>
</body>
</html>`;
}

function escapeHTML(str) {
    if (typeof str !== 'string') { // Add a type check for robustness
        return '';
    }
    return str.replace(/[&<>"']/g, function (match) {
        return {
            '&': '&amp;',  // Corrected: was '&'
            '<': '&lt;',   // Corrected: was '<'
            '>': '&gt;',   // Corrected: was '>'
            '"': '&quot;', // Corrected: was '"'
            "'": '&#39;'   // Corrected: was ''' 
        }[match];
    });
}


export function initializeZipToEpub(showAppToast, toggleAppSpinner) {
    const zipUploadInput = document.getElementById('zipUploadForEpub');
    const zipFileNameEl = document.getElementById('zipFileNameForEpub');
    const epubTitleInput = document.getElementById('epubTitle');
    const epubAuthorInput = document.getElementById('epubAuthor');
    const epubLangInput = document.getElementById('epubLanguage');
    const epubCoverImageInput = document.getElementById('epubCoverImage');
    const epubCoverFileNameEl = document.getElementById('epubCoverFileName');
    const createBtn = document.getElementById('createEpubBtn');
    const statusEl = document.getElementById('statusMessageZipToEpub');
    const downloadSec = document.getElementById('downloadSectionZipToEpub');
    const downloadLink = document.getElementById('downloadLinkEpub');

    let selectedZipFile = null;
    let selectedCoverFile = null;

    if (!zipUploadInput || !createBtn) {
        console.error("ZIP to EPUB UI elements not found. Initialization failed.");
        return;
    }

    zipUploadInput.addEventListener('change', e => {
        selectedZipFile = e.target.files[0];
        if (selectedZipFile) {
            zipFileNameEl.textContent = `Selected ZIP: ${selectedZipFile.name}`;
            createBtn.disabled = false;
            if (statusEl) statusEl.style.display = 'none';
            if (downloadSec) downloadSec.style.display = 'none';
        } else {
            zipFileNameEl.textContent = '';
            createBtn.disabled = true;
        }
    });

    epubCoverImageInput.addEventListener('change', e => {
        selectedCoverFile = e.target.files[0];
        if (selectedCoverFile) {
            epubCoverFileNameEl.textContent = `Cover: ${selectedCoverFile.name}`;
        } else {
            epubCoverFileNameEl.textContent = '';
        }
    });

    createBtn.addEventListener('click', async () => {
        if (!selectedZipFile) {
            showAppToast("Please upload a ZIP file containing chapter .txt files.", true);
            return;
        }

        const title = epubTitleInput.value.trim() || "Untitled EPUB";
        const author = epubAuthorInput.value.trim() || "Unknown Author";
        const language = epubLangInput.value.trim() || "en";
        const bookUUID = `urn:uuid:${generateUUID()}`;

        toggleAppSpinner(true);
        if (statusEl) statusEl.style.display = 'none';
        if (downloadSec) downloadSec.style.display = 'none';

        try {
            const epubZip = new JSZip();

            // 1. mimetype file (must be first and uncompressed)
            epubZip.file("mimetype", "application/epub+zip", { compression: "STORE" });

            // 2. META-INF/container.xml
            const containerXML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
            epubZip.folder("META-INF").file("container.xml", containerXML);

            const oebps = epubZip.folder("OEBPS");
            const cssFolder = oebps.folder("css");
            const textFolder = oebps.folder("text"); // For chapter xhtml files
            const imagesFolder = oebps.folder("images");

            // 3. Basic CSS (style.css)
            const basicCSS = `body { font-family: sans-serif; line-height: 1.5; margin: 1em; }
h1, h2, h3 { text-align: center; }
p { text-indent: 1.5em; margin-top: 0; margin-bottom: 0.5em; }
.cover { text-align: center; margin-top: 20%; }
.cover img { max-width: 80%; max-height: 80vh; }`;
            cssFolder.file("style.css", basicCSS);

            // 4. Process Chapters from input ZIP
            const contentZip = await JSZip.loadAsync(selectedZipFile);
            const chapterPromises = [];
            contentZip.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir && zipEntry.name.toLowerCase().endsWith('.txt')) {
                    chapterPromises.push(
                        zipEntry.async('string').then(text => ({
                            name: zipEntry.name,
                            originalName: relativePath, // Keep original name for sorting if needed
                            content: text
                        }))
                    );
                }
            });

            let chapters = await Promise.all(chapterPromises);
            if (chapters.length === 0) {
                throw new Error("No .txt files found in the uploaded ZIP.");
            }

            // Sort chapters by filename (natural sort)
            chapters.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

            const manifestItems = [
                { id: "css", href: "css/style.css", "media-type": "text/css" },
                { id: "nav", href: "nav.xhtml", "media-type": "application/xhtml+xml", properties: "nav" }
            ];
            const spineItems = [];
            const navLiItems = [];
            // Optional: toc.ncx items
            const ncxNavPoints = [];
            let playOrder = 1;

            // 5. Cover Page (if provided)
            let coverImageFilename = null;
            let coverXHTMLAdded = false;
            if (selectedCoverFile) {
                const coverExt = selectedCoverFile.name.split('.').pop().toLowerCase();
                coverImageFilename = `cover.${coverExt}`;
                const coverMediaType = coverExt === 'jpg' || coverExt === 'jpeg' ? 'image/jpeg' : 'image/png';
                
                const coverImageData = await selectedCoverFile.arrayBuffer();
                imagesFolder.file(coverImageFilename, coverImageData);

                manifestItems.push({ id: "cover-image", href: `images/${coverImageFilename}`, "media-type": coverMediaType, properties: "cover-image" });
                
                const coverXHTMLContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>Cover</title>
  <link rel="stylesheet" type="text/css" href="../css/style.css" />
</head>
<body>
  <section epub:type="cover" class="cover">
    <img src="../images/${coverImageFilename}" alt="Cover Image"/>
  </section>
</body>
</html>`;
                textFolder.file("cover.xhtml", coverXHTMLContent);
                manifestItems.push({ id: "cover-page", href: "text/cover.xhtml", "media-type": "application/xhtml+xml" });
                spineItems.push({ idref: "cover-page", linear: "no" }); // Cover usually non-linear in spine
                // No nav point for cover page usually
                coverXHTMLAdded = true;
            }


            // 6. Generate Chapter XHTML files and TOC entries
            for (let i = 0; i < chapters.length; i++) {
                const chapter = chapters[i];
                const chapterBaseName = sanitizeForXML(chapter.name.replace(/\.txt$/i, '')) || `chapter_${i + 1}`;
                const chapterFilename = `${chapterBaseName}.xhtml`;
                const chapterTitle = chapter.name.replace(/\.txt$/i, '').replace(/_/g, ' '); // Simple title from filename

                const xhtmlContent = textToXHTML(chapter.content, chapterTitle);
                textFolder.file(chapterFilename, xhtmlContent);

                const itemId = `chapter-${i + 1}`;
                manifestItems.push({ id: itemId, href: `text/${chapterFilename}`, "media-type": "application/xhtml+xml" });
                spineItems.push({ idref: itemId, linear: "yes" }); // Ensure linear="yes" for main content
                
                navLiItems.push(`<li><a href="text/${chapterFilename}">${escapeHTML(chapterTitle)}</a></li>`);
                ncxNavPoints.push(`
    <navPoint id="navpoint-${playOrder}" playOrder="${playOrder}">
      <navLabel><text>${escapeHTML(chapterTitle)}</text></navLabel>
      <content src="text/${chapterFilename}"/>
    </navPoint>`);
                playOrder++;
            }

            // 7. Create nav.xhtml (EPUB 3 Navigation Document)
            const navXHTMLContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
      ${navLiItems.join("\n      ")}
    </ol>
  </nav>
  <nav epub:type="landmarks" hidden="hidden">
    <ol>
      ${coverXHTMLAdded ? '<li><a epub:type="cover" href="text/cover.xhtml">Cover</a></li>' : ''}
      <li><a epub:type="toc" href="nav.xhtml">Table of Contents</a></li>
      <li><a epub:type="bodymatter" href="text/${sanitizeForXML(chapters[0].name.replace(/\.txt$/i, '')) || 'chapter_1'}.xhtml">Start Reading</a></li>
    </ol>
  </nav>
</body>
</html>`;
            oebps.file("nav.xhtml", navXHTMLContent);

            // 8. Create toc.ncx (for EPUB 2 compatibility)
            const ncxContent = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookUUID}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeHTML(title)}</text></docTitle>
  <navMap>
    ${ncxNavPoints.join("\n    ")}
  </navMap>
</ncx>`;
            oebps.file("toc.ncx", ncxContent);
            manifestItems.push({ id: "ncx", href: "toc.ncx", "media-type": "application/x-dtbncx+xml" });


            // 9. Create content.opf (Package File)
            let manifestXML = manifestItems.map(item => {
                let props = item.properties ? ` properties="${item.properties}"` : '';
                return `<item id="${item.id}" href="${item.href}" media-type="${item['media-type']}"${props}/>`;
            }).join("\n    ");

            let spineXML = spineItems.map(item => {
                let linearAttr = item.linear ? ` linear="${item.linear}"` : '';
                return `<itemref idref="${item.idref}"${linearAttr}/>`;
            }).join("\n    ");
            // Add ncx to spine for EPUB 2 readers that might look for it, though nav.xhtml is primary for EPUB 3
            // Usually, spine only lists content documents. toc.ncx is not typically in the spine.
            // Spine should point to toc="ncx" in <spine toc="ncx">
            
            const contentOPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="BookId">${bookUUID}</dc:identifier>
    <dc:title>${escapeHTML(title)}</dc:title>
    <dc:language>${language}</dc:language>
    <dc:creator id="creator">${escapeHTML(author)}</dc:creator>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
    ${selectedCoverFile ? '<meta name="cover" content="cover-image"/>' : ''}
  </metadata>
  <manifest>
    ${manifestXML}
  </manifest>
  <spine toc="ncx">
    ${spineXML}
  </spine>
</package>`;
            oebps.file("content.opf", contentOPF);

            // 10. Generate EPUB file
            const epubBlob = await epubZip.generateAsync({
                type: "blob",
                mimeType: "application/epub+zip",
                compression: "DEFLATE" // Default compression
            });

            downloadLink.href = URL.createObjectURL(epubBlob);
            const safeFileName = title.replace(/[^a-z0-9_\-\s]/gi, '_').replace(/\s+/g, '_') || 'generated_epub';
            downloadLink.download = `${safeFileName}.epub`;
            
            if (downloadSec) downloadSec.style.display = 'block';
            if (statusEl) {
                statusEl.textContent = `EPUB "${title}" created successfully with ${chapters.length} chapter(s).`;
                statusEl.className = 'status success';
                statusEl.style.display = 'block';
            }
            showAppToast("EPUB created successfully!");

        } catch (err) {
            console.error("ZIP to EPUB Error:", err);
            if (statusEl) {
                statusEl.textContent = `Error: ${err.message}`;
                statusEl.className = 'status error';
                statusEl.style.display = 'block';
            }
            showAppToast(`Error: ${err.message}`, true);
        } finally {
            toggleAppSpinner(false);
        }
    });
}