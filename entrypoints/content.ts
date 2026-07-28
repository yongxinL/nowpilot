// Content script for screen capture, text quote selection, and DOM inspection
export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('NowPilot Content Script loaded on page');

    // Listen for text selection to enable instant quote action
    document.addEventListener('mouseup', () => {
      const selectedText = window.getSelection()?.toString().trim();
      if (selectedText && selectedText.length > 5) {
        // Can post message to extension sidepanel
      }
    });
  },
});

function defineContentScript(config: { matches: string[]; main: () => void }) {
  return config.main;
}
