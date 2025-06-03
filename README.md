# Novelist Tools

Novelist Tools is a suite of offline-first, browser-based utilities designed to assist authors and writers with common tasks related to EPUB manipulation and novel backup management. As a Progressive Web App (PWA), it can be installed on your desktop or mobile device for easy access and offline use.

## Key Features

*   **EPUB Chapter Splitter:** Extract chapters from EPUB files into individual text files.
*   **Novel Backup Utility:** Create, extend, merge, and perform find & replace operations on novel backup files (JSON/.nov format).
*   **ZIP to EPUB Converter:** Convert a collection of text files (chapters in a ZIP) into a structured EPUB file.
*   **EPUB to ZIP (TXT) Converter:** Extract chapters from an EPUB into a ZIP archive of plain text files.

## Detailed Feature Breakdown

### 1. EPUB Chapter Splitter

This tool allows you to take an EPUB file and break it down into separate text files, making it easier to work with individual chapters or sections.

*   **Functionality:**
    *   Upload an `.epub` file.
    *   Extracts chapter content based on EPUB structure or heading tags.
*   **Key Options:**
    *   **Output Mode:**
        *   `Single Chapter per File`: Each detected chapter becomes a separate `.txt` file.
        *   `Grouped Chapters per File`: Combine a specified number of chapters into a single `.txt` file.
    *   **Chapter Prefix:** A custom text string to prepend to each output filename (e.g., "MyNovel_Ch").
    *   **Start Number:** The number to begin chapter filenames with (e.g., if set to 1, files will be `prefix1.txt`, `prefix2.txt`, etc.).
    *   **Offset (skip chapters):** Number of initial chapters in the EPUB to ignore/skip.
    *   **Chapters per File (for Grouped Mode):** How many chapters to include in each grouped text file.
*   **Output:** A `.zip` file containing the extracted text files.

### 2. Novel Backup Utility

This versatile tool helps you manage your novel's content in a structured JSON format (files can be `.json` or `.nov`). It's designed to be compatible with certain novel writing software that uses this specific JSON structure.

#### a. Create New Backup File

*   **Functionality:** Generates a new, empty novel backup file with a predefined structure.
*   **Key Options:**
    *   **Project Title:** The title of your novel.
    *   **Description:** A brief description of the project.
    *   **Unique Code (Optional):** A unique identifier for the backup; auto-generated if left blank.
    *   **Number of Chapters:** How many empty chapter entries to create.
    *   **Prefix for Chapter Titles:** Text to use before the chapter number in titles (e.g., "Chapter ").
    *   **Show Table of Contents:** (Boolean) A metadata flag in the JSON.
    *   **Automatic Indentation:** (Boolean) A metadata flag in the JSON.
*   **Output:** A downloadable `.json` backup file.

#### b. Create Backup from ZIP

*   **Functionality:** Converts a ZIP archive containing individual chapter `.txt` files into the structured JSON backup format.
*   **Key Options:**
    *   **Upload ZIP File:** A `.zip` file where each `.txt` file represents a chapter. Files are sorted numerically/alphabetically to determine chapter order.
    *   **Project Title, Description, Unique Code (Optional).**
    *   **Show Table of Contents, Automatic Indentation.**
*   **Output:** A downloadable `.json` backup file created from your text chapters.

#### c. Extend Existing Backup File

*   **Functionality:** Adds more empty chapter slots to an existing novel backup file.
*   **Key Options:**
    *   **Upload Backup File:** Your existing `.json`, `.txt` (if JSON), or `.nov` backup file.
    *   **Extra Empty Chapters:** The number of new empty chapters to append.
    *   **Prefix for New Chapters:** Text to use for the titles of the newly added chapters.
*   **Output:** A new, extended `.json` backup file.

#### d. Merge Backup Files

*   **Functionality:** Combines multiple novel backup files into a single, new backup file.
*   **Key Options:**
    *   **Merged Project Title & Description.**
    *   **Upload Backup Files:** Select one or more `.json`, `.txt` (if JSON), or `.nov` files to merge. Chapters are appended in the order the files are processed (typically selection order).
    *   **Prefix for Chapters:** A prefix for re-numbering/re-titling all chapters in the merged file.
*   **Output:** A new, merged `.json` backup file.

#### e. Find & Replace

*   **Functionality:** Perform text search and replace operations within the content of a novel backup file.
*   **Key Options:**
    *   **Upload Backup File:** The `.json`, `.txt` (if JSON), or `.nov` file to search within.
    *   **Find Pattern:** The text or regular expression to search for.
    *   **Replacement Text:** The text to replace matches with.
    *   **Use Regular Expressions:** Checkbox to enable regex mode for the find pattern.
    *   **Navigation:** `Find Previous`, `Find Next` buttons.
    *   **Replacement:** `Replace This` (replaces the current highlighted match and finds next), `Replace All & Download` (replaces all occurrences and initiates download of the modified file).
    *   **Context Display:** Shows the line containing the current match.
*   **Output (for Replace All):** A modified `.json` backup file.

### 3. ZIP to EPUB Converter

This tool takes a ZIP archive containing your novel's chapters as plain text files and converts them into a valid EPUB file.

*   **Functionality:**
    *   Assembles `.txt` files from a ZIP into an EPUB structure.
    *   Generates necessary EPUB components like `content.opf`, `toc.ncx`, `nav.xhtml`.
*   **Key Options:**
    *   **Upload ZIP File:** A `.zip` containing `.txt` files for chapters (sorted numerically/alphabetically).
    *   **EPUB Title:** The title of your book.
    *   **Author:** The author's name.
    *   **Language Code:** Standard language code (e.g., "en", "es").
    *   **Cover Image (Optional):** Upload a JPG or PNG image to be used as the EPUB cover.
*   **Output:** A downloadable `.epub` file (EPUB 3 with EPUB 2 compatibility for Table of Contents).

### 4. EPUB to ZIP (TXT) Converter

This tool extracts the textual content of chapters from an EPUB file and packages them as individual `.txt` files within a ZIP archive.

*   **Functionality:**
    *   Parses an EPUB file to identify and extract chapter content.
    *   Converts chapter HTML to plain text.
*   **Key Options:**
    *   **Upload EPUB File:** The `.epub` file you want to process.
    *   **Remove initial lines from chapters:** If checked, allows you to specify a number of lines to be removed from the beginning of each extracted chapter's text. This can be useful for stripping boilerplate headers or titles repeated in each chapter file.
*   **Output:** A `.zip` file containing `.txt` files, one for each extracted chapter.

## PWA & Offline Capability

Novelist Tools is built as a Progressive Web App (PWA). This means:

*   **Installable:** You can install the app on your desktop (via Chrome/Edge) or mobile device for a native-like experience. Look for an "Install" button or an option in your browser's menu.
*   **Offline Use:** Once installed, the core functionalities of the app are available even without an internet connection, as essential files are cached locally.

## Getting Started

1.  Open the Novelist Tools web application in your browser.
2.  (Optional) Install the application for offline use.
3.  Select the desired tool from the sidebar menu or the home dashboard.
4.  Follow the on-screen instructions and options for each tool.
5.  Upload your files as required and click the action buttons (e.g., "Split EPUB", "Generate Backup", "Create EPUB").
6.  Download the processed files.

---
