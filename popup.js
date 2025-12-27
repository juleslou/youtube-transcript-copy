// Configuration constants
const CONFIG = {
  EXPAND_WAIT_MS: 800,
  INITIAL_WAIT_MS: 1000,  // Reduced from 2000 - YouTube loads fast now
  RETRY_WAIT_MS: 1000,
  MAX_RETRY_ATTEMPTS: 15
};

document.addEventListener('DOMContentLoaded', async () => {
  const copyBtn = document.getElementById('copyBtn');
  const timestampToggle = document.getElementById('timestampToggle');
  const status = document.getElementById('status');

  const { includeTimestamps = false } = await chrome.storage.local.get('includeTimestamps');
  timestampToggle.checked = includeTimestamps;

  // Update ARIA state for accessibility
  const toggleLabel = timestampToggle.closest('.toggle');
  if (toggleLabel) {
    toggleLabel.setAttribute('aria-checked', includeTimestamps.toString());
  }

  timestampToggle.addEventListener('change', () => {
    chrome.storage.local.set({ includeTimestamps: timestampToggle.checked });
    // Update ARIA state
    if (toggleLabel) {
      toggleLabel.setAttribute('aria-checked', timestampToggle.checked.toString());
    }
  });

  // Display keyboard shortcut (static to avoid symbol rendering issues)
  const isMac = navigator.platform.includes('Mac');
  document.getElementById('shortcutDisplay').textContent = isMac ? 'Opt+Shift+C' : 'Alt+Shift+C';

  // Open Chrome shortcuts settings
  document.getElementById('changeShortcut').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  // Auto-copy if opened via keyboard shortcut
  const { openedViaShortcut } = await chrome.storage.local.get('openedViaShortcut');
  if (openedViaShortcut) {
    await chrome.storage.local.remove('openedViaShortcut');
    setTimeout(() => copyBtn.click(), 50);
  }

  copyBtn.addEventListener('click', async () => {
    copyBtn.disabled = true;
    showStatus('loading', 'Opening transcript...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url?.includes('youtube.com/watch')) {
        throw new Error('NOT_YOUTUBE');
      }

      // Step 1a: First, expand the description (separate step with wait)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: expandDescription
      });

      // Wait for description to expand and render
      await new Promise(r => setTimeout(r, CONFIG.EXPAND_WAIT_MS));

      // Step 1b: Now check if transcript is already open, if not, open it
      const checkResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: checkAndOpenTranscript
      });

      const checkStatus = checkResult[0]?.result;
      console.log('Check status:', checkStatus);

      if (checkStatus?.error) {
        throw new Error(checkStatus.error);
      }

      // Step 2: Wait for transcript to load and extract with retries
      showStatus('loading', 'Loading transcript...');

      let result = null;

      for (let attempt = 0; attempt < CONFIG.MAX_RETRY_ATTEMPTS; attempt++) {
        // Wait before each attempt (longer initial wait if we just opened)
        const waitTime = attempt === 0 && checkStatus?.justOpened ? CONFIG.INITIAL_WAIT_MS : CONFIG.RETRY_WAIT_MS;
        await new Promise(r => setTimeout(r, waitTime));

        // Try to extract
        const extractResult = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          func: extractTranscript,
          args: [timestampToggle.checked]
        });

        result = extractResult[0]?.result;
        console.log(`Attempt ${attempt + 1}:`, result);

        // If we got segments, we're done
        if (result?.transcript) {
          break;
        }

        // If error is not about empty segments, stop retrying
        if (result?.error && result.error !== 'NO_SEGMENTS') {
          break;
        }

        // Descriptive progress messages instead of attempt counter
        const progressMessages = ['Reading transcript...', 'Almost there...', 'Still loading...'];
        const msgIndex = Math.min(Math.floor(attempt / 5), progressMessages.length - 1);
        showStatus('loading', progressMessages[msgIndex]);
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      if (result?.transcript) {
        await navigator.clipboard.writeText(result.transcript);
        const charDisplay = result.charCount.toLocaleString();
        showStatus('success', `Copied ${result.lineCount} lines (${charDisplay} chars)`);
      } else {
        throw new Error('NO_TRANSCRIPT');
      }

    } catch (err) {
      console.error('Error:', err);
      const messages = {
        'NOT_YOUTUBE': 'Please open a YouTube video first',
        'NO_TRANSCRIPT': 'No transcript found for this video',
        'NO_CAPTIONS': 'This video has no captions available',
        'NO_TRANSCRIPT_BUTTON': 'Transcript not available for this video',
        'NO_SEGMENTS': 'Transcript loading slowly. Please try again.'
      };
      showStatus('error', messages[err.message] || err.message || 'Something went wrong');
    } finally {
      copyBtn.disabled = false;
    }
  });

  function showStatus(type, message) {
    status.className = 'status ' + type;
    status.textContent = message;

    if (type === 'success') {
      setTimeout(() => { status.className = 'status'; }, 3000);
    }
  }
});

