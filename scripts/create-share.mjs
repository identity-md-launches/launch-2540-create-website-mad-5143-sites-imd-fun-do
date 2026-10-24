import { readFile, readdir } from "node:fs/promises";
const { chromium } = await import(process.argv[2] || "playwright");
const font = (await readdir("dist/assets")).find(
  (x) => x.startsWith("barlow-condensed-latin-600") && x.endsWith(".woff2"),
);
if (!font)
  throw new Error("Run npm run build before generating the share card");
const face = (await readFile(`dist/assets/${font}`)).toString("base64");
const mark = (await readFile("public/assets/mad.svg")).toString("base64");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html><html><head><style>@font-face{font-family:Display;src:url(data:font/woff2;base64,${face})}*{box-sizing:border-box}body{margin:0;background:#151914;color:#f0f0e6;padding:56px 64px;font-family:Arial,sans-serif}.top{display:flex;align-items:center;gap:16px;font-size:32px;font-weight:600}.top img{width:52px;height:52px}.hero{display:flex;align-items:center;justify-content:space-between;margin-top:42px}h1{font-family:Display,sans-serif;font-size:100px;line-height:1;margin:0;font-weight:600;letter-spacing:-2px}h1 span{color:#e9f56b}.hero img{width:240px;height:240px}p{color:#aab1a3;font-size:26px;line-height:1.5;margin:22px 0}.address{font-family:monospace;font-size:20px;border-top:1px solid #424b3c;padding-top:24px;margin-top:44px;color:#f0f0e6}</style></head><body><div class="top"><img src="data:image/svg+xml;base64,${mark}">MAD.</div><div class="hero"><h1>Mutually assured<br>destruction<span>.</span></h1><img src="data:image/svg+xml;base64,${mark}"></div><p>Buy and sell MAD on Ethereum.</p><div class="address">0x287676ea314f09b7269d0e3db3ea54bd440f66a2</div></body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "public/assets/share.png" });
  console.log("Share image generated: public/assets/share.png (1200 × 630)");
} finally {
  await browser.close();
}
