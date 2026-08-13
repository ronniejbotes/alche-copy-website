/**
 * Reference capture rig for the ALCHE rebuild study.
 *
 * Drives a real Chromium at a live URL and records everything we need to
 * rebuild the interaction exactly:
 *
 *   - video of a continuous scroll pass (webm, page-sized)
 *   - a "scroll ladder": one screenshot per fixed wheel step, so any frame in
 *     our rebuild can be diffed against the same scroll offset on the original
 *   - every network asset (js bundles, shaders, textures, fonts, models),
 *     mirrored to disk — the JS is where the real easing/shader values live
 *   - a manifest with scroll offsets, timings and asset metadata
 *
 * Usage:
 *   node tools/capture/capture-live.mjs --url https://alche.studio/ --name top
 *   node tools/capture/capture-live.mjs --url http://localhost:5173/ --name top-rebuild
 *
 * The second form points the same rig at our own build, so the ladders line up.
 */

import { chromium } from 'playwright'
import { mkdir, writeFile, rename, readdir } from 'node:fs/promises'
import path from 'node:path'

const args = parseArgs(process.argv.slice(2))

const URL_ = args.url ?? 'https://alche.studio/'
const NAME = args.name ?? 'top'
const OUT = path.resolve(args.out ?? 'reference', NAME)
const WIDTH = int(args.width, 1920)
const HEIGHT = int(args.height, 1080)
const STEPS = int(args.steps, 120)
const SETTLE = int(args.settle, 350) // ms to let scrubbed animation land before a shot
const WARMUP = int(args.warmup, 8000) // ms for loader + WebGL boot
const SKIP_ASSETS = args.assets === 'false'
const MAX_ASSET_BYTES = 80 * 1024 * 1024

const SKIP_HOSTS = [/googletagmanager\.com/, /google-analytics\.com/, /doubleclick\.net/]

await mkdir(path.join(OUT, 'frames'), { recursive: true })
await mkdir(path.join(OUT, 'assets'), { recursive: true })

console.log(`[capture] ${URL_}`)
console.log(`[capture] out: ${OUT}`)
console.log(`[capture] ${WIDTH}x${HEIGHT}, ${STEPS} ladder steps`)

const browser = await chromium.launch({
  headless: false,
  args: [
    '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required',
    '--force-color-profile=srgb',
    '--disable-features=CalculateNativeWinOcclusion',
    '--use-angle=d3d11',
  ],
})

const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  recordVideo: { dir: path.join(OUT, 'video'), size: { width: WIDTH, height: HEIGHT } },
  colorScheme: 'dark',
  reducedMotion: 'no-preference',
})

const assets = []
const seen = new Set()

context.on('response', async (res) => {
  const url = res.url()
  if (seen.has(url)) return
  seen.add(url)
  if (SKIP_HOSTS.some((re) => re.test(url))) return

  const entry = {
    url,
    status: res.status(),
    type: res.headers()['content-type'] ?? '',
    resourceType: res.request().resourceType(),
  }

  if (!SKIP_ASSETS && res.status() < 400) {
    try {
      const body = await res.body()
      entry.bytes = body.length
      if (body.length <= MAX_ASSET_BYTES) {
        const dest = assetPath(url)
        await mkdir(path.dirname(dest), { recursive: true })
        await writeFile(dest, body)
        entry.saved = path.relative(OUT, dest).replaceAll('\\', '/')
      } else {
        entry.saved = null
        entry.note = 'too large, not saved'
      }
    } catch (err) {
      entry.error = String(err.message ?? err)
    }
  }

  assets.push(entry)
})

const page = await context.newPage()

const consoleLog = []
page.on('console', (msg) => consoleLog.push({ type: msg.type(), text: msg.text() }))
page.on('pageerror', (err) => consoleLog.push({ type: 'pageerror', text: String(err) }))

const t0 = Date.now()
await page.goto(URL_, { waitUntil: 'load', timeout: 90_000 })
await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {
  console.log('[capture] networkidle timed out — continuing (site may poll)')
})

console.log(`[capture] loaded in ${Date.now() - t0}ms, warming up ${WARMUP}ms for loader + WebGL`)
await page.waitForTimeout(WARMUP)

// Some intro sequences only dismiss on a user gesture. A click on dead space
// (top-left corner is the logo area on most of these, so aim mid-left gutter)
// is harmless if there is nothing listening.
await page.mouse.move(WIDTH / 2, HEIGHT / 2)
await page.waitForTimeout(500)

