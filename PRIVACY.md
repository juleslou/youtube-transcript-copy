# Privacy Policy

**YouTube Transcript Copier** respects your privacy. This document explains what data the extension accesses and how it is used.

## Data Collection

**We do NOT collect any data.**

This extension:
- Does not collect personal information
- Does not collect usage analytics
- Does not track your browsing history
- Does not send any data to external servers

## Data Storage

The extension stores only one piece of information locally on your device:
- Your timestamp preference (on/off toggle)

This is stored using Chrome's local storage API and never leaves your device.

## Permissions Explained

| Permission | Purpose |
|------------|---------|
| `activeTab` | Access the current YouTube tab to extract transcript |
| `scripting` | Inject script to read transcript from YouTube's page |
| `storage` | Save your timestamp preference locally |
| `host_permissions` (youtube.com) | Required to interact with YouTube pages |

## Network Requests

This extension makes **no external network requests**. All transcript data is extracted directly from YouTube's page DOM and copied to your local clipboard.

## Third Parties

This extension does not share any data with third parties because it does not collect any data.

## Contact

For questions about this privacy policy, please open an issue on the project repository.

---

*Last updated: December 2024*
