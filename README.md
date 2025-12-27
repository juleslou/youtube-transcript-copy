# YouTube Transcript Copier

A minimal Chrome extension that copies YouTube video transcripts to your clipboard with one click.

## Features

- One-click transcript copying
- Optional timestamps toggle
- Works with auto-generated and manual captions
- Supports videos in any language
- Remembers your timestamp preference
- Keyboard shortcut: `Alt+Shift+C` (`Option+Shift+C` on Mac) — customizable

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `youtube-transcript-copy` folder

## Usage

**Via keyboard shortcut (fastest):**
- Press `Alt+Shift+C` (or `Option+Shift+C` on Mac)
- Transcript is copied automatically

**Via extension icon:**
1. Click the extension icon in your toolbar
2. Toggle timestamps on/off if desired
3. Click "Copy Transcript"

## Troubleshooting

**"Please open a YouTube video first"**
- Make sure you're on a youtube.com/watch page

**"This video has no captions available"**
- The video doesn't have any captions (auto-generated or manual)

**"Transcript not available for this video"**
- The video has captions but no transcript button (rare edge case)

**"Transcript loading slowly. Please try again."**
- YouTube took too long to load. Refresh the page and try again.

## Privacy

This extension:
- Does NOT collect any data
- Does NOT send data to any servers
- Only accesses youtube.com pages
- Stores only your timestamp preference locally

See [PRIVACY.md](PRIVACY.md) for full privacy policy.

## License

MIT License - see [LICENSE](LICENSE) for details.
