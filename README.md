# Tab-specific-Browser-Theme-Manager
A browser extension for Microsoft Edge that implements DOM manipulation to modify webpage colour schemes and visual properties. Built with vanilla JavaScript, it directly interfaces with the browser's rendering engine to apply real-time CSS modifications.

## Technical Features

- **DOM Color Manipulation**: Dynamically modifies webpage CSS properties for color transformation
- **CSS Filter Implementation**: Applies matrix transformations for grayscale and brightness adjustments
- **Tab-Isolated State Management**: Maintains separate state objects per tab using browser storage API
- **Event-Driven Architecture**: Utilizes browser extension event listeners for real-time updates
- **Background Script Integration**: Implements persistent state handling via service workers
- **Memory-Efficient Storage**: Uses IndexedDB for large datasets, localStorage for preferences

## Installation

1. Clone repository or download release package
2. Access `edge://extensions/` in Edge browser
3. Enable developer mode in extensions panel
4. Load unpacked extension from source directory

## Usage

1. Invoke extension via browser action
2. Select RGB values or predefined matrices
3. Adjust CSS filter properties
4. Monitor performance metrics in DevTools
5. Changes propagate through content scripts

## Project Structure

```
EdgeColorSchemeExtension/
├── src/
│   ├── background.js    # Core extension logic
│   ├── content.js       # Page manipulation scripts
│   ├── popup.js        # UI interaction handling
│   ├── popup.html      # Extension interface
│   └── styles.css      # UI styling
├── manifest.json       # Extension configuration
└── README.md          # Documentation
```
![image](https://github.com/user-attachments/assets/202d42fc-2172-4926-863b-ba58035963d2)
