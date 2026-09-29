import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { basename, delimiter, dirname, extname, join, relative, resolve } from "node:path";
import { inflateSync } from "node:zlib";

export type PopplerTools = {
  pdfinfo: string;
  pdftotext: string;
  pdftoppm: string;
  versions: Record<"pdfinfo" | "pdftotext" | "pdftoppm", string>;
};

export type PdfPageBox = {
  page: number;
  widthPoints: number;
  heightPoints: number;
  mediaBox: [number, number, number, number];
  rotationDegrees: number;
};

export type PdfInfo = {
  pages: number;
  pageBoxes: PdfPageBox[];
  title: string;
  raw: string;
};

export type PngSanity = {
  width: number;
  height: number;
  sha256: string;
  meanLuminance: number;
  minimumLuminance: number;
  maximumLuminance: number;
  nonWhiteFraction: number;
  nearBlackFraction: number;
};

export type RenderedPdfPage = PngSanity & {
  page: number;
  path: string;
};

const TOOL_NAMES = ["pdfinfo", "pdftotext", "pdftoppm"] as const;
const WINDOWS_EXECUTABLE_SUFFIX = process.platform === "win32" ? ".exe" : "";

function assertion(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function executable(path: string) {
  try {
    accessSync(path, constants.F_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function runnable(command: string) {
  const result = spawnSync(command, ["-v"], { encoding: "utf8", windowsHide: true });
  return !result.error && result.status === 0;
}

function findDirectoryWithTools(root: string, depth: number): string | null {
  if (depth < 0 || !existsSync(root)) return null;
  const complete = TOOL_NAMES.every((name) => executable(join(root, `${name}${WINDOWS_EXECUTABLE_SUFFIX}`)));
  if (complete) return root;
  if (depth === 0) return null;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const found = findDirectoryWithTools(join(root, entry.name), depth - 1);
    if (found) return found;
  }
  return null;
}

function toolVersion(command: string) {
  const result = spawnSync(command, ["-v"], { encoding: "utf8", windowsHide: true });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  return output.split(/\r?\n/, 1)[0] || "unknown";
}

/** Locate Poppler without embedding a workstation-specific absolute path. */
export function discoverPoppler(projectRoot: string): PopplerTools {
  const explicit = {
    pdfinfo: process.env.REPORT_PDF_PDFINFO,
    pdftotext: process.env.REPORT_PDF_PDFTOTEXT,
    pdftoppm: process.env.REPORT_PDF_PDFTOPPM,
  };
  if (Object.values(explicit).some(Boolean)) {
    for (const name of TOOL_NAMES) {
      assertion(explicit[name], `All REPORT_PDF_* Poppler overrides are required when one is set; missing REPORT_PDF_${name.toUpperCase()}`);
      assertion(runnable(explicit[name]), `Configured REPORT_PDF_${name.toUpperCase()} is not runnable: ${explicit[name]}`);
    }
    const configured = explicit as Record<(typeof TOOL_NAMES)[number], string>;
    return {
      pdfinfo: configured.pdfinfo,
      pdftotext: configured.pdftotext,
      pdftoppm: configured.pdftoppm,
      versions: Object.fromEntries(TOOL_NAMES.map((name) => [name, toolVersion(configured[name])])) as PopplerTools["versions"],
    };
  }

  const candidateDirectories = [
    process.env.POPPLER_BIN,
    resolve(projectRoot, ".tools/poppler/bin"),
    resolve(projectRoot, ".tools/poppler/Library/bin"),
    process.env.ProgramFiles ? join(process.env.ProgramFiles, "poppler", "Library", "bin") : undefined,
    process.env.ProgramFiles ? join(process.env.ProgramFiles, "poppler", "bin") : undefined,
    process.env.ChocolateyInstall ? join(process.env.ChocolateyInstall, "bin") : undefined,
    "/usr/bin",
    "/usr/local/bin",
    "/opt/homebrew/bin",
    ...(process.env.PATH ?? "").split(delimiter),
  ].filter((value): value is string => Boolean(value));

  let directory = candidateDirectories.find((candidate) => TOOL_NAMES.every((name) => executable(join(candidate, `${name}${WINDOWS_EXECUTABLE_SUFFIX}`))));
  if (!directory && process.platform === "win32") {
    const searchRoots = [
      process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Packages") : undefined,
      process.env.ChocolateyInstall ? join(process.env.ChocolateyInstall, "lib", "poppler", "tools") : undefined,
    ].filter((value): value is string => Boolean(value));
    for (const searchRoot of searchRoots) {
      directory = findDirectoryWithTools(searchRoot, 6) ?? undefined;
      if (directory) break;
    }
  }

  if (!directory && TOOL_NAMES.every((name) => runnable(name))) {
    const commands = Object.fromEntries(TOOL_NAMES.map((name) => [name, name])) as Record<(typeof TOOL_NAMES)[number], string>;
    return { ...commands, versions: Object.fromEntries(TOOL_NAMES.map((name) => [name, toolVersion(name)])) as PopplerTools["versions"] };
  }
  assertion(directory, "Poppler is required: install pdfinfo, pdftotext and pdftoppm; put them on PATH, set POPPLER_BIN, or set all REPORT_PDF_PDFINFO / REPORT_PDF_PDFTOTEXT / REPORT_PDF_PDFTOPPM overrides");

  const commands = Object.fromEntries(TOOL_NAMES.map((name) => [name, join(directory, `${name}${WINDOWS_EXECUTABLE_SUFFIX}`)])) as Record<(typeof TOOL_NAMES)[number], string>;
  return { ...commands, versions: Object.fromEntries(TOOL_NAMES.map((name) => [name, toolVersion(commands[name])])) as PopplerTools["versions"] };
}

export function runTool(command: string, args: string[], label: string, maxBuffer = 64 * 1024 * 1024) {
  try {
    return execFileSync(command, args, { encoding: "utf8", maxBuffer, windowsHide: true });
  } catch (error) {
    const failure = error as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    const stdout = String(failure.stdout ?? "").trim();
    const stderr = String(failure.stderr ?? "").trim();
    const detail = [stdout, stderr, failure.message].filter(Boolean).join("\n");
    throw new Error(`${label} failed${failure.status === undefined ? "" : ` with exit ${failure.status}`}${detail ? `:\n${detail}` : ""}`);
  }
}

function parseNumber(value: string, label: string) {
  const parsed = Number(value);
  assertion(Number.isFinite(parsed), `pdfinfo returned invalid ${label}: ${value}`);
  return parsed;
}

export function inspectPdf(tools: PopplerTools, pdfPath: string): PdfInfo {
  const summary = runTool(tools.pdfinfo, ["-box", pdfPath], `pdfinfo ${basename(pdfPath)}`);
  const pages = Number(summary.match(/^Pages:\s+(\d+)\s*$/m)?.[1] ?? 0);
  const title = summary.match(/^Title:\s*(.*?)\s*$/m)?.[1]?.trim() ?? "";
  assertion(Number.isInteger(pages) && pages > 0, `pdfinfo did not report a positive page count for ${pdfPath}`);
  const raw = runTool(tools.pdfinfo, ["-box", "-f", "1", "-l", String(pages), pdfPath], `pdfinfo -box ${basename(pdfPath)}`);
  const mediaBoxes = new Map<number, [number, number, number, number]>();
  const sizes = new Map<number, [number, number]>();
  const rotations = new Map<number, number>();

  for (const line of raw.split(/\r?\n/)) {
    const mediaBox = line.match(/^(?:Page\s+(\d+)\s+)?MediaBox:\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/i);
    if (mediaBox) {
      const page = Number(mediaBox[1] ?? 1);
      mediaBoxes.set(page, [
        parseNumber(mediaBox[2], "MediaBox x1"),
        parseNumber(mediaBox[3], "MediaBox y1"),
        parseNumber(mediaBox[4], "MediaBox x2"),
        parseNumber(mediaBox[5], "MediaBox y2"),
      ]);
    }
    const size = line.match(/^(?:Page\s+(\d+)\s+)?size:\s+(\d+(?:\.\d+)?)\s+x\s+(\d+(?:\.\d+)?)\s+pts/i);
    if (size) sizes.set(Number(size[1] ?? 1), [parseNumber(size[2], "page width"), parseNumber(size[3], "page height")]);
    const rotation = line.match(/^(?:Page\s+(\d+)\s+)?rot:\s+(-?\d+)\s*$/i);
    if (rotation) rotations.set(Number(rotation[1] ?? 1), parseNumber(rotation[2], "page rotation"));
  }

  const pageBoxes: PdfPageBox[] = [];
  for (let page = 1; page <= pages; page += 1) {
    const mediaBox = mediaBoxes.get(page) ?? (pages === 1 ? mediaBoxes.get(1) : undefined);
    assertion(mediaBox, `pdfinfo did not report Page ${page} MediaBox for ${pdfPath}`);
    const mediaWidth = mediaBox[2] - mediaBox[0];
    const mediaHeight = mediaBox[3] - mediaBox[1];
    const size = sizes.get(page) ?? [mediaWidth, mediaHeight];
    const rotationDegrees = rotations.get(page) ?? (rotations.size === 1 ? [...rotations.values()][0] : undefined);
    assertion(rotationDegrees !== undefined && Number.isInteger(rotationDegrees), `pdfinfo did not report Page ${page} rotation for ${pdfPath}`);
    pageBoxes.push({ page, widthPoints: size[0], heightPoints: size[1], mediaBox, rotationDegrees });
  }
  return { pages, pageBoxes, title, raw };
}

export function assertPdfDocumentMetadata(info: PdfInfo, pdfBytes: Uint8Array, expectedTitle: string, expectedLanguage: "en-GB" | "ru-RU", pdfPath: string) {
  assertion(expectedTitle.trim().length > 0, `${basename(pdfPath)} has an empty expected document Title`);
  assertion(info.title === expectedTitle, `${basename(pdfPath)} pdfinfo Title is ${JSON.stringify(info.title)}; expected ${JSON.stringify(expectedTitle)}`);
  const source = Buffer.from(pdfBytes).toString("latin1");
  assertion(source.includes(`/Lang (${expectedLanguage})`), `${basename(pdfPath)} catalog does not declare /Lang (${expectedLanguage})`);
  assertion(/\/DisplayDocTitle\s+true\b/u.test(source), `${basename(pdfPath)} catalog does not declare /DisplayDocTitle true`);
}

export function assertA4Portrait(info: PdfInfo, pdfPath: string, tolerancePoints = 0.8) {
  const expectedWidth = 595.276;
  const expectedHeight = 841.89;
  for (const box of info.pageBoxes) {
    const mediaWidth = box.mediaBox[2] - box.mediaBox[0];
    const mediaHeight = box.mediaBox[3] - box.mediaBox[1];
    const normalizedRotation = ((box.rotationDegrees % 360) + 360) % 360;
    assertion(normalizedRotation === 0 || normalizedRotation === 180,
      `${basename(pdfPath)} page ${box.page} has landscape PDF rotation ${box.rotationDegrees} degrees`);
    assertion(mediaWidth < mediaHeight, `${basename(pdfPath)} page ${box.page} is not portrait (${mediaWidth} x ${mediaHeight} pt)`);
    assertion(Math.abs(mediaWidth - expectedWidth) <= tolerancePoints && Math.abs(mediaHeight - expectedHeight) <= tolerancePoints,
      `${basename(pdfPath)} page ${box.page} MediaBox is ${mediaWidth} x ${mediaHeight} pt; expected A4 portrait ${expectedWidth} x ${expectedHeight} pt within ${tolerancePoints} pt`);
  }
}

export function extractPdfText(tools: PopplerTools, pdfPath: string, textPath: string) {
  runTool(tools.pdftotext, ["-layout", "-enc", "UTF-8", pdfPath, textPath], `pdftotext ${basename(pdfPath)}`);
  const text = readFileSync(textPath, "utf8");
  assertion(text.trim().length > 0, `pdftotext produced no text for ${pdfPath}`);
  return text;
}

export function splitExtractedPdfPages(value: string, expectedPages: number, pdfPath: string) {
  const pages = value.split("\f");
  while (pages.length > expectedPages && pages.at(-1)?.trim() === "") pages.pop();
  assertion(pages.length === expectedPages, `${basename(pdfPath)} pdftotext page split produced ${pages.length} pages; expected ${expectedPages}`);
  return pages;
}

export function compactPdfText(value: string, locale: "en" | "ru" = "en") {
  return value.normalize("NFKC").replace(/[\u00ad\u200b-\u200d\ufeff]/gu, "").toLocaleLowerCase(locale).replace(/\s+/gu, "");
}

/** Remove only deterministic report headers/footers that pdftotext inserts inside split records. */
export function stripPdfPageFurniture(value: string) {
  return value.replace(/\f/gu, "\n").split(/\r?\n/gu).filter((line) => {
    const normalized = line.normalize("NFKC").trim();
    if (/^GENESIS:\s*JURIS\s+CODEX(?:\s|$)/iu.test(normalized)) return false;
    if (/^CONFIDENTIAL(?:\s|$).*?\d+\s*\/\s*\d+\s*$/iu.test(normalized)) return false;
    if (/^\d+\s*\/\s*\d+$/u.test(normalized)) return false;
    return true;
  }).join("\n");
}

export function assertExtractedText(haystack: string, expected: string, context: string, locale: "en" | "ru" = "en") {
  const needle = compactPdfText(expected, locale);
  assertion(needle.length > 0, `${context}: expected text is empty`);
  assertion(compactPdfText(haystack, locale).includes(needle), `${context}: pdftotext output does not contain ${JSON.stringify(expected)}`);
}

function paeth(left: number, above: number, upperLeft: number) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance ? left : aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function pngUint32(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function analyzePng(path: string): PngSanity {
  const bytes: Uint8Array = readFileSync(path);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  assertion(signature.every((value, index) => bytes[index] === value), `${path} is not a PNG`);
  let cursor = 8;
  let width = 0;
  let height = 0;
  let bitDepth = -1;
  let colorType = -1;
  let interlace = -1;
  let palette: Uint8Array | null = null;
  const compressed: Uint8Array[] = [];

  while (cursor < bytes.length) {
    assertion(cursor + 12 <= bytes.length, `${path} has a truncated PNG chunk header`);
    const length = pngUint32(bytes, cursor);
    const type = String.fromCharCode(...bytes.subarray(cursor + 4, cursor + 8));
    assertion(cursor + 12 + length <= bytes.length, `${path} has a truncated ${type} PNG chunk`);
    const data = bytes.subarray(cursor + 8, cursor + 8 + length);
    if (type === "IHDR") {
      assertion(length === 13, `${path} has invalid IHDR length ${length}`);
      width = pngUint32(data, 0);
      height = pngUint32(data, 4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") palette = data;
    else if (type === "IDAT") compressed.push(data);
    else if (type === "IEND") break;
    cursor += 12 + length;
  }

  assertion(width > 0 && height > 0, `${path} has no valid IHDR dimensions`);
  assertion(bitDepth === 8, `${path} uses unsupported ${bitDepth}-bit PNG output; expected Poppler 8-bit output`);
  assertion(interlace === 0, `${path} uses unsupported interlaced PNG output`);
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : colorType === 6 ? 4 : 0;
  assertion(channels > 0, `${path} uses unsupported PNG color type ${colorType}`);
  if (colorType === 3) assertion(palette && palette.length >= 3, `${path} has indexed color but no PLTE`);
  assertion(compressed.length > 0, `${path} has no IDAT data`);

  const rowLength = width * channels;
  const raw = inflateSync(Buffer.concat(compressed));
  assertion(raw.length === height * (rowLength + 1), `${path} inflated to ${raw.length} bytes; expected ${height * (rowLength + 1)}`);
  let prior = Buffer.alloc(rowLength);
  let rawOffset = 0;
  let luminanceSum = 0;
  let minimumLuminance = 255;
  let maximumLuminance = 0;
  let nonWhitePixels = 0;
  let nearBlackPixels = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const encoded = raw.subarray(rawOffset, rawOffset + rowLength);
    rawOffset += rowLength;
    const row = Buffer.allocUnsafe(rowLength);
    for (let index = 0; index < rowLength; index += 1) {
      const left = index >= channels ? row[index - channels] : 0;
      const above = prior[index] ?? 0;
      const upperLeft = index >= channels ? prior[index - channels] : 0;
      const adjustment = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : filter === 4 ? paeth(left, above, upperLeft) : -1;
      assertion(adjustment >= 0, `${path} uses unsupported PNG filter ${filter}`);
      row[index] = (encoded[index] + adjustment) & 0xff;
    }

    for (let x = 0; x < width; x += 1) {
      const offset = x * channels;
      let red;
      let green;
      let blue;
      let alpha = 255;
      if (colorType === 0 || colorType === 4) red = green = blue = row[offset];
      else if (colorType === 3) {
        const paletteOffset = row[offset] * 3;
        assertion(palette && paletteOffset + 2 < palette.length, `${path} references missing PNG palette entry ${row[offset]}`);
        red = palette[paletteOffset]; green = palette[paletteOffset + 1]; blue = palette[paletteOffset + 2];
      } else {
        red = row[offset]; green = row[offset + 1]; blue = row[offset + 2];
      }
      if (colorType === 4) alpha = row[offset + 1];
      else if (colorType === 6) alpha = row[offset + 3];
      if (alpha !== 255) {
        red = Math.round((red * alpha + 255 * (255 - alpha)) / 255);
        green = Math.round((green * alpha + 255 * (255 - alpha)) / 255);
        blue = Math.round((blue * alpha + 255 * (255 - alpha)) / 255);
      }
      const luminance = Math.round((red * 299 + green * 587 + blue * 114) / 1000);
      luminanceSum += luminance;
      minimumLuminance = Math.min(minimumLuminance, luminance);
      maximumLuminance = Math.max(maximumLuminance, luminance);
      if (luminance < 250) nonWhitePixels += 1;
      if (luminance <= 16) nearBlackPixels += 1;
    }
    prior = row;
  }

  const pixels = width * height;
  return {
    width,
    height,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    meanLuminance: Number((luminanceSum / pixels).toFixed(3)),
    minimumLuminance,
    maximumLuminance,
    nonWhiteFraction: Number((nonWhitePixels / pixels).toFixed(7)),
    nearBlackFraction: Number((nearBlackPixels / pixels).toFixed(7)),
  };
}

export function renderAndInspectPdf(tools: PopplerTools, pdfPath: string, outputDirectory: string, info: PdfInfo, dpi = 96): RenderedPdfPage[] {
  mkdirSync(outputDirectory, { recursive: true });
  const prefix = resolve(outputDirectory, "page");
  runTool(tools.pdftoppm, ["-png", "-r", String(dpi), pdfPath, prefix], `pdftoppm ${basename(pdfPath)}`, 256 * 1024 * 1024);
  const rendered = readdirSync(outputDirectory)
    .flatMap((name) => {
      const match = name.match(/^page-(\d+)\.png$/i);
      return match ? [{ page: Number(match[1]), path: resolve(outputDirectory, name) }] : [];
    })
    .sort((left, right) => left.page - right.page);
  assertion(rendered.length === info.pages, `${basename(pdfPath)} rendered ${rendered.length} PNGs; expected ${info.pages}`);

  return rendered.map((item, index) => {
    assertion(item.page === index + 1, `${basename(pdfPath)} PNG sequence skips page ${index + 1}`);
    const sanity = analyzePng(item.path);
    const box = info.pageBoxes[index];
    const expectedWidth = Math.round((box.widthPoints * dpi) / 72);
    const expectedHeight = Math.round((box.heightPoints * dpi) / 72);
    assertion(Math.abs(sanity.width - expectedWidth) <= 2 && Math.abs(sanity.height - expectedHeight) <= 2,
      `${basename(pdfPath)} page ${item.page} PNG is ${sanity.width} x ${sanity.height}; expected about ${expectedWidth} x ${expectedHeight} at ${dpi} dpi`);
    assertion(sanity.nonWhiteFraction >= 0.00005 && sanity.maximumLuminance - sanity.minimumLuminance >= 24,
      `${basename(pdfPath)} page ${item.page} appears blank (${(sanity.nonWhiteFraction * 100).toFixed(4)}% non-white; luminance ${sanity.minimumLuminance}-${sanity.maximumLuminance})`);
    assertion(sanity.nearBlackFraction < 0.98 && sanity.meanLuminance > 20,
      `${basename(pdfPath)} page ${item.page} appears black (${(sanity.nearBlackFraction * 100).toFixed(3)}% near-black; mean luminance ${sanity.meanLuminance})`);
    return { page: item.page, path: item.path, ...sanity };
  });
}

export function sha256File(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function portablePath(root: string, path: string) {
  const value = relative(root, path).split("\\").join("/");
  assertion(value && !value.startsWith("../") && !value.includes(":") && extname(path), `Artifact path is outside root: ${path}`);
  return value;
}

export function ensureParent(path: string) {
  mkdirSync(dirname(path), { recursive: true });
}
