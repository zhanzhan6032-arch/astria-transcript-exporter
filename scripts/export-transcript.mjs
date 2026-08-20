import fs from "node:fs";
import path from "node:path";

function fail(message, code = 1) {
  console.error(`ERROR: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { url: null, outputDir: process.cwd(), cookieFile: null, inputJson: null };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith("--") && !args.url) args.url = value;
    else if (value === "--output-dir") args.outputDir = argv[++i];
    else if (value === "--cookie-file") args.cookieFile = argv[++i];
    else if (value === "--input-json") args.inputJson = argv[++i];
    else fail(`Unknown or incomplete argument: ${value}`, 2);
  }
  if (!args.url) fail("Provide an Astria video URL.", 2);
  return args;
}

function parseAstriaUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    fail("The supplied value is not a valid URL.", 2);
  }
  if (url.protocol !== "https:" || url.hostname !== "astria.lonelyreader.com") {
    fail("Only https://astria.lonelyreader.com URLs are supported.", 2);
  }
  const match = url.pathname.match(/^\/learningv2\/([^/]+)\/vod\/?$/i);
  const productKeyId = match?.[1];
  const unitId = url.searchParams.get("unitId");
  const activityKeyId = url.searchParams.get("activityKeyId");
  if (!productKeyId || !unitId || !activityKeyId) {
    fail("URL must contain the course product key, unitId, and activityKeyId.", 2);
  }
  return { url, productKeyId, unitId, activityKeyId };
}

function readCookie(args) {
  const cookieFile = args.cookieFile || process.env.ASTRIA_COOKIE_FILE || "cookie.txt";
  if (!fs.existsSync(cookieFile)) {
    fail(`Cookie file not found: ${path.resolve(cookieFile)}`, 3);
  }
  const cookie = fs.readFileSync(cookieFile, "utf8").trim();
  if (!cookie) fail(`Cookie file is empty: ${path.resolve(cookieFile)}`, 3);
  return cookie;
}

async function fetchTranscript(ids, cookie) {
  const endpoint = new URL("https://astria.lonelyreader.com/api/learning/media-text");
  endpoint.searchParams.set("productKeyId", ids.productKeyId);
  endpoint.searchParams.set("unitId", ids.unitId);
  endpoint.searchParams.set("activityKeyId", ids.activityKeyId);
  let response;
  try {
    response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        Cookie: cookie,
        "User-Agent": "Mozilla/5.0 AstriaTranscriptExporter/1.0",
      },
    });
  } catch (error) {
    fail(`Could not connect to Astria: ${error?.cause?.code || error.message}`, 5);
  }
  if (response.status === 401 || response.status === 403) {
    fail(`Astria authentication failed (HTTP ${response.status}); refresh the Cookie file.`, 4);
  }
  if (!response.ok) fail(`Astria transcript API returned HTTP ${response.status}.`, 5);
  return response.json();
}

function timestamp(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function safeFilename(value) {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "").trim();
  return cleaned || "Astria视频文稿";
}

function renderMarkdown(data, sourceUrl) {
  const access = data?.access;
  const run = data?.runs?.find((item) => item.status === "ready" && item.playback?.scriptParagraphs?.length);
  if (!access?.course || !access?.unit || !access?.activity || !run) {
    fail("The API response does not contain a ready promoted script.", 6);
  }
  const paragraphs = run.playback.scriptParagraphs;
  const chapters = run.playback.chapters || [];
  const chapterByStart = new Map(chapters.map((chapter) => [chapter.paragraphStart, chapter]));
  const title = `${access.course.title}｜${access.unit.title}`;
  const lines = [
    `# ${title}`,
    "",
    `- 课程：${access.course.title}（${access.course.legacyProductKeyId}）`,
    `- 单元：${access.unit.title}`,
    `- 视频：${access.activity.title}`,
    `- 时长：${timestamp(run.durationMs)}`,
    `- 来源：[Astria 课程页面](${sourceUrl})`,
    "",
    "## 视频文稿",
    "",
  ];
  paragraphs.forEach((paragraph, index) => {
    const chapter = chapterByStart.get(index);
    if (chapter) lines.push(`### ${timestamp(chapter.startMs)} ${chapter.title}`, "");
    lines.push(`**${timestamp(paragraph.startMs)}**`, "", String(paragraph.text).trim(), "");
  });
  return { markdown: `${lines.join("\n").trimEnd()}\n`, filename: `${safeFilename(title)}.md`, paragraphs: paragraphs.length, chapters: chapters.length };
}

const args = parseArgs(process.argv.slice(2));
const ids = parseAstriaUrl(args.url);
let data;
if (args.inputJson) {
  data = JSON.parse(fs.readFileSync(args.inputJson, "utf8"));
} else {
  const cookie = readCookie(args);
  data = await fetchTranscript(ids, cookie);
}
const result = renderMarkdown(data, ids.url.href);
fs.mkdirSync(args.outputDir, { recursive: true });
const outputPath = path.resolve(args.outputDir, result.filename);
fs.writeFileSync(outputPath, result.markdown, "utf8");
console.log(JSON.stringify({ output: outputPath, paragraphs: result.paragraphs, chapters: result.chapters }));

