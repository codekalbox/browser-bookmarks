# 💎 MWS Bookmark Manager

A high-density, state-of-the-art bookmark curation system designed for professionals. **MWS Bookmark Manager** transforms flat bookmark files into a premium, architectural grid experience with instant-load performance and absolute data integrity.

---

## ✨ Philosophy: Raw Data, Premium View
Unlike traditional managers that merge and truncate your data, the **MWS Bookmark Manager** operates on the principle of **Pure Preservation**. Every folder name, every duplicate link, and every unique category from your source files is respected and displayed exactly as intended.

## 🚀 Key Features

### 🏛️ Architectural Interface
- **Premium Grid Layout**: A responsive, 8-column high-density grid designed to handle thousands of links with zero visual clutter.
- **Cinematic Transitions**: Powered by GSAP, featuring split-panel preloader entries and GPU-accelerated side-panel navigation.
- **Dark Mode Native**: A curated architectural color palette that adapts perfectly to system preferences.

### ⚡ Performance & Scale
- **IndexedDB Core**: Engineered to handle 20,000+ bookmarks with ease, utilizing a persistent caching layer for instant startups.
- **DocumentFragment Batching**: High-performance DOM rendering that eliminates layout thrashing during massive imports.
- **Lazy Interaction**: Uses `content-visibility` and optimized CSS transitions to maintain 60FPS even with heavy data loads.

### 🛠️ Curation Tools
- **Deep Search**: Instant, debounced search across titles, URLs, and category names.
- **Dynamic Export**: One-click export to standard Netscape HTML format, preserving your custom structure.
- **Architectural Mapping (Dormant)**: A powerful automated deduplication tool that identifies and purges redundant links while respecting original folder names.
- **Processing Intelligence**: A visual "Curating Library" overlay with real-time progress for bulk file imports.
- **Custom Confirmation**: A bespoke modal system replacing ugly browser defaults for a unified premium aesthetic.

## 🗺️ Enabling Automated Mapping
By default, MWS Bookmark Manager preserves every single link to ensure data integrity. If you wish to enable the **automated deduplication (Mapping)** button:

1. **Enable UI**: In `index.html`, uncomment the `<button id="mapping-data">` line (around line 82).
2. **Activate Logic**: In `assets/js/main.js`, uncomment the `mappingBtn` declaration and its `onclick` listener in the `initEvents` function.
3. **Unwrap Function**: In `assets/js/main.js`, remove the block comments `/* */` from the `handleMapping` function definition.

## 📥 How to Import
1. **Export** your bookmarks from Chrome/Safari/Edge as an HTML file.
2. **Drop** the file(s) anywhere on the MWS dashboard or use the **Import** button.
3. **Watch** the cinematic curator organize your links into their original architectural folders.

## 🔒 Privacy & Security
- **100% Client-Side**: Your data never leaves your machine. Processing happens in-memory and storage is local to your browser.
- **No Tracking**: No analytics, no cookies, no accounts. Purely your data, your way.
- **Offline First**: Works perfectly without an internet connection.

## 🔧 Technical Stack
- **Engine**: Vanilla JavaScript (ES6+)
- **Animations**: GSAP (GreenSock Animation Platform)
- **Database**: IndexedDB (Level 3)
- **Styling**: Modern CSS3 (Grid, Flexbox, Variable-driven theming)
- **Back-end**: PHP Bridge (for temporary file synchronization in /uploads/)

## 📄 License
Designed for the modern web. Free to use, modify, and distribute.

---

*Part of the **Modernaweb Studio** architectural suite.*
