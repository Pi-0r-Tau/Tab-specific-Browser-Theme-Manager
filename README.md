# Tab-specific-Browser-Theme-Manager
A browser extension for Microsoft Edge that allows you to have css styling per tab. For those who want greyscale on one site and inverted purple on the other site.
But stores preferences in local storage so site A is always what I set it as. 

## Features

-  Dynamically modifies webpage CSS properties for color transformation
-  Brightness and grayscale dynamic adjustments
- Maintains separate state objects per tab using browser storage API, however this is buggy at the moment
- Tracks user changes, applies these and stores in localStorage for later

## Installation

1. Clone and download
2. Access `edge://extensions/` in Edge browser
3. Enable developer mode in extensions panel
4. Load unpacked extension from source directory

## Usage

1. Navigate to website, click on the extension, make changes:

   
    i.   Select RGB values or predefined matrices

   
    ii. Adjust CSS filter properties

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
└── README.md          # Hello there....
```
![image](https://github.com/user-attachments/assets/202d42fc-2172-4926-863b-ba58035963d2)
