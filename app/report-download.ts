/** Keep the editor in place even when a browser opens PDFs instead of saving
 * them. Retain the object URL long enough for the native download/viewer. */
export function startReportDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  try {
    document.body.appendChild(link);
    link.click();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  } finally { link.remove(); }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
