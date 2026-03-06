import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

@Injectable()
export class LinkPreviewService {
  async fetchLinkPreview(url: string): Promise<any> {
    try {
      // Validate URL
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return null;
      }

      // Fetch the page
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        maxRedirects: 5,
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Extract metadata
      const preview: any = {
        url,
      };

      // Try Open Graph tags first
      preview.title = 
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('title').text() ||
        '';

      preview.description = 
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="twitter:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        '';

      preview.image = 
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') ||
        '';

      preview.siteName = 
        $('meta[property="og:site_name"]').attr('content') ||
        urlObj.hostname;

      // Get favicon
      const favicon = 
        $('link[rel="icon"]').attr('href') ||
        $('link[rel="shortcut icon"]').attr('href') ||
        $('link[rel="apple-touch-icon"]').attr('href') ||
        '';

      // Make favicon URL absolute or use Google's favicon service as fallback
      if (favicon) {
        if (favicon.startsWith('http')) {
          preview.favicon = favicon;
        } else if (favicon.startsWith('//')) {
          preview.favicon = `${urlObj.protocol}${favicon}`;
        } else if (favicon.startsWith('/')) {
          preview.favicon = `${urlObj.protocol}//${urlObj.host}${favicon}`;
        } else {
          preview.favicon = `${urlObj.protocol}//${urlObj.host}/${favicon}`;
        }
      } else {
        // Use Google's favicon service as fallback
        preview.favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
      }

      // Make image URL absolute if needed
      if (preview.image && !preview.image.startsWith('http')) {
        if (preview.image.startsWith('//')) {
          preview.image = `${urlObj.protocol}${preview.image}`;
        } else if (preview.image.startsWith('/')) {
          preview.image = `${urlObj.protocol}//${urlObj.host}${preview.image}`;
        } else {
          preview.image = `${urlObj.protocol}//${urlObj.host}/${preview.image}`;
        }
      }

      // Validate image URL - remove if invalid
      if (preview.image) {
        // Check for invalid base64 or empty data URIs
        if (preview.image.startsWith('data:;base64,') || 
            preview.image === 'data:,' ||
            (preview.image.startsWith('data:image/') && preview.image.length < 50)) {
          preview.image = null;
        }
      }

      // Validate favicon URL - use Google's service if invalid
      if (preview.favicon) {
        if (preview.favicon.startsWith('data:;base64,') || 
            preview.favicon === 'data:,' ||
            (preview.favicon.startsWith('data:image/') && preview.favicon.length < 50)) {
          preview.favicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
        }
      }

      // Trim long descriptions
      if (preview.description && preview.description.length > 200) {
        preview.description = preview.description.substring(0, 200) + '...';
      }

      return preview;
    } catch (error) {
      console.error('Failed to fetch link preview:', error.message);
      return null;
    }
  }

  extractUrlFromMessage(content: string): string | null {
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = content.match(urlRegex);
    return match ? match[1] : null;
  }
}
