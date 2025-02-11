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
```
---
config:
  theme: neo-dark
  look: classic
  layout: elk
---
flowchart TD
    A["Browser Action"] -- Click Event --> B["Popup Interface"]
    B -- Color Selection --> C["Background Script"]
    B -- Filter Settings --> C
    B -- Save Preferences --> D["Storage API"]
    C -- Initialize --> D
    C -- Read State --> D
    C -- Write State --> D
    C -- Tab Management --> E["Tab Controller"]
    C -- Message Passing --> F["Content Script"]
    F -- querySelector --> G["DOM Elements"]
    F -- Style Injection --> G
    F -- CSS Matrix --> G
    F -- Filter Application --> G
    H["MutationObserver"] -- DOM Changes --> F
    H -- Dynamic Content --> G
    I["Service Worker"] -- Lifecycle --> C
    I -- Event Handling --> C
    J["IndexedDB"] -- Large Data --> D
    K["localStorage"] -- Preferences --> D
    L["Browser APIs"] -- "chrome.tabs" --> E
    L -- "chrome.storage" --> D
    L -- "chrome.runtime" --> C
    G -- Performance Metrics --> M["DevTools"]
    G -- Rendering --> N["Webpage Display"]
```
