/**
 * Bookmark Parser & Processor
 * Handles Chrome HTML/XML parsing, URL Normalization, and Deduplication
 */

const PROTECTED_DOMAINS = [
    'docs.google.com',
    'drive.google.com',
    'notion.so',
    'figma.com',
    'trello.com',
    'slack.com',
    'zoom.us',
    'dropbox.com',
    'github.com'
];

class BookmarkParser {

    static parse(content) {
        console.log("[Parser] Input received, length:", content.length);

        // 1. Try JSON
        try {
            if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
                const data = JSON.parse(content);
                console.log("[Parser] Detected JSON format");
                return this._parseJson(data);
            }
        } catch (e) {
            console.log("[Parser] JSON parse attempt failed, moving to HTML/XML");
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');

        // LOG the document structure for debugging
        console.log("[Parser] DOM parsed. Found <a> tags:", doc.querySelectorAll('a').length);

        const bookmarks = [];

        // 2. Try Netscape / HTML format
        const allLinks = doc.querySelectorAll('a');
        if (allLinks.length > 0) {
            allLinks.forEach(a => {
                const url = a.getAttribute('href');
                if (url && url.startsWith('http')) {
                    bookmarks.push({
                        title: a.textContent.trim() || 'Untitled',
                        url: url,
                        icon: a.getAttribute('icon'),
                        folder: this._findFolderName(a)
                    });
                }
            });
            console.log("[Parser] HTML Processing complete. Found:", bookmarks.length);
            return bookmarks;
        }

        // 3. Try generic XML structure
        console.log("[Parser] HTML empty, trying generic XML selectors...");
        const xmlLinks = doc.querySelectorAll('bookmark, item, link');
        xmlLinks.forEach(item => {
            const url = item.getAttribute('href') || item.getAttribute('url') || item.textContent.trim();
            if (url && url.startsWith('http')) {
                bookmarks.push({
                    title: (item.querySelector('title') || item).textContent.trim() || 'Untitled Link',
                    url: url,
                    icon: null,
                    folder: 'Imported Resource'
                });
            }
        });

        console.log("[Parser] Final count:", bookmarks.length);
        return bookmarks;
    }

    /**
     * Recursive JSON parser for Chrome Bookmark JSON structure
     */
    static _parseJson(data, currentFolder = 'Root') {
        let results = [];
        const children = data.children || (data.roots ? Object.values(data.roots) : []);

        const processNode = (node, folder) => {
            if (node.type === 'url') {
                results.push({
                    title: node.name,
                    url: node.url,
                    icon: null,
                    folder: folder
                });
            } else if (node.type === 'folder' || node.children) {
                const nextFolder = node.name || folder;
                (node.children || []).forEach(child => processNode(child, nextFolder));
            }
        };

        if (Array.isArray(children)) {
            children.forEach(child => processNode(child, currentFolder));
        } else {
            processNode(data, currentFolder);
        }

        return results;
    }

    /**
     * Normalizes and Deduplicates bookmarks
     * @param {Array} bookmarks 
     */
    static process(bookmarks) {
        const seen = new Set();
        const categories = {};

        bookmarks.forEach(book => {
            const normalized = this._normalizeUrl(book.url);

            // Deduplicate based on normalized URL
            if (seen.has(normalized)) return;
            seen.add(normalized);

            // Group by Folder
            const category = book.folder || 'Uncategorized';
            if (!categories[category]) categories[category] = [];

            categories[category].push({
                ...book,
                displayUrl: normalized
            });
        });

        return categories;
    }

    /**
     * URL Normalization Logic
     */
    static _normalizeUrl(urlStr) {
        try {
            const url = new URL(urlStr);
            const host = url.hostname.toLowerCase();

            // Check if domain is protected
            const isProtected = PROTECTED_DOMAINS.some(d => host.includes(d));

            if (isProtected) {
                return url.href; // Keep full URL
            }

            // Otherwise, strip everything after domain
            return `${url.protocol}//${url.hostname}`;
        } catch (e) {
            return urlStr;
        }
    }

    /**
     * Helper to find the folder name for a given link element
     */
    static _findFolderName(el) {
        // In Netscape format, folders are defined by <H3> tags inside <DL>
        // We look for the nearest preceding H3
        // Find the nearest DL parent
        const dl = el.closest('dl');
        if (!dl) return 'Other Bookmarks';

        // The folder title is usually in an H3 inside a DT that is the 
        // previous sibling of this DL
        const dt = dl.previousElementSibling;
        if (dt && dt.tagName === 'DT') {
            const h3 = dt.querySelector('h3');
            if (h3) return h3.textContent;
        }

        // Fallback: search up the DOM tree for any preceding H3
        let current = el;
        while (current) {
            const h3 = current.querySelector('h3');
            if (h3) return h3.textContent;
            current = current.parentElement;
        }

        return 'Other Bookmarks';
    }
}
