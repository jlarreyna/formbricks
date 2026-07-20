/**
 * Copies text to the clipboard, using the Clipboard API when available and
 * falling back to document.execCommand for non-secure contexts (e.g. HTTP).
 */
export const copyTextToClipboard = async (text: string): Promise<void> => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy approach when the Clipboard API rejects.
    }
  }

  copyTextWithExecCommand(text);
};

const copyTextWithExecCommand = (text: string): void => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const selectedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    const success = document.execCommand("copy");
    if (!success) {
      throw new Error("Failed to copy text with execCommand");
    }
  } finally {
    document.body.removeChild(textarea);
    if (selectedRange && selection) {
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }
  }
};
