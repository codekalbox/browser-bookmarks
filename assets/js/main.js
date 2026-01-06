/**
 * Main Application Controller
 * Handles GSAP animations, UI Initialization, and Event Listeners
 */

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
const DB_VERSION = 2; // Incremented to force store creation
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            console.log("[DB] Upgrading/Creating store...");
            if (!db.objectStoreNames.contains('links')) {
                db.createObjectStore('links', { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            console.log("[DB] Connected successfully");
            resolve(db);
        };
        request.onerror = (e) => {
            console.error("[DB] Error:", e.target.error);
            reject(e.target.error);
        };
    });
}

async function saveToDB(links) {
    if (!db) return;
    const tx = db.transaction('links', 'readwrite');
    const store = tx.objectStore('links');
    await store.clear();
    links.forEach(link => {
        // Clean link object to ensure it's cloneable
        const cleanLink = {
            title: link.title,
            url: link.url,
            icon: link.icon,
            folder: link.folder,
            displayUrl: link.displayUrl
        };
        store.add(cleanLink);
    });
}

function loadFromDB() {
    return new Promise((resolve, reject) => {
        if (!db) return resolve([]);
        const tx = db.transaction('links', 'readonly');
        const store = tx.objectStore('links');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Render Engine
 */
function renderBookmarks(categories) {
    const container = document.getElementById('content-area');
    const linkCountEl = document.getElementById('link-count');
    const tocList = document.getElementById('toc-list');
    const sidePanel = document.getElementById('side-panel');
    const tocToggle = document.getElementById('toc-toggle');

    if (!categories || Object.keys(categories).length === 0) {
        document.body.classList.remove('has-content');
        tocToggle.style.display = 'none';
        return;
    }

    document.body.classList.add('has-content');
    tocToggle.style.display = 'inline-flex';
    container.innerHTML = '';
    tocList.innerHTML = '';
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

        const title = document.createElement('h2');
        title.className = 'category-title';
        title.innerText = catName;
        section.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'bookmarks-grid';

        links.forEach((link) => {
            const card = document.createElement('a');
            card.className = 'bookmark-card';
            card.href = link.url;
            card.target = "_blank";

            // TITLES: Limit to 25 chars
            const displayTitle = link.title.length > 25
                ? link.title.substring(0, 22) + '...'
                : link.title;

            card.innerHTML = `
                <div class="bookmark-info">
                    ${link.icon ? `<img src="${link.icon}" class="bookmark-icon" alt="">` : '<div class="bookmark-icon-placeholder"></div>'}
                    <span class="bookmark-title">${displayTitle}</span>
                </div>
                <span class="bookmark-url">${link.displayUrl}</span>
            `;
            grid.appendChild(card);
        });

        section.appendChild(grid);
        container.appendChild(section);

        // 2. Add to TOC
        const tocItem = document.createElement('li');
        tocItem.className = 'toc-item';
        tocItem.innerHTML = `<span class="toc-link" data-target="${sectionId}">${catName}</span>`;
        tocList.appendChild(tocItem);

        // GSAP Category Entrance
        gsap.from(section, {
            y: 40,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
                trigger: section,
                start: "top 90%"
            }
        });
    });

    // TOC Click handling
    tocList.querySelectorAll('.toc-link').forEach(link => {
        link.onclick = (e) => {
            const targetId = link.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);

            // Close panel first
            toggleTOC(false);

            if (targetEl) {
                window.scrollTo({
                    top: targetEl.offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        };
    });

    linkCountEl.innerText = `${totalLinks} Links`;

    // Always reset to top after high-volume render
    window.scrollTo({ top: 0, behavior: 'instant' });
}

/**
 * Off-Canvas Logic
 */
function toggleTOC(open) {
    const sidePanel = document.getElementById('side-panel');
    const overlay = document.getElementById('side-panel-overlay');

    if (open) {
        overlay.classList.add('active');
        gsap.to(sidePanel, { right: 0, duration: 0.8, ease: "power4.out" });
        document.body.style.overflow = 'hidden';
    } else {
        overlay.classList.remove('active');
        gsap.to(sidePanel, { right: -400, duration: 0.6, ease: "power4.in" });
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
    const tocClose = document.getElementById('toc-close');
    const overlay = document.getElementById('side-panel-overlay');

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
                const tx = db.transaction('links', 'readwrite');
                const store = tx.objectStore('links');
                const clearReq = store.clear();

                clearReq.onsuccess = async () => {
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

    // 5. Hover Effects
    dropZone.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.bookmark-card');
        if (card) {
            gsap.to(card, { scale: 1.02, y: -4, borderColor: "#000", duration: 0.3, ease: "power2.out" });
        }
    });

    dropZone.addEventListener('mouseout', (e) => {
        const card = e.target.closest('.bookmark-card');
        if (card) {
            gsap.to(card, { scale: 1, y: 0, borderColor: "#eeeeee", duration: 0.3, ease: "power2.out" });
        }
    });
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
        // Load existing links first to merge (Append mode)
        const existing = await loadFromDB();
        const merged = [...existing, ...allBookmarks];

        const processed = BookmarkParser.process(merged);

        // Flatten merged bookmarks to save back to DB
        const flatLinks = [];
        Object.values(processed).forEach(list => flatLinks.push(...list));

        await saveToDB(flatLinks);
        renderBookmarks(processed);
    }
}

/**
 * Bootstrapper
 */
document.addEventListener('DOMContentLoaded', async () => {
    initPreloader();
    initEvents();

    // Initialize DB and load existing content
    try {
        await initDB();
        const storedLinks = await loadFromDB();
        if (storedLinks.length > 0) {
            const processed = BookmarkParser.process(storedLinks);
            renderBookmarks(processed);
        }
    } catch (e) {
        console.error("Persistence failed:", e);
    }
});