const metrics = await page.evaluate(() => ({
  scrollHeight: document.documentElement.scrollHeight,
  innerHeight: window.innerHeight,
  hasLenis: Boolean(window.lenis || window.__lenis || document.querySelector('[class*=lenis]')),
  bodyClass: document.body.className,
  title: document.title,
  ua: navigator.userAgent,
  webgl: (() => {
    try {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl2') || c.getContext('webgl')
      if (!gl) return null
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      return {
        version: gl.getParameter(gl.VERSION),
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      }
    } catch {
      return null
    }
  })(),
  canvases: [...document.querySelectorAll('canvas')].map((c) => ({
    width: c.width,
    height: c.height,
    css: `${c.clientWidth}x${c.clientHeight}`,
    className: c.className,
  })),
}))

console.log('[capture] page metrics:', JSON.stringify(metrics, null, 2))

await page.screenshot({ path: path.join(OUT, 'frames', 'hero.png') })
await writeFile(path.join(OUT, 'dom.html'), await page.content(), 'utf8')

// ---------------------------------------------------------------------------
// Pass 1 — scroll ladder. Real wheel events so smooth-scroll libraries (Lenis
// and friends) are driven the way a user drives them, then a settle pause so
// scrubbed timelines land before the shot.
// ---------------------------------------------------------------------------

const scrollable = Math.max(0, metrics.scrollHeight - metrics.innerHeight)
const stepPx = Math.max(1, Math.round(scrollable / STEPS))
console.log(`[capture] scrollable ${scrollable}px, ${stepPx}px per step`)

const ladder = []

for (let i = 0; i <= STEPS; i++) {
  if (i > 0) {
    await page.mouse.wheel(0, stepPx)
    await page.waitForTimeout(SETTLE)
  }

  const y = await page.evaluate(() => window.scrollY || window.pageYOffset || 0)
  const file = `scroll-${String(i).padStart(4, '0')}.png`
  await page.screenshot({ path: path.join(OUT, 'frames', file) })

  ladder.push({ step: i, requestedY: i * stepPx, actualY: y, file: `frames/${file}` })
  if (i % 10 === 0) console.log(`[capture]   step ${i}/${STEPS} — y=${y}`)
}

// ---------------------------------------------------------------------------
// Pass 2 — continuous scroll for the video track. No pauses, so the easing and
// scrub feel is preserved at whatever fps the recorder manages.
// ---------------------------------------------------------------------------

console.log('[capture] continuous pass (video)')
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
await page.waitForTimeout(1500)

const fineStep = Math.max(1, Math.round(scrollable / (STEPS * 4)))
for (let i = 0; i < STEPS * 4; i++) {
  await page.mouse.wheel(0, fineStep)
  await page.waitForTimeout(16)
}
await page.waitForTimeout(2000)

// Drag the logo — the inertia/spring return is the hardest thing to eyeball
// from stills, so give the video something to measure.
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
await page.waitForTimeout(1500)
const cx = Math.round(WIDTH / 2)
const cy = Math.round(HEIGHT / 2)
for (const [dx, dy] of [
  [260, 0],
  [-260, 140],
  [0, -200],
]) {
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let s = 1; s <= 20; s++) {
    await page.mouse.move(cx + (dx * s) / 20, cy + (dy * s) / 20)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
  await page.waitForTimeout(2500) // let the spring settle on camera
}

const manifest = {
  url: URL_,
  name: NAME,
  capturedAt: new Date().toISOString(),
  viewport: { width: WIDTH, height: HEIGHT },
  steps: STEPS,
  stepPx,
  settleMs: SETTLE,
  metrics,
  ladder,
  console: consoleLog,
  assets: assets.sort((a, b) => a.url.localeCompare(b.url)),
}

await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

await context.close() // flushes the video file
await browser.close()

// Playwright names videos with a random id; give it a stable name.
try {
  const vids = await readdir(path.join(OUT, 'video'))
  const webm = vids.find((f) => f.endsWith('.webm'))
  if (webm) {
    await rename(path.join(OUT, 'video', webm), path.join(OUT, 'video', `${NAME}.webm`))
  }
} catch {
  /* no video dir */
}

console.log(`[capture] done — ${ladder.length} frames, ${assets.length} assets`)
console.log(`[capture] ${OUT}`)

// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i++
    } else {
      out[key] = 'true'
    }
  }
  return out
}

function int(v, fallback) {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) ? n : fallback
}

function assetPath(url) {
  const u = new URL(url)
  let rel = decodeURIComponent(u.pathname)
  if (rel.endsWith('/')) rel += 'index.html'
  rel = rel.replace(/^\/+/, '')
  // Keep query-string variants distinct without breaking the filesystem.
  if (u.search) {
    const hash = [...u.search].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
    const ext = path.extname(rel)
    rel = `${rel.slice(0, rel.length - ext.length)}~${hash.toString(36)}${ext}`
  }
  const safe = rel
    .split('/')
    .map((seg) => seg.replace(/[<>:"\\|?*]/g, '_'))
    .join('/')
  return path.join(OUT, 'assets', u.hostname, safe)
}
