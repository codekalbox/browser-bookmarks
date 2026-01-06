/**
 * Global State & Configuration
 */
const state = {
    db: null,
    fullCategories: null, // Stores categorized data for fast searching
    isSearching: false,
    saveTimeout: null // For debounced persistence
};

function initTheme() {
    const theme = localStorage.getItem('curator-theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);

    // Show toggle button once initialized
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.style.display = 'flex';
}

/**
 * Custom High-End Confirmation Modal
 */
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-modal');
        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');

        titleEl.innerText = title;
        messageEl.innerText = message;
        modal.classList.add('active');

        // A11Y: Focus confirm button for immediate keyboard interaction
        setTimeout(() => confirmBtn.focus(), 100);

        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                cleanup(true);
            } else if (e.key === 'Escape') {
                cleanup(false);
            }
        };

        const cleanup = (val) => {
            modal.classList.remove('active');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            window.removeEventListener('keydown', handleKeydown);
            resolve(val);
        };

        confirmBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
        window.addEventListener('keydown', handleKeydown);
    });
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('curator-theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.innerText = theme === 'light' ? '🌙' : '☀️';
    }
}

/**
 * GSAP Preloader Logic
 */
function initPreloader() {
    const tl = gsap.timeline({
        onComplete: () => {
            const preloader = document.getElementById('preloader');
            preloader.classList.add('completed');
            document.body.classList.remove('loading');
        }
    });

    const progressBar = document.getElementById('progress-bar');
    const counter = document.getElementById('percent-counter');
    const status = { val: 0 };

    tl.to(status, {
        val: 100,
        duration: 2.5, // Slower, more premium feel
        ease: "power2.inOut",
        onUpdate: () => {
            const formatted = Math.floor(status.val).toString().padStart(3, '0');
            counter.innerText = `${formatted}%`;
            if (progressBar) {
                progressBar.style.transform = `scaleX(${status.val / 100})`;
            }
        }
    });

    // Catch-up logic for tab switching
    const startTime = Date.now();
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && tl.isActive()) {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 2.5) tl.progress(1);
        }
    });

    tl.to(['.preloader-content', '#percent-counter'], {
        opacity: 0,
        duration: 0.8,
        ease: "power2.in"
    });

    tl.to('.preloader-panel.top', {
        yPercent: -100,
        duration: 1.4,
        ease: "expo.inOut"
    }, "+=0.2");

    tl.to('.preloader-panel.bottom', {
        yPercent: 100,
        duration: 1.4,
        ease: "expo.inOut"
    }, "<");

    tl.from('.site-header', {
        y: -50,
        opacity: 0,
        duration: 1.2,
        ease: "power3.out"
    }, "-=0.4");

    tl.from('.empty-state', {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out"
    }, "-=0.4");
}

/**
 * Persistence & Data Management
 */
