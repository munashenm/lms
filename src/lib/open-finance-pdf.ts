export async function openFinancePdf(res: Response, filename: string, intent: "print" | "download" = "print") {
  if (!res.ok) throw new Error("Could not load PDF");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  if (intent === "download") {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    return;
  }

  const opened = window.open(url, "_blank", "noopener");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
