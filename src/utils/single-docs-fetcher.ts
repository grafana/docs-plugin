import { getDocsBaseUrl, getDocsUsername, getDocsPassword } from '../constants';

export interface SingleDocsContent {
  title: string;
  content: string;
  url: string;
  lastFetched: string;
  hashFragment?: string; // For anchor scrolling
}

// Simple in-memory cache for docs content
const docsContentCache = new Map<string, { content: SingleDocsContent; timestamp: number }>();
const DOCS_CACHE_DURATION = 1; // 5 * 60 * 1000; // 5 minutes

/**
 * Get authentication headers if credentials are provided
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (compatible; GrafanaDocsReader/1.0)',
  };
  
  // Authenticate if username is provided (password can be empty)
  if (getDocsUsername()) {
    const credentials = btoa(`${getDocsUsername()}:${getDocsPassword() || ''}`);
    headers['Authorization'] = `Basic ${credentials}`;
    console.log(`🔐 Adding Basic Auth for user: ${getDocsUsername()}`);
  }
  
  return headers;
}

/**
 * Convert a regular docs URL to unstyled.html version for content fetching
 * Preserves hash fragments for anchor links
 */
function getUnstyledContentUrl(url: string): string {
  // Split URL and hash fragment
  const [baseUrl, hash] = url.split('#');
  
  let unstyledUrl: string;
  // For docs pages, append unstyled.html
  if (baseUrl.endsWith('/')) {
    unstyledUrl = `${baseUrl}unstyled.html`;
  } else {
    unstyledUrl = `${baseUrl}/unstyled.html`;
  }
  
  // Re-attach hash fragment if it exists
  if (hash) {
    unstyledUrl += `#${hash}`;
    console.log(`🔗 Preserved hash fragment: ${url} -> ${unstyledUrl}`);
  }
  
  return unstyledUrl;
}

/**
 * Extract single docs content from HTML
 */
function extractSingleDocsContent(html: string, url: string): SingleDocsContent {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    console.log('Extracting docs content for:', url);
    console.log('HTML length:', html.length);
    
    // Extract title from h1 (unstyled.html always has content directly in body)
    const titleElement = doc.querySelector('h1');
    const title = titleElement?.textContent?.trim() || 'Documentation';
    console.log('Extracted title:', title);
    
    // For unstyled.html, content is always in body
    const mainElement = doc.querySelector('body');
    
    if (!mainElement) {
      console.warn('No body element found');
      return {
        title,
        content: 'Content not available - no body element found',
        url,
        lastFetched: new Date().toISOString()
      };
    }
    
    console.log('Body element innerHTML length before processing:', mainElement.innerHTML.length);
    
    // Process the content
    const processedContent = processSingleDocsContent(mainElement, url);
    
    console.log('Processed content length:', processedContent.length);
    
    return {
      title,
      content: processedContent,
      url,
      lastFetched: new Date().toISOString()
    };
  } catch (error) {
    console.warn('Failed to parse single docs content:', error);
    return {
      title: 'Documentation',
      content: html,
      url,
      lastFetched: new Date().toISOString()
    };
  }
}

function processInteractiveElements(element: Element) {
  const interactiveLinks = element.querySelectorAll('a.interactive, span.interactive, li.interactive');
  interactiveLinks.forEach(block => {
    console.log("Interactive link found:", block.textContent);
    
    const tagName = block.tagName.toLowerCase();
    const targetAction = block.getAttribute('data-targetaction');
    const reftarget = block.getAttribute('data-reftarget');
    const value = block.getAttribute('data-targetvalue') || '';

    if (!targetAction || !reftarget) {
      console.warn("Interactive link missing target action or ref target:", block.textContent);
      return;
    }

    console.log("Adding onclick attribute to " + tagName + " target " + reftarget + " with " + targetAction);
    
    const doItForMe = (text : string = "Do it") => {
      const button = document.createElement('button');
      button.textContent = text;
      return button;
    };

    let eventAction = "";
    if(targetAction === "highlight" || targetAction === "button") {
      console.log("Adding highlight for selector " + reftarget);
      eventAction = `document.dispatchEvent(
          new CustomEvent("interactive-${targetAction}", 
            { 
              detail: {
                reftarget: '${reftarget.replace(/'/g, "\\'")}' 
              }
            }
          ))`;
    } else if(targetAction === "formfill") { 
      eventAction = `document.dispatchEvent(
          new CustomEvent('interactive-formfill', 
            { 
              detail: { 
                reftarget: '${reftarget.replace(/'/g, "\\'")}', 
                value: '${value.replace(/'/g, "\\'") || ''}' 
              }
            }
          )
        )`;  
    } else if(targetAction === "sequence") {
      eventAction = `document.dispatchEvent(
        new CustomEvent('interactive-sequence', 
          { 
            detail: { 
              reftarget: '${reftarget.replace(/'/g, "\\'")}', 
              value: '${value.replace(/'/g, "\\'") || ''}'
            }
          }
        )
      )`;  
    } else {
      eventAction = `document.alert("Unknown target action: ${targetAction}")`;
    }

    if (tagName == 'a') {
      block.setAttribute('onclick', eventAction);
    } else {
      const button = doItForMe(tagName === 'span' ? 'Do SECTION' : 'Do It');
      button.setAttribute('onclick', eventAction);
      block.appendChild(button);
    }
  })
}