const DB_NAME = 'LinkCuratorDB';
const DB_VERSION = 3;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains('links')) {
                database.createObjectStore('links', { keyPath: 'id', autoIncrement: true });
            }
            if (!database.objectStoreNames.contains('cache')) {
                database.createObjectStore('cache');
            }
        };
        request.onsuccess = (e) => {
            state.db = e.target.result;
            resolve(state.db);
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Optimized Persistence: Shadow-Sync Strategy
 * Separates fast cache updates from heavy flat-list rebuilding
 */
function saveCacheOnly(processed) {
    if (!state.db) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const tx = state.db.transaction(['cache'], 'readwrite');
        tx.objectStore('cache').put(processed, 'categorized');
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

function saveToDB(links, processed) {
    return new Promise((resolve, reject) => {
        if (!state.db) return resolve();
        const tx = state.db.transaction(['links', 'cache'], 'readwrite');
        const linkStore = tx.objectStore('links');
        const cacheStore = tx.objectStore('cache');

        linkStore.clear();
        links.forEach(l => {
            linkStore.add({
                title: l.title,
                url: l.url,
                icon: l.icon,
                folder: l.folder,
                displayUrl: l.displayUrl,
                internalId: l.internalId // Preserve for precision
            });
        });

        cacheStore.put(processed, 'categorized');

        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

function loadFromDB() {
    return new Promise((resolve) => {
        if (!state.db) return resolve({ links: [], processed: null });
        const tx = state.db.transaction(['links', 'cache'], 'readonly');

        const linkRequest = tx.objectStore('links').getAll();
        const cacheRequest = tx.objectStore('cache').get('categorized');

        tx.oncomplete = () => {
            resolve({
                links: linkRequest.result || [],
                processed: cacheRequest.result || null
            });
        };
    });
}

function removeBookmark(itemId, btnElement) {
    if (!state.fullCategories) return;

    // 2. Optimistic UI Removal (Instant UX)
    const card = btnElement.closest('.bookmark-card-wrapper');
    const section = btnElement.closest('.category-section');

    // 1. Update In-Memory Master State (Surgical Update by Internal ID)
    const titleEl = section ? section.querySelector('.category-title') : null;
    const catTitle = titleEl ? titleEl.textContent.trim() : null;

    if (catTitle && state.fullCategories[catTitle]) {
        // filter by unique internalId instead of URL
        state.fullCategories[catTitle] = state.fullCategories[catTitle].filter(l => l.internalId !== itemId);

        if (state.fullCategories[catTitle].length === 0) {
            delete state.fullCategories[catTitle];
        }
    }

    if (card) {
        // FAST KILL: Remove from view instantly
        card.style.display = 'none';

        // Cleanup DOM after a tiny delay for any remaining transitions
        setTimeout(() => {
            const grid = card.parentElement;
            if (card.parentNode) card.remove();

            if (grid && grid.children.length === 0) {
                const sectionId = section.id;
                section.remove();
                const tocLink = document.querySelector(`.toc-link[data-target="${sectionId}"]`);
                if (tocLink) tocLink.parentElement.remove();
            }
        }, 50);
    }

    // 3. Update Visual Counts (Live Sync Engine)
    const updateGlobalCounts = () => {
        const totalCountEl = document.getElementById('link-count');
        const catBadge = document.getElementById('toc-cat-count');
        const linkBadge = document.getElementById('toc-link-total');

        const folderNames = Object.keys(state.fullCategories);
        let totalCount = 0;
        folderNames.forEach(cat => totalCount += state.fullCategories[cat].length);

        if (totalCountEl) totalCountEl.innerText = `${totalCount} Links`;
        if (catBadge) catBadge.innerText = `${folderNames.length} Folders`;
        if (linkBadge) linkBadge.innerText = `${totalCount} Links`;

        // Update specific TOC item count (current category)
        if (section) {
            const tocCount = document.querySelector(`.toc-link[data-target="${section.id}"] .toc-count`);
            if (tocCount) {
                const currentCatLinks = state.fullCategories[catTitle] || [];
                tocCount.innerText = currentCatLinks.length;
            }
        }
    };

    updateGlobalCounts();

    // 4. SHADOW SYNC (Dual-Stream Persistence)
    // A. IMMEDIATE Cache Lock - Saves categorized state instantly (prevents resurrection)
    saveCacheOnly(state.fullCategories).catch(err => console.error("[ShadowSync] Cache failed:", err));

    // B. DEBOUNCED Full Rebuild - Updates flat links for export after user stops deleting
    if (state.saveTimeout) clearTimeout(state.saveTimeout);
    state.saveTimeout = setTimeout(async () => {
        const flatLinks = [];
        Object.values(state.fullCategories).forEach(list => flatLinks.push(...list));
        try {
            await saveToDB(flatLinks, state.fullCategories);
            console.log("[Persistence] Full database sync completed.");
            state.saveTimeout = null;
        } catch (err) {
            console.error("[Persistence] Full sync failed:", err);
        }
    }, 1000); // 1s debounce for heavy operations
}

/**
 * Filter Engine (Search)
 */
function searchBookmarks(query) {
    if (!state.fullCategories) return;

    const q = query.toLowerCase().trim();
    if (q === "") {
        state.isSearching = false;
        renderBookmarks(state.fullCategories);
        return;
    }

    state.isSearching = true;
    const filtered = {};

    for (const [catName, links] of Object.entries(state.fullCategories)) {
        const matches = links.filter(l =>
            l.title.toLowerCase().includes(q) ||
            l.url.toLowerCase().includes(q) ||
            catName.toLowerCase().includes(q)
        );
        if (matches.length > 0) {
            filtered[catName] = matches;
        }
    }

    renderBookmarks(filtered);
}

/**
 * Browser-Friendly HTML Export
 */
async function exportBookmarks() {
    if (!state.fullCategories) return;

    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Curated Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>\n`;

    for (const [cat, links] of Object.entries(state.fullCategories)) {
        html += `    <DT><H3 ADD_DATE="${Math.floor(Date.now() / 1000)}" LAST_MODIFIED="0">${cat}</H3>\n    <DL><p>\n`;
        links.forEach(l => {
            const iconStr = (l.icon && l.icon.startsWith('data:')) ? ` ICON="${l.icon}"` : '';
            html += `        <DT><A HREF="${l.url}" ADD_DATE="0"${iconStr}>${l.title}</A>\n`;
        });
        html += `    </DL><p>\n`;
    }
    html += `</DL><p>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmarks-export-${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Render Engine
 */
function renderBookmarks(categories) {
    const container = document.getElementById('content-area');
    const linkCountEl = document.getElementById('link-count');
    const tocList = document.getElementById('toc-list');
    const tocToggle = document.getElementById('toc-toggle');

    if (!categories || Object.keys(categories).length === 0) {
        document.body.classList.remove('has-content');
        tocToggle.style.display = 'none';
        return;
    }

    document.body.classList.add('has-content');
    tocToggle.style.display = 'inline-flex';

    // Performance: Use DocumentFragments to prevent layout thrashing
    const mainFragment = document.createDocumentFragment();
    const tocFragment = document.createDocumentFragment();

    let totalLinks = 0;
    const sortedKeys = Object.keys(categories).sort();

    sortedKeys.forEach((catName, index) => {
        const links = categories[catName];
        totalLinks += links.length;

        // Sort links alphabetically by URL (groups similar domains together)
        const sortedLinks = [...links].sort((a, b) => {
            return a.displayUrl.toLowerCase().localeCompare(b.displayUrl.toLowerCase());
        });

        // 1. Create Section
        const sectionId = `category-${index}`;
        const section = document.createElement('section');
        section.className = 'category-section';
        section.id = sectionId;

        // Optimized innerHTML build for speed
        let gridHtml = '';
        sortedLinks.forEach((link) => {
            const displayTitle = link.title.length > 25 ? link.title.substring(0, 22) + '...' : link.title;
            const displayUrl = link.displayUrl.length > 40 ? link.displayUrl.substring(0, 37) + '...' : link.displayUrl;

            gridHtml += `
                <div class="bookmark-card-wrapper">
                    <a class="bookmark-card" href="${link.url}" target="_blank">
                        <div class="bookmark-info">
                            ${link.icon ? `<img src="${link.icon}" class="bookmark-icon" alt="">` : '<div class="bookmark-icon-placeholder"></div>'}
                            <span class="bookmark-title">${displayTitle}</span>
                        </div>
                        <span class="bookmark-url" title="${link.displayUrl}">${displayUrl}</span>
                    </a>
                    <button class="bookmark-remove" data-id="${link.internalId}" title="Remove Item">✕</button>
                </div>
            `;
        });

        section.innerHTML = `
            <h2 class="category-title">${catName}</h2>
            <div class="bookmarks-grid">${gridHtml}</div>
        `;

        mainFragment.appendChild(section);

        // 2. Build TOC Item
        const tocItem = document.createElement('li');
        tocItem.className = 'toc-item';
        tocItem.innerHTML = `
            <span class="toc-link" data-target="${sectionId}">
                <span class="toc-link-text">${catName}</span>
                <span class="toc-count">${links.length}</span>
            </span>
        `;
        tocFragment.appendChild(tocItem);
    });

    // Build TOC Item
    container.innerHTML = '';
    tocList.innerHTML = '';
    container.appendChild(mainFragment);
    tocList.appendChild(tocFragment);

    // Update Side Panel Header stats if it exists
    const sideHeader = document.querySelector('.side-panel-header');
    if (sideHeader) {
        // Folder count
        let countEl = document.getElementById('toc-cat-count');
        if (!countEl) {
            countEl = document.createElement('span');
            countEl.id = 'toc-cat-count';
            countEl.className = 'side-panel-badge';
            const titleEl = sideHeader.querySelector('.side-panel-title');
            if (titleEl) titleEl.after(countEl);
        }
        countEl.innerText = `${sortedKeys.length} Folders`;

        // Total link count in sidebar
        let totalEl = document.getElementById('toc-link-total');
        if (!totalEl) {
            totalEl = document.createElement('span');
            totalEl.id = 'toc-link-total';
            totalEl.className = 'side-panel-badge secondary';
            countEl.after(totalEl);
        }
        totalEl.innerText = `${totalLinks} Links`;
    }

    // Event Delegation for TOC (Memory efficient)
    tocList.onclick = (e) => {
        const link = e.target.closest('.toc-link');
        if (link) {
            const targetId = link.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);

            // 1. Close Sidebar First (Restores Body Scroll)
            toggleTOC(false);

            if (targetEl) {
                // 2. Wait 1 tick for DOM/Overflow to settle, then scroll with precision offset
                requestAnimationFrame(() => {
                    const headerHeight = 90;
                    const topPos = targetEl.getBoundingClientRect().top + window.scrollY - headerHeight;
                    window.scrollTo({
                        top: topPos,
                        behavior: 'smooth'
                    });
                });
            }
        }
    };

    linkCountEl.innerText = `${totalLinks} Links`;
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Snappy entrance for visible content
    gsap.from('.category-section:nth-child(-n+3)', {
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "power2.out"
    });
}

/**
 * Off-Canvas Logic
 */
function toggleTOC(open) {
    const sidePanel = document.getElementById('side-panel');
    const overlay = document.getElementById('side-panel-overlay');

    if (open) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Premium Hardware-Accelerated Reveal
        const tl = gsap.timeline();
        tl.to(sidePanel, { x: 0, duration: 0.5, ease: "expo.out" });

        // LIMIT STAGGER: Only animate first 25 items to save RAM on huge sets
        tl.from('.toc-item:nth-child(-n+25)', {
            x: 15,
            opacity: 0,
            duration: 0.35,
            stagger: 0.02,
            ease: "power2.out"
        }, "-=0.25");
    } else {
        overlay.classList.remove('active');
        gsap.to(sidePanel, { x: 400, duration: 0.4, ease: "power4.in" });
        document.body.style.overflow = '';
    }
}

/**
 * Global Event Initialization
 */
function initEvents() {
    const fileInput = document.getElementById('file-upload');
    const dropZone = document.getElementById('content-area');
    const clearBtn = document.getElementById('clear-data');
    const exportBtn = document.getElementById('export-data');
    const uploadBtn = document.getElementById('upload-trigger');
    const tocToggle = document.getElementById('toc-toggle');
    const themeToggle = document.getElementById('theme-toggle');
    // To enable Mapping: Uncomment the line below
    // const mappingBtn = document.getElementById('mapping-data');
    const tocClose = document.getElementById('toc-close');
    const overlay = document.getElementById('side-panel-overlay');
    const searchInput = document.getElementById('search-input');

    // 0. Theme Toggle
    themeToggle.onclick = () => toggleTheme();

    // 0.1 Search Logic
    let searchTimeout;
    const searchContainer = document.getElementById('search-container');
    const searchClear = document.getElementById('search-clear');

    searchInput.oninput = (e) => {
        const val = e.target.value;
        if (val.length > 0) {
            searchContainer.classList.add('has-text');
        } else {
            searchContainer.classList.remove('has-text');
        }

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchBookmarks(val);
        }, 150);
    };

    searchClear.onclick = () => {
        searchInput.value = '';
        searchContainer.classList.remove('has-text');
        searchBookmarks('');
        searchInput.focus();
    };

    // 1. TOC Toggle
    tocToggle.onclick = () => toggleTOC(true);
    tocClose.onclick = () => toggleTOC(false);
    overlay.onclick = () => toggleTOC(false);

    // 2. File Upload
    uploadBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) handleFiles(e.target.files);
    };

    // 3. Clear Data & Export
    clearBtn.onclick = async () => {
        const confirmed = await showConfirm(
            'Wipe Database?',
            'This will delete all saved database links AND physical files in /uploads/. This action is permanent.'
        );

        if (confirmed) {
            try {
                const tx = state.db.transaction(['links', 'cache'], 'readwrite');
                tx.objectStore('links').clear();
                tx.objectStore('cache').clear();

                tx.oncomplete = async () => {
                    // Try to clear server files, but reload regardless
                    try {
                        await fetch('save.php?action=clear');
                    } catch (e) {
                        console.warn("Server clear failed, proceeding with UI reset.");
                    }
                    location.reload();
                };

                tx.onerror = (err) => {
                    console.error("Transaction failed:", err);
                    location.reload();
                };
            } catch (err) {
                console.error("Clear flow failed:", err);
                location.reload();
            }
        }
    };

    exportBtn.onclick = () => exportBookmarks();

    // To enable Mapping: Uncomment the line below
    // if (mappingBtn) mappingBtn.onclick = async () => handleMapping();

    // 4. Drag & Drop Feedback
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());

    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-active');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        handleFiles(e.dataTransfer.files);
    });

    // 5. Removal logic
    dropZone.onclick = (e) => {
        const removeBtn = e.target.closest('.bookmark-remove');
        if (removeBtn) {
            e.preventDefault();
            e.stopPropagation();
            const itemId = removeBtn.getAttribute('data-id');
            removeBookmark(itemId, removeBtn);
        }
    };

    // 6. Scroll To Top
    const scrollTopBtn = document.getElementById('scroll-top');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            scrollTopBtn.classList.add('visible');
        } else {
            scrollTopBtn.classList.remove('visible');
        }
    });

    scrollTopBtn.onclick = () => {
        const scrollObj = { y: window.scrollY };
        gsap.to(scrollObj, {
            y: 0,
            duration: 0.8,
            ease: "power4.inOut",
            onUpdate: () => window.scrollTo(0, scrollObj.y)
        });
    };
}

