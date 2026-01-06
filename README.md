# 📚 Chrome Bookmarks Viewer

A single-page web application for viewing and organizing Chrome bookmarks from XML/HTML export files.

## Features

✅ **Upload Chrome Bookmarks** - Import your bookmarks XML/HTML file  
✅ **Automatic Deduplication** - Removes duplicate links automatically  
✅ **Domain-Level Organization** - Keeps only main domain links (removes subpages)  
✅ **Folder-Based Grouping** - Organizes bookmarks by top-level folders  
✅ **Visual Icons** - Displays bookmark icons using the ICON attribute  
✅ **Offline Ready** - Works completely offline in your browser  
✅ **No Backend Required** - Pure HTML, CSS, and JavaScript  

## How to Use

1. **Open the Application**
   - Simply open `index.html` in any modern web browser
   - No installation or server required!

2. **Export Your Chrome Bookmarks**
   - In Chrome, go to: `chrome://bookmarks`
   - Click the three dots menu (⋮) in the top right
   - Select "Export bookmarks"
   - Save the HTML file to your computer

3. **Upload Your Bookmarks**
   - Click "Choose File" in the application
   - Select your exported bookmarks file
   - The app will automatically process and display your bookmarks

## How It Works

### Deduplication
The app automatically removes duplicate links by comparing URLs. If multiple bookmarks point to the same domain, only one is kept.

### Domain Simplification
The app keeps only main domain links and removes subpage URLs:
- From `example.com/about` and `example.com/contact` → keeps `example.com`
- Prioritizes root domain URLs (those ending in `/`)

### Folder Organization
Bookmarks are grouped by their top-level folder in the original Chrome bookmarks structure (e.g., "Bookmarks Bar", custom folders, etc.).

## Technical Details

- **Pure Client-Side** - All processing happens in your browser
- **No Data Sent** - Your bookmarks never leave your computer
- **Standards-Based** - Uses standard HTML5, CSS3, and vanilla JavaScript
- **Privacy-Focused** - Works completely offline

## Styling

The application uses the Karla font family from Google Fonts and features a clean, modern design with:
- Nested folder backgrounds alternating between white and light gray
- Smooth hover effects on links
- Responsive padding and spacing
- Border-radius for a modern look

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

## License

Free to use and modify as needed.