/**
 * Process single docs content for better display (simplified for unstyled.html)
 */
function processSingleDocsContent(mainElement: Element, url: string): string {
  const clonedElement = mainElement.cloneNode(true) as Element;
  
  // Remove unwanted elements (simplified for unstyled.html)
  const unwantedSelectors = [
    'head', 'script', 'style', 'noscript', 'grammarly-desktop-integration'
  ];
  
  console.log('Content length before removing unwanted elements:', clonedElement.innerHTML.length);
  
  unwantedSelectors.forEach(selector => {
    const elements = clonedElement.querySelectorAll(selector);
    console.log(`Removing ${elements.length} elements with selector: ${selector}`);
    elements.forEach(el => el.remove());
  });
  
  console.log('Content length after removing unwanted elements:', clonedElement.innerHTML.length);
  
  // Process images - fix relative URLs and add lightbox functionality
  const images = clonedElement.querySelectorAll('img');
  images.forEach(img => {
    const src = img.getAttribute('src');
    const dataSrc = img.getAttribute('data-src');
    const originalSrc = dataSrc || src;
    
    if (!originalSrc) {return;}
    
    // Fix relative URLs with configurable base URL
    const newSrc = originalSrc.startsWith('http') || originalSrc.startsWith('data:') 
      ? originalSrc
      : originalSrc.startsWith('/') 
        ? `${getDocsBaseUrl()}${originalSrc}`
        : originalSrc.startsWith('./') 
          ? `${getDocsBaseUrl()}/docs/${originalSrc.substring(2)}`
          : originalSrc.startsWith('../') 
            ? `${getDocsBaseUrl()}/docs/${originalSrc.replace(/^\.\.\//, '')}`
            : `${getDocsBaseUrl()}/docs/${originalSrc}`;
    
    img.setAttribute('src', newSrc);
    img.removeAttribute('data-src');
    img.removeAttribute('data-srcset');
    img.classList.remove('lazyload', 'lazyloaded', 'ls-is-cached', 'd-inline-block');
    img.classList.add('docs-image');
    img.setAttribute('loading', 'lazy');
    
    // Add alt text if missing
    if (!img.getAttribute('alt')) {
      img.setAttribute('alt', 'Documentation image');
    }
  });
  
  // Process iframes (like YouTube videos) with responsive wrappers
  const iframes = clonedElement.querySelectorAll('iframe');
  iframes.forEach(iframe => {
    const src = iframe.getAttribute('src');
    
    // Determine iframe type and apply appropriate classes
    if (src?.includes('youtube.com') || src?.includes('youtu.be')) {
      // Create video wrapper for responsive design
      const wrapper = clonedElement.ownerDocument.createElement('div');
      wrapper.className = 'journey-iframe-wrapper journey-video-wrapper';
      
      iframe.classList.add('journey-video-iframe');
      iframe.parentNode?.insertBefore(wrapper, iframe);
      wrapper.appendChild(iframe);
    } else {
      // General iframe handling
      iframe.classList.add('journey-general-iframe');
    }
    
    // Add title if missing
    if (!iframe.getAttribute('title')) {
      iframe.setAttribute('title', 'Embedded content');
    }
  });
  
  // Process code snippets and remove existing copy buttons
  const codeSnippets = clonedElement.querySelectorAll('.code-snippet, pre[class*="language-"], pre:has(code), pre');
  codeSnippets.forEach(snippet => {
    // Remove any existing copy buttons
    const existingCopyButtons = snippet.querySelectorAll(
      'button[title*="copy" i], button[aria-label*="copy" i], .copy-button, .copy-btn, .btn-copy, .code-clipboard, button[x-data*="code_snippet"], .lang-toolbar'
    );
    existingCopyButtons.forEach(btn => btn.remove());
    
    // Find the actual pre element
    const preElement = snippet.querySelector('pre') || (snippet.tagName === 'PRE' ? snippet : null);
    if (preElement) {
      preElement.classList.add('docs-code-snippet');
      (preElement as HTMLElement).style.position = 'relative';
      
      // Ensure there's a code element inside pre
      if (!preElement.querySelector('code')) {
        const codeElement = clonedElement.ownerDocument.createElement('code');
        codeElement.innerHTML = preElement.innerHTML;
        preElement.innerHTML = '';
        preElement.appendChild(codeElement);
      }
    }
  });
  
  // Process inline code elements
  const inlineCodes = clonedElement.querySelectorAll('code:not(pre code)');
  inlineCodes.forEach(code => {
    // Add class for styling
    code.classList.add('docs-inline-code');
  });
  
  processInteractiveElements(clonedElement);

  // Process links to handle docs links vs external links differently
  const links = clonedElement.querySelectorAll('a[href]');
  console.log(`🔗 Processing ${links.length} links in docs content`);
  
  links.forEach((link, index) => {
    const href = link.getAttribute('href');
    if (href) {
      let finalHref = href;
      
      // Fix relative URLs with configurable base URL
      if (href.startsWith('/')) {
        // Absolute path from root
        finalHref = `${getDocsBaseUrl()}${href}`;
        link.setAttribute('href', finalHref);
        console.log(`🔗 Link ${index}: Fixed absolute path ${href} -> ${finalHref}`);
      } else if (href.startsWith('../') && !href.startsWith('http')) {
        // Relative path going up directories - likely a docs link
        // Convert to absolute URL by resolving relative to current docs context
        const currentUrl = url; // Use the current page URL as context
        try {
          const resolvedUrl = new URL(href, currentUrl);
          finalHref = resolvedUrl.href;
          link.setAttribute('href', finalHref);
          console.log(`🔗 Link ${index}: Resolved relative URL ${href} -> ${finalHref} (base: ${currentUrl})`);
        } catch (error) {
          console.warn(`🔗 Link ${index}: Failed to resolve relative URL ${href}, leaving as-is`);
        }
      } else if (!href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('#')) {
        // Simple relative path (like "alertmanager/", "aws-cloudwatch/") - resolve against current URL
        const currentUrl = url; // Use the current page URL as context
        try {
          const resolvedUrl = new URL(href, currentUrl);
          finalHref = resolvedUrl.href;
          link.setAttribute('href', finalHref);
          console.log(`🔗 Link ${index}: Resolved simple relative URL ${href} -> ${finalHref} (base: ${currentUrl})`);
        } catch (error) {
          console.warn(`🔗 Link ${index}: Failed to resolve simple relative URL ${href}, leaving as-is`);
        }
      }
      
      const docsBaseUrl = getDocsBaseUrl(); // Should be https://grafana.com
      const isDocsLink = finalHref.startsWith(`${docsBaseUrl}/docs/`) || 
                        (href.startsWith('/docs/') && !href.startsWith('//'));
      
      console.log(`🔗 Link ${index}: href="${href}", finalHref="${finalHref}", isDocsLink=${isDocsLink}`);
      
      if (isDocsLink) {
        // Docs links - will be handled by app tab system
        link.setAttribute('data-docs-internal-link', 'true');
        link.setAttribute('data-docs-link', 'true');
        console.log(`🔗 Link ${index}: Added data-docs-internal-link="true" to docs link: ${finalHref}`);
        // Don't set target="_blank" for docs links - they'll be handled by our click handler
      } else {
        // External links - open in new browser tab
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        link.setAttribute('data-docs-link', 'true');
        console.log(`🔗 Link ${index}: Added target="_blank" to external link: ${finalHref}`);
      }
    } else {
      console.log(`🔗 Link ${index}: No href attribute found`);
    }
  });
  
  // Process anchor links (remove them since they won't work in our context)
  const anchorLinks = clonedElement.querySelectorAll('.docs-anchor-link');
  anchorLinks.forEach(anchor => anchor.remove());
  
  // Process admonitions (notes, warnings, etc.) - unwrap outer div and keep blockquote
  const admonitions = clonedElement.querySelectorAll('.admonition');
  admonitions.forEach(admonition => {
    const blockquote = admonition.querySelector('blockquote');
    
    if (blockquote) {
      // Transfer admonition classes to the blockquote
      blockquote.classList.add('admonition');
      
      // Check for specific admonition types and add appropriate classes to blockquote
      if (admonition.classList.contains('admonition-note')) {
        blockquote.classList.add('admonition-note');
      } else if (admonition.classList.contains('admonition-warning')) {
        blockquote.classList.add('admonition-warning');
      } else if (admonition.classList.contains('admonition-caution')) {
        blockquote.classList.add('admonition-caution');
      } else if (admonition.classList.contains('admonition-tip')) {
        blockquote.classList.add('admonition-tip');
      }
      
      // Process title elements within blockquote
      const titleElement = blockquote.querySelector('.title');
      if (titleElement) {
        titleElement.classList.add('title');
      }
      
      // Replace the outer div with just the blockquote
      admonition.parentNode?.replaceChild(blockquote, admonition);
    }
  });
  
  // Process tables for better responsiveness
  const tables = clonedElement.querySelectorAll('table');
  tables.forEach(table => {
    table.classList.add('docs-table');
  });
  
  console.log('Final processed content length:', clonedElement.innerHTML.length);
  console.log('Final content preview (first 500 chars):', clonedElement.innerHTML.substring(0, 500));
  
  return clonedElement.innerHTML;
}

