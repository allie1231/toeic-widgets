import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeJsonAtomic(filePath, value) {
  const outputPath = path.resolve(filePath);
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;

  await mkdir(path.dirname(outputPath), { recursive: true });

  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporaryPath, outputPath);
  } finally {
    await unlink(temporaryPath).catch(() => {});
  }
}
