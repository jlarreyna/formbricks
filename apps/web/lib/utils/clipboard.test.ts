/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { copyTextToClipboard } from "./clipboard";

describe("copyTextToClipboard", () => {
  const writeText = vi.fn();
  const execCommand = vi.fn();

  beforeEach(() => {
    writeText.mockReset();
    execCommand.mockReset();
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("uses the Clipboard API in a secure context", async () => {
    writeText.mockResolvedValue(undefined);

    await copyTextToClipboard("userId");

    expect(writeText).toHaveBeenCalledWith("userId");
    expect(execCommand).not.toHaveBeenCalled();
  });

  test("falls back to execCommand when Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    execCommand.mockReturnValue(true);

    await copyTextToClipboard("email");

    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  test("falls back to execCommand when Clipboard API rejects", async () => {
    writeText.mockRejectedValue(new Error("NotAllowedError"));
    execCommand.mockReturnValue(true);

    await copyTextToClipboard("firstName");

    expect(writeText).toHaveBeenCalledWith("firstName");
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  test("throws when both clipboard methods fail", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    execCommand.mockReturnValue(false);

    await expect(copyTextToClipboard("userId")).rejects.toThrow("Failed to copy text with execCommand");
  });
});
