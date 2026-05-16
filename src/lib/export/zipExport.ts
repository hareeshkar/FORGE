import JSZip from "jszip";
import type { ProjectFile } from "@/lib/types";

export async function downloadProjectZip(
  files: ProjectFile[],
  projectName?: string
): Promise<void> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.name, file.content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${projectName ?? "forge-project"}.zip`;
  anchor.click();

  URL.revokeObjectURL(url);
}
