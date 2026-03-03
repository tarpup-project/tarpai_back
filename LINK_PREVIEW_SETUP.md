# Link Preview Feature Setup

## Overview
The link preview feature automatically detects URLs in chat messages and displays rich preview cards with metadata (title, description, image, favicon) similar to WhatsApp.

## Backend Changes

### 1. Message Schema Updated
- Added `linkPreview` field to store metadata:
  - url
  - title
  - description
  - image
  - favicon
  - siteName

### 2. Link Preview Service Created
- `src/chat/link-preview.service.ts`
- Fetches webpage metadata using axios and cheerio
- Extracts Open Graph tags, Twitter cards, and standard meta tags
- Handles relative URLs and makes them absolute

### 3. Chat Service Updated
- Automatically detects URLs in text messages
- Fetches link preview metadata when sending messages
- Stores preview data with the message

### 4. Dependencies Installed
```bash
npm install cheerio
```

## Frontend Changes

### 1. Message Interface Updated
- Added `linkPreview` field to Message interface

### 2. Message Rendering Enhanced
- Displays link preview cards below message text
- Shows preview image, favicon, site name, title, and description
- Clickable cards that open links in new tab
- Responsive design that adapts to theme (light/dark/background)

### 3. Styling
- Preview cards have rounded corners and borders
- Hover effects for better UX
- Image preview with fixed height
- Text truncation for long titles/descriptions

## How It Works

1. User types a message containing a URL (e.g., `https://example.com`)
2. Backend detects the URL when message is sent
3. Backend fetches the webpage and extracts metadata
4. Metadata is stored with the message
5. Frontend displays the link preview card below the message text
6. Users can click the card to open the link in a new tab

## Features

- Automatic URL detection
- Rich preview cards with images
- Favicon display
- Site name, title, and description
- Works with Open Graph and Twitter Card metadata
- Fallback to standard HTML meta tags
- Handles relative URLs
- 5-second timeout for fetching previews
- Error handling for failed fetches

## Security

- Only HTTP and HTTPS protocols are allowed
- External links open in new tab with `rel="noopener noreferrer"`
- User-Agent header identifies the bot
- Maximum 5 redirects allowed
- Timeout prevents hanging requests

## Example

When a user sends:
```
Check out this website: https://flightauthenticator.com
```

The message will display with a preview card showing:
- Website favicon
- Site name: "FlightAuthenticator – Best Flight Company"
- Title and description
- Preview image (if available)