/**
 * Automated Mapping (Deduplication)
 * To enable this feature: Uncomment the function below and the references in initEvents
 */
/*
async function handleMapping() {
    if (!state.fullCategories) return;

    const overlay = document.getElementById('processing-overlay');
    const updateUI = (status, detail, progress) => {
        document.getElementById('processing-status').innerText = status;
        document.getElementById('processing-detail').innerText = detail;
        document.getElementById('processing-bar').style.transform = `scaleX(${progress})`;
    };

    overlay.classList.add('active');
    updateUI('Scanning Library', 'Identifying duplicates across categories...', 0.3);

    const flatLinks = [];
    Object.values(state.fullCategories).forEach(list => flatLinks.push(...list));

    const seen = new Set();
    const duplicates = [];
    const unique = [];

    flatLinks.forEach(link => {
        if (seen.has(link.url)) {
            duplicates.push(link);
        } else {
            seen.add(link.url);
            unique.push(link);
        }
    });

    if (duplicates.length === 0) {
        updateUI('Clean Library', 'No duplicates found. Your library is optimal.', 1);
        setTimeout(() => overlay.classList.remove('active'), 1500);
        return;
    }

    overlay.classList.remove('active');
    const confirmed = await showConfirm(
        'Deduplicate Library?',
        `Found ${duplicates.length} duplicate links. Clean them up while preserving original folders?`
    );

    if (confirmed) {
        overlay.classList.add('active');
        updateUI('Deep Cleaning', 'Removing redundancy...', 0.7);

        const processed = BookmarkParser.process(unique);
        await saveToDB(unique, processed);
        state.fullCategories = processed;

        updateUI('Success', 'Library normalized and compressed.', 1);
        
        const tl = gsap.timeline({ onComplete: () => {
            overlay.classList.remove('active');
            renderBookmarks(processed);
        }});
        tl.to('.processing-content', { opacity: 0, duration: 0.4 });
        tl.to('.processing-panel.top', { yPercent: -100, duration: 1, ease: "expo.inOut" });
        tl.to('.processing-panel.bottom', { yPercent: 100, duration: 1, ease: "expo.inOut" }, "<");
    }
}
*/

