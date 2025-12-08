import { chromium } from "playwright";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = join(__dirname, "../src/content/blog");
const PUBLIC_BLOG_DIR = join(__dirname, "../public/blog");

const THEME_CONFIG = {
  theme: "dark",
  themeVariables: {
    primaryColor: "#6366f1",
    primaryTextColor: "#f1f5f9",
    primaryBorderColor: "#818cf8",
    lineColor: "#94a3b8",
    secondaryColor: "#334155",
    tertiaryColor: "#1e293b",
    background: "#0f172a",
    mainBkg: "#1e293b",
    secondBkg: "#334155",
    actorBkg: "#334155",
    actorBorder: "#6366f1",
    actorTextColor: "#f1f5f9",
    actorLineColor: "#64748b",
    signalColor: "#f1f5f9",
    signalTextColor: "#f1f5f9",
    labelBoxBkgColor: "#1e293b",
    labelBoxBorderColor: "#475569",
    labelTextColor: "#f1f5f9",
    loopTextColor: "#f1f5f9",
    noteBkgColor: "#334155",
    noteTextColor: "#f1f5f9",
    noteBorderColor: "#6366f1",
    sequenceNumberColor: "#f1f5f9",
  },
};

function extractMermaidBlocks(markdown) {
  const regex = /```mermaid\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

async function renderMermaidToImage(mermaidCode, outputPath) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
      <style>
        body { margin: 0; padding: 40px; background: #0f172a; }
        #container { display: inline-block; }
        .mermaid svg { min-width: 1200px; }
      </style>
    </head>
    <body>
      <div id="container">
        <pre class="mermaid">${mermaidCode}</pre>
      </div>
      <script>
        mermaid.initialize(${JSON.stringify(THEME_CONFIG)});
      </script>
    </body>
    </html>
  `;

  await page.setContent(html);
  await page.waitForSelector(".mermaid svg");
  await page.waitForTimeout(500);

  const container = await page.$("#container");
  await container.screenshot({ path: outputPath, type: "png" });

  await browser.close();
  console.log(`Generated: ${outputPath}`);
}

async function processMarkdownFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const blocks = extractMermaidBlocks(content);

  if (blocks.length === 0) {
    return;
  }

  const baseName = filePath.split("/").pop().replace(".md", "");
  console.log(`Processing ${baseName}: found ${blocks.length} mermaid block(s)`);

  for (let i = 0; i < blocks.length; i++) {
    const suffix = blocks.length > 1 ? `-${i + 1}` : "";
    const outputName = `${baseName}-mermaid${suffix}.png`;
    const outputPath = join(PUBLIC_BLOG_DIR, outputName);
    await renderMermaidToImage(blocks[i], outputPath);
  }
}

async function main() {
  const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    await processMarkdownFile(join(BLOG_DIR, file));
  }
}

main().catch(console.error);