// Step 0: Expand the description first (called separately with wait)
function expandDescription() {
  try {
    const expandSelectors = [
      'tp-yt-paper-button#expand',
      '#expand',
      '#description-inline-expander #expand',
      'ytd-text-inline-expander #expand',
      '[aria-label="Show more"]',
      'ytd-expander[collapsed] #more',
      '#description #expand'
    ];

    for (const selector of expandSelectors) {
      const expandBtn = document.querySelector(selector);
      if (expandBtn && expandBtn.offsetParent !== null) {
        expandBtn.click();
        return { expanded: true };
      }
    }
    return { expanded: false };
  } catch (e) {
    return { error: e.message };
  }
}

// Step 1: Check if transcript is open, if not open it
function checkAndOpenTranscript() {
  try {
    // Check if transcript segments already exist
    const existingSegments = document.querySelectorAll('ytd-transcript-segment-renderer');
    if (existingSegments.length > 0) {
      return { alreadyOpen: true, segmentCount: existingSegments.length };
    }

    // Look for "Show transcript" button using multiple strategies
    let transcriptButton = null;

    // Strategy 1: Direct selectors for transcript section in description
    const transcriptSectionSelectors = [
      'ytd-video-description-transcript-section-renderer button',
      'ytd-video-description-transcript-section-renderer yt-button-shape button',
      'ytd-video-description-transcript-section-renderer'
    ];

    for (const selector of transcriptSectionSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        // If it's the section itself, find the button inside
        transcriptButton = el.tagName === 'BUTTON' ? el : el.querySelector('button');
        if (transcriptButton) break;
      }
    }

    // Strategy 2: aria-label based search (multi-language support)
    if (!transcriptButton) {
      const ariaLabels = [
        'show transcript',
        'transcript',
        'transcrição',
        'transcripción',
        '顯示轉錄稿',
        '显示字幕'
      ];

      const allButtons = document.querySelectorAll('button, [role="button"]');
      for (const btn of allButtons) {
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (ariaLabels.some(label => ariaLabel.includes(label))) {
          transcriptButton = btn;
          break;
        }
      }
    }

    // Strategy 3: Text content search
    if (!transcriptButton) {
      const searchTexts = ['show transcript', 'transcript', 'transcrição', 'transcripción'];
      const allClickables = document.querySelectorAll('button, ytd-button-renderer, yt-button-shape, [role="button"]');

      for (const el of allClickables) {
        const text = (el.textContent || '').toLowerCase().trim();
        if (searchTexts.some(searchText => text.includes(searchText))) {
          transcriptButton = el.tagName === 'BUTTON' ? el : el.querySelector('button') || el;
          break;
        }
      }
    }

    // Strategy 4: Look in engagement panels menu (three dots menu)
    if (!transcriptButton) {
      // Click more actions menu if it exists
      const moreActionsBtn = document.querySelector('button[aria-label="More actions"], #button-shape button[aria-label="More actions"]');
      if (moreActionsBtn) {
        moreActionsBtn.click();

        // Look for transcript in the dropdown
        const menuItems = document.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-item');
        for (const item of menuItems) {
          const text = (item.textContent || '').toLowerCase();
          if (text.includes('transcript')) {
            transcriptButton = item;
            break;
          }
        }
      }
    }

    if (!transcriptButton) {
      // Check if video has captions at all
      const pr = window.ytInitialPlayerResponse;
      const hasCaptions = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length > 0;
      if (!hasCaptions) {
        return { error: 'NO_CAPTIONS' };
      }
      return { error: 'NO_TRANSCRIPT_BUTTON' };
    }

    // Click the button to open transcript
    transcriptButton.click();

    return { justOpened: true };

  } catch (e) {
    console.error('Error in checkAndOpenTranscript:', e);
    return { error: e.message };
  }
}

// Step 2: Extract transcript from DOM
function extractTranscript(includeTimestamps) {
  try {
    // Try multiple selectors for transcript segments
    const segmentSelectors = [
      'ytd-transcript-segment-renderer',
      '.ytd-transcript-segment-renderer',
      'ytd-transcript-segment-list-renderer ytd-transcript-segment-renderer'
    ];

    let segments = [];
    for (const selector of segmentSelectors) {
      segments = document.querySelectorAll(selector);
      if (segments.length > 0) break;
    }

    if (segments.length === 0) {
      return { error: 'NO_SEGMENTS' };
    }

    const lines = [];

    // Multiple selectors for text and timestamp
    const textSelectors = ['.segment-text', '[class*="segment-text"]', 'yt-formatted-string'];
    const timestampSelectors = ['.segment-timestamp', '[class*="segment-timestamp"]'];

    segments.forEach((seg) => {
      let text = '';
      let timestamp = '';

      // Find text
      for (const selector of textSelectors) {
        const el = seg.querySelector(selector);
        if (el?.textContent?.trim()) {
          text = el.textContent.trim();
          break;
        }
      }

      // Find timestamp
      for (const selector of timestampSelectors) {
        const el = seg.querySelector(selector);
        if (el?.textContent?.trim()) {
          timestamp = el.textContent.trim();
          break;
        }
      }

      if (text) {
        if (includeTimestamps && timestamp) {
          lines.push(`[${timestamp}] ${text}`);
        } else {
          lines.push(text);
        }
      }
    });

    if (lines.length === 0) {
      return { error: 'NO_TRANSCRIPT' };
    }

    const transcript = lines.join('\n');
    return {
      transcript,
      lineCount: lines.length,
      charCount: transcript.length
    };

  } catch (e) {
    console.error('Error in extractTranscript:', e);
    return { error: e.message };
  }
}
