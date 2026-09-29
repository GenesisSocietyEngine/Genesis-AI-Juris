# Actual Chrome zoom probe

Verified 2026-09-29 on local http://127.0.0.1:4197 using isolated session ds1-zoom-probe and Chrome for Testing 154.0.8037.57. The ds1-contrast session was not accessed.

## Launch (PowerShell)

```powershell
$browserTool = 'C:/PROJECTS/Genesis-Juris-DS1-Tools-2026-09-29/node_modules/agent-browser/bin/agent-browser-win32-x64.exe'
$extensionRoot = 'C:/PROJECTS/Genesis-Juris-DS1-Tools-2026-09-29/zoom-extension'
& $browserTool --session ds1-zoom-probe --profile "$extensionRoot/profile" --executable-path 'C:/Users/User/.cache/puppeteer/chrome/win64-154.0.8037.57/chrome-win64/chrome.exe' --extension $extensionRoot open 'http://127.0.0.1:4197/?lang=en'
Get-Content -Raw "$extensionRoot/probe-100.js" | & $browserTool --session ds1-zoom-probe --json eval --stdin
Get-Content -Raw "$extensionRoot/probe-200.js" | & $browserTool --session ds1-zoom-probe --json eval --stdin
```

The existing probes set the factor via a message bridge to the extension service worker. The worker calls chrome.tabs.setZoomSettings({mode:'automatic',scope:'per-tab'}), chrome.tabs.setZoom(tabId,1 or 2), then chrome.tabs.getZoom and getZoomSettings. The sender URL must start with exactly http://127.0.0.1:4197/. Only factors 1 and 2 are accepted. No DOM style, CSS zoom, device scale override, or app source is changed. Application navigation/fixture import remains under the main verifier's control.

Per-tab zoom resets on navigation, per Chrome API. Run probe-200 again after actual page navigation. The probe waits two animation frames after the zoom API receipt before reading page dimensions. Reapplying 2 is harmless. The page itself must be at 127.0.0.1, not localhost, for the message bridge.

## Measured evidence

| Receipt | Chrome getZoom | DPR | Inner W/H | Outer W/H | HTML/body CSS zoom | Visual viewport scale |
|---|---:|---:|---|---|---|---:|
| receipt-100.json | 1 | 1.25 | 1036 x 647 | 1051 x 798 | 1 / 1 | 1 |
| receipt-200.json | 2 | 2.5 | 518 x 323 | 1051 x 798 | 1 / 1 | 1 |

Mechanism-probe screenshots `zoom-100.png` and `zoom-200.png` remain in the original tools directory, outside this curated repository evidence. Their receipts are retained here. This is a browser-zoom mechanism proof on the real local application's entry screen, not completed DS-1 fixture acceptance.

Official API: https://developer.chrome.com/docs/extensions/reference/api/tabs#method-setZoom
Settings: https://developer.chrome.com/docs/extensions/reference/api/tabs#type-ZoomSettingsScope

## Close only the owned probe session

```powershell
& $browserTool --session ds1-zoom-probe close
```

Never use --all. Do not commit the browser profile or instrumentation folder to the application repository. Relevant source/receipts can be copied selectively into the implementation evidence folder by its owner.

## Curated copy

This folder selectively preserves instrumentation and completed fixture matrices from the original owned tools directory. Only three before/after PNG pairs are committed. Full raw captures remain at `C:/PROJECTS/Genesis-Juris-DS1-Tools-2026-09-29/zoom-extension/`. The exact harness retains those original paths; reproduce in an owned tools directory and adjust paths when moving environments. Do not run the capture harness inside a shared browser profile.
