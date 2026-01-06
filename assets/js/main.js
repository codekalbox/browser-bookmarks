/**
 * Theme & Mode Management
 */
function initTheme() {
    const theme = localStorage.getItem('curator-theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);

    // Show toggle button once initialized
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.style.display = 'flex';
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
        duration: 2,
        ease: "power2.inOut",
        onUpdate: () => {
            const formatted = Math.floor(status.val).toString().padStart(3, '0');
            counter.innerText = `${formatted}%`;
            if (progressBar) {
                progressBar.style.transform = `scaleX(${status.val / 100})`;
            }
        }
    });

    tl.to(['.preloader-content', '#percent-counter'], {
        opacity: 0,
        duration: 0.5,
        ease: "power2.in"
    });

    tl.to('.preloader-panel.top', {
        yPercent: -100,
        duration: 1,
        ease: "power4.inOut"
    }, "+=0.1");

    tl.to('.preloader-panel.bottom', {
        yPercent: 100,
        duration: 1,
        ease: "power4.inOut"
    }, "<");

    tl.from('.site-header', {
        y: -50,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out"
    }, "-=0.2");

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
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('links')) {
                db.createObjectStore('links', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('cache')) {
                db.createObjectStore('cache');
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveToDB(links, processed) {
    if (!db) return;
    const tx = db.transaction(['links', 'cache'], 'readwrite');
    const linkStore = tx.objectStore('links');
    const cacheStore = tx.objectStore('cache');

    await linkStore.clear();
    links.forEach(l => linkStore.add({
        title: l.title, url: l.url, icon: l.icon, folder: l.folder, displayUrl: l.displayUrl
    }));

    // Save processed structure for instant load
    await cacheStore.put(processed, 'categorized');
}

function loadFromDB() {
    return new Promise((resolve) => {
        if (!db) return resolve({ links: [], processed: null });
        const tx = db.transaction(['links', 'cache'], 'readonly');

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

async function removeBookmark(url) {
    const { links } = await loadFromDB();
    const filtered = links.filter(l => l.url !== url);
    const processed = BookmarkParser.process(filtered);
    await saveToDB(filtered, processed);
    renderBookmarks(processed);
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

        // 1. Create Section
        const sectionId = `category-${index}`;
        const section = document.createElement('section');
        section.className = 'category-section';
        section.id = sectionId;

        // Optimized innerHTML build for speed
        let gridHtml = '';
        links.forEach((link) => {
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
                    <button class="bookmark-remove" data-url="${link.url}" title="Remove Item">✕</button>
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
            toggleTOC(false);
            if (targetEl) {
                window.scrollTo({
                    top: targetEl.offsetTop - 100,
                    behavior: 'smooth'
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
    const uploadBtn = document.getElementById('upload-trigger');
    const tocToggle = document.getElementById('toc-toggle');
    const themeToggle = document.getElementById('theme-toggle');
    const tocClose = document.getElementById('toc-close');
    const overlay = document.getElementById('side-panel-overlay');

    // 0. Theme Toggle
    themeToggle.onclick = () => toggleTheme();

    // 1. TOC Toggle
    tocToggle.onclick = () => toggleTOC(true);
    tocClose.onclick = () => toggleTOC(false);
    overlay.onclick = () => toggleTOC(false);

    // 2. File Upload
    uploadBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) handleFiles(e.target.files);
    };

    // 3. Clear Data
    clearBtn.onclick = async () => {
        if (confirm("Are you sure? This will delete all saved database links AND physical files in /uploads/.")) {
            try {
                const tx = db.transaction(['links', 'cache'], 'readwrite');
                await tx.objectStore('links').clear();
                await tx.objectStore('cache').clear();

                tx.oncomplete = async () => {
                    await fetch('save.php?action=clear');
                    location.reload();
                };
            } catch (err) {
                console.error("Clear failed:", err);
                location.reload();
            }
        }
    };

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
    dropZone.onclick = async (e) => {
        const removeBtn = e.target.closest('.bookmark-remove');
        if (removeBtn) {
            e.preventDefault();
            e.stopPropagation();
            const url = removeBtn.getAttribute('data-url');
            if (confirm('Remove this item?')) {
                await removeBookmark(url);
            }
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
 * Shared File Handler
 */
async function handleFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    // 1. Physically save files to /uploads/ via PHP Bridge
    const formData = new FormData();
    files.forEach(f => formData.append('files[]', f));

    fetch('save.php', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => console.log("[Storage]", data.message))
        .catch(e => console.error("[Storage Error] Could not save to /uploads/", e));

    // 2. Parse and Persist to IndexedDB
    const allBookmarks = [];
    for (const file of files) {
        try {
            const text = await file.text();
            const bookmarks = BookmarkParser.parse(text);
            allBookmarks.push(...bookmarks);
        } catch (err) {
            console.error(err);
        }
    }

    if (allBookmarks.length > 0) {
        const { links: existing } = await loadFromDB();
        const merged = [...existing, ...allBookmarks];
        const processed = BookmarkParser.process(merged);

        const flatLinks = [];
        Object.values(processed).forEach(list => flatLinks.push(...list));

        await saveToDB(flatLinks, processed);
        renderBookmarks(processed);
    }
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
            renderBookmarks(processed);
        }
    } catch (e) {
        console.error("Persistence failed:", e);
    }
});
