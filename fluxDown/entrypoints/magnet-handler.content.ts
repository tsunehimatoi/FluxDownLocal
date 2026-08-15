/**
 * Minimal page integration for magnet links.
 *
 * This content script deliberately does not inspect page resources, observe DOM
 * mutations, inject main-world scripts, or intercept fetch/XHR.
 */
import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import { loadSettings } from "@/utils/settings";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",

  async main(ctx) {
    let enabled = true;
    try {
      enabled = (await loadSettings()).interceptMagnet !== false;
    } catch {
      // Preserve the default setting if storage is temporarily unavailable.
    }

    const handleSettingsChanged = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area !== "sync" || !changes.settings) return;
      const next = changes.settings.newValue as
        | { interceptMagnet?: boolean }
        | undefined;
      if (next) enabled = next.interceptMagnet !== false;
    };

    const handleClick = (event: MouseEvent) => {
      if (!enabled || !(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]") as HTMLAnchorElement | null;
      const url = link?.href;
      if (!url?.toLowerCase().startsWith("magnet:")) return;

      event.preventDefault();
      event.stopPropagation();
      browser.runtime
        .sendMessage({
          action: "downloadResource",
          url,
          filename: magnetDisplayName(url),
        })
        .catch(() => {});
    };

    browser.storage.onChanged.addListener(handleSettingsChanged);
    document.addEventListener("click", handleClick, true);
    ctx.onInvalidated(() => {
      browser.storage.onChanged.removeListener(handleSettingsChanged);
      document.removeEventListener("click", handleClick, true);
    });
  },
});

function magnetDisplayName(uri: string): string | undefined {
  try {
    return new URLSearchParams(uri.split("?", 2)[1] || "").get("dn") || undefined;
  } catch {
    return undefined;
  }
}