/**
 * Shared File Handler
 */
async function handleFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const overlay = document.getElementById('processing-overlay');
    const bar = document.getElementById('processing-bar');
    const statusEl = document.getElementById('processing-status');
    const detailEl = document.getElementById('processing-detail');

    const updateUI = (status, detail, progress) => {
        statusEl.innerText = status;
        detailEl.innerText = detail;
        bar.style.transform = `scaleX(${progress})`;
    };

    // Show Overlay
    overlay.classList.add('active');
    updateUI('Curating Library', 'Starting physical preservation...', 0.05);

    // 1. Physically save files to /uploads/ via PHP Bridge
    const formData = new FormData();
    files.forEach(f => formData.append('files[]', f));

    try {
        await fetch('save.php', { method: 'POST', body: formData });
        updateUI('Curating Library', 'Synchronizing with database...', 0.2);
    } catch (e) {
        console.error("[Storage Error] Could not save to /uploads/", e);
    }

    // 2. Parse and Persist to IndexedDB
    const allBookmarks = [];
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        updateUI('Analyzing Data', `Processing ${file.name}...`, 0.2 + (i / totalFiles) * 0.4);

        try {
            const text = await file.text();
            const bookmarks = BookmarkParser.parse(text);
            allBookmarks.push(...bookmarks);
        } catch (err) {
            console.error(err);
        }
    }

    if (allBookmarks.length > 0) {
        updateUI('Organizing', 'Establishing architectural structure...', 0.7);

        // 2.1 Use In-Memory State as truth (Preserves deletions that haven't hit DB yet)
        const existingFlat = [];
        if (state.fullCategories) {
            Object.values(state.fullCategories).forEach(list => existingFlat.push(...list));
        } else {
            // Only load from DB if state is empty (e.g. first load)
            const { links } = await loadFromDB();
            existingFlat.push(...links);
        }

        const merged = [...existingFlat, ...allBookmarks];
        const processed = BookmarkParser.process(merged);

        const flatLinks = [];
        Object.values(processed).forEach(list => flatLinks.push(...list));

        updateUI('Finalizing', 'Baking instant-load cache...', 0.9);
        await saveToDB(flatLinks, processed);

        state.fullCategories = processed;
        renderBookmarks(processed);
    }

    updateUI('Success', 'Library curated successfully.', 1);

    // Cinematic Panel Exit (Same style as main preloader)
    setTimeout(() => {
        const tl = gsap.timeline({
            onComplete: () => {
                overlay.classList.remove('active');
                // Reset panels and data after fade out
                gsap.set(['.processing-panel.top', '.processing-panel.bottom'], { yPercent: 0 });
                setTimeout(() => updateUI('Curating Library', 'Organizing your digital resources...', 0), 500);
            }
        });

        tl.to(['.processing-content'], { opacity: 0, duration: 0.4 });
        tl.to('.processing-panel.top', { yPercent: -100, duration: 1.2, ease: "expo.inOut" }, "+=0.1");
        tl.to('.processing-panel.bottom', { yPercent: 100, duration: 1.2, ease: "expo.inOut" }, "<");
    }, 800);
}

/**
 * Bootstrapper
 */
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initPreloader();
    initEvents();

    try {
        await initDB();
        const { processed } = await loadFromDB();
        if (processed) {
            state.fullCategories = processed;
            renderBookmarks(processed);
        }
    } catch (e) {
        console.error("Persistence failed:", e);
    }

    // Protection against losing pending saves
    window.onbeforeunload = () => {
        if (state.saveTimeout) {
            console.warn("Unsaved changes pending! Please wait for sync.");
        }
    };
});