/**
 * Fetch single docs content with multiple strategies
 */
export async function fetchSingleDocsContent(url: string): Promise<SingleDocsContent | null> {
  console.log(`Fetching single docs content from: ${url}`);
  
  // Use unstyled.html version for content fetching
  const unstyledUrl = getUnstyledContentUrl(url);
  console.log(`Using unstyled URL: ${unstyledUrl}`);
  
  // Split hash fragment for fetch (server doesn't need it) but preserve for content
  const [fetchUrl, hashFragment] = unstyledUrl.split('#');
  
  // Check cache first (use original URL as cache key)
  const cached = docsContentCache.get(url);
  if (cached && Date.now() - cached.timestamp < DOCS_CACHE_DURATION) {
    console.log('Returning cached docs content for:', url);
    return cached.content;
  }
  
  // Try fetch with retry logic for redirects
  try {
    console.log('🚀 Starting docs fetch with redirect handling...');
    const startTime = Date.now();
    const htmlContent = await fetchWithRetry(fetchUrl); // Fetch without hash
    const duration = Date.now() - startTime;
    
    if (htmlContent && htmlContent.trim().length > 0) {
      console.log(`✅ Docs fetch with retry succeeded in ${duration}ms, content length: ${htmlContent.length}`);
      const content = extractSingleDocsContent(htmlContent, url); // Use original URL for content
      
      // Add hash fragment to the content for scrolling
      if (hashFragment) {
        content.hashFragment = hashFragment;
        console.log(`🔗 Added hash fragment for scrolling: #${hashFragment}`);
      }
      
      console.log(`📄 Extracted docs content: ${content.title}`);
      
      // Cache the result (use original URL as cache key)
      docsContentCache.set(url, { content, timestamp: Date.now() });
      
      return content;
    } else {
      console.warn(`❌ Docs fetch with retry returned empty content after ${duration}ms`);
    }
  } catch (error) {
    console.warn(`❌ Docs fetch with retry failed:`, error);
  }
  
  console.error('Direct docs fetch failed for URL:', url);
  return null;
}

