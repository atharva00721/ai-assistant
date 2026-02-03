type Hunk = {
  oldLines: string[];
  newLines: string[];
};

type PatchFile = {
  path: string;
  hunks: Hunk[];
};

export function parseApplyPatch(patchText: string): PatchFile[] {
  const lines = patchText.split(/\r?\n/);
  let i = 0;
  if (!lines[i]?.startsWith("*** Begin Patch")) {
    throw new Error("Patch must start with *** Begin Patch");
  }
  i++;

  const files: PatchFile[] = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line?.startsWith("*** End Patch")) break;

    if (line?.startsWith("*** Update File: ")) {
      const path = line.replace("*** Update File: ", "").trim();
      i++;
      const hunks: Hunk[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (l?.startsWith("*** Update File: ") || l?.startsWith("*** End Patch")) break;
        if (l?.startsWith("@@")) {
          i++;
          const oldLines: string[] = [];
          const newLines: string[] = [];
          while (i < lines.length) {
            const hl = lines[i];
            if (!hl) {
              oldLines.push("");
              newLines.push("");
              i++;
              continue;
            }
            if (hl.startsWith("@@") || hl.startsWith("***")) break;
            const tag = hl[0];
            const content = hl.slice(1);
            if (tag === " ") {
              oldLines.push(content);
              newLines.push(content);
            } else if (tag === "-") {
              oldLines.push(content);
            } else if (tag === "+") {
              newLines.push(content);
            } else {
              throw new Error(`Invalid hunk line: ${hl}`);
            }
            i++;
          }
          hunks.push({ oldLines, newLines });
          continue;
        }
        i++;
      }
      files.push({ path, hunks });
      continue;
    }
    if (line?.startsWith("*** Add File:") || line?.startsWith("*** Delete File:")) {
      throw new Error("Add/Delete File patches are not supported in v1");
    }
    i++;
  }
  return files;
}

function findSubsequence(haystack: string[], needle: string[], startAt: number): number {
  if (needle.length === 0) return startAt;
  outer: for (let i = startAt; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export function applyPatchToText(
  text: string,
  patchText: string,
  path: string,
): { updatedText: string; files: PatchFile[] } {
  const files = parseApplyPatch(patchText);
  const target = files.find((f) => f.path === path);
  if (!target) {
    throw new Error(`No patch found for ${path}`);
  }

  const lines = text.split(/\r?\n/);
  let cursor = 0;
  for (const hunk of target.hunks) {
    const idx = findSubsequence(lines, hunk.oldLines, cursor);
    if (idx < 0) {
      throw new Error("Failed to apply patch: context not found");
    }
    lines.splice(idx, hunk.oldLines.length, ...hunk.newLines);
    cursor = idx + hunk.newLines.length;
  }
  return { updatedText: lines.join("\n"), files };
}

export function applyV4ADiffToText(text: string, diff: string): string {
  const lines = diff.split(/\r?\n/);
  const hunks: Hunk[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line?.startsWith("@@")) {
      i++;
      const oldLines: string[] = [];
      const newLines: string[] = [];
      while (i < lines.length) {
        const hl = lines[i];
        if (hl?.startsWith("@@")) break;
        if (!hl) {
          oldLines.push("");
          newLines.push("");
          i++;
          continue;
        }
        const tag = hl[0];
        const content = hl.slice(1);
        if (tag === " ") {
          oldLines.push(content);
          newLines.push(content);
        } else if (tag === "-") {
          oldLines.push(content);
        } else if (tag === "+") {
          newLines.push(content);
        } else {
          throw new Error(`Invalid diff line: ${hl}`);
        }
        i++;
      }
      hunks.push({ oldLines, newLines });
      continue;
    }
    i++;
  }

  const textLines = text.split(/\r?\n/);
  let cursor = 0;
  for (const hunk of hunks) {
    const idx = findSubsequence(textLines, hunk.oldLines, cursor);
    if (idx < 0) {
      throw new Error("Failed to apply diff: context not found");
    }
    textLines.splice(idx, hunk.oldLines.length, ...hunk.newLines);
    cursor = idx + hunk.newLines.length;
  }
  return textLines.join("\n");
}
