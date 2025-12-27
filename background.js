// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'copy-transcript') {
    // Set flag for popup to detect
    await chrome.storage.local.set({ openedViaShortcut: true });

    // Open popup - requires Chrome 99+
    try {
      await chrome.action.openPopup();
    } catch (e) {
      console.log('openPopup failed:', e);
    }
  }
});