/**
 * Try direct fetch with redirect handling
 */
async function fetchDirectFast(url: string): Promise<string | null> {
  try {
    console.log('🌐 Trying direct docs fetch for:', url);
    
    const headers = getAuthHeaders();
    
    // For authenticated requests, we might need additional CORS handling
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: headers,
      signal: AbortSignal.timeout(10000), // Increased timeout for redirects
      redirect: 'follow', // Explicitly follow redirects
    };
    
    // If we have authentication, try with credentials and explicit CORS mode
    if (getDocsUsername()) {
      fetchOptions.mode = 'cors';
      fetchOptions.credentials = 'omit'; // Don't send cookies, use explicit auth headers
      console.log('🔐 Using authenticated direct docs fetch');
    } else {
      fetchOptions.mode = 'cors';
      console.log('📂 Using non-authenticated direct docs fetch');
    }
    
    const response = await fetch(url, fetchOptions);
    
    // Log redirect information
    if (response.url !== url) {
      console.log(`🔄 Redirect detected: ${url} -> ${response.url}`);
    }
    
    if (!response.ok) {
      console.warn(`❌ Fetch failed with status ${response.status} for: ${url}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const content = await response.text();
    console.log(`✅ Successfully fetched docs (${content.length} chars) from:`, response.url);
    return content;
  } catch (error) {
    console.warn(`❌ Direct docs fetch failed for ${url}:`, error);
    return null;
  }
}

/**
 * Try multiple URL patterns to handle redirects and moved pages
 */
async function fetchWithRetry(originalUrl: string): Promise<string | null> {
  console.log(`🔄 Starting fetchWithRetry for: ${originalUrl}`);
  
  // First try the original URL
  let content = await fetchDirectFast(originalUrl);
  if (content && content.trim().length > 0) {
    return content;
  }
  
  // If the original failed, try common redirect patterns
  const urlVariations = generateUrlVariations(originalUrl);
  
  for (let i = 0; i < urlVariations.length; i++) {
    const variation = urlVariations[i];
    console.log(`🔄 Retry ${i + 1}/${urlVariations.length}: Trying variation: ${variation}`);
    
    content = await fetchDirectFast(variation);
    if (content && content.trim().length > 0) {
      console.log(`✅ Success with URL variation: ${variation}`);
      return content;
    }
  }
  
  console.warn(`❌ All retry attempts failed for: ${originalUrl}`);
  return null;
}

/**
 * Generate URL variations to handle common redirect patterns
 */
function generateUrlVariations(url: string): string[] {
  const variations: string[] = [];
  
  // Split hash fragment to preserve it
  const [baseUrlWithUnstyled, hashFragment] = url.split('#');
  
  // Remove /unstyled.html to get base URL
  const baseUrl = baseUrlWithUnstyled.replace(/\/unstyled\.html$/, '/');
  
  // Common patterns for moved documentation
  const patterns = [
    // Try without trailing slash + unstyled.html
    baseUrl.replace(/\/$/, '') + '/unstyled.html',
    
    // Try adding common suffixes that indicate moved content
    baseUrl + 'configuration/unstyled.html',
    baseUrl + 'setup/unstyled.html',
    baseUrl + 'get-started/unstyled.html',
    
    // Try variations with different directory structures
    baseUrl.replace(/\/([^\/]+)\/$/, '/$1-config/$1/unstyled.html'),
    baseUrl.replace(/\/([^\/]+)\/$/, '/$1/$1/unstyled.html'),
    
    // Try the parent directory
    baseUrl.replace(/\/[^\/]+\/$/, '/unstyled.html'),
    
    // Try without the last path segment
    baseUrl.split('/').slice(0, -2).join('/') + '/unstyled.html',
  ];
  
  // Re-attach hash fragment if it exists and remove duplicates
  const uniquePatterns = [...new Set(patterns)]
    .filter(p => p !== baseUrlWithUnstyled && p.includes('/unstyled.html'))
    .map(p => hashFragment ? `${p}#${hashFragment}` : p);
  
  console.log(`🔄 Generated ${uniquePatterns.length} URL variations for: ${url}`);
  uniquePatterns.forEach((pattern, index) => {
    console.log(`  ${index + 1}. ${pattern}`);
  });
  
  return uniquePatterns;
}



/**
 * Clear single docs cache
 */
export function clearSingleDocsCache(): void {
  try {
    docsContentCache.clear();
    console.log('Cleared single docs cache');
  } catch (error) {
    console.warn('Failed to clear single docs cache:', error);
  }
}

/**
 * Clear cache for a specific docs URL
 */
export function clearSpecificDocsCache(url: string): void {
  try {
    docsContentCache.delete(url);
    console.log(`Cleared docs cache for: ${url}`);
  } catch (error) {
    console.warn('Failed to clear specific docs cache:', error);
  }
} 
