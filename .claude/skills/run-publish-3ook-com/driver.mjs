#!/usr/bin/env node
// Zero-dependency Chrome DevTools Protocol driver for the Nuxt dev server.
// Uses Node's native WebSocket (Node >= 24; see package.json engines), so no Playwright/Puppeteer install.
//
//   node driver.mjs smoke [baseUrl]
//   node driver.mjs shot <route> [outFile] [baseUrl]
//   node driver.mjs eval <route> '<js expression>' [baseUrl]
//   node driver.mjs repl [baseUrl]        # stdin: goto/shot/eval/click/type/text/quit
//
// Screenshots land in .claude/skills/run-publish-3ook-com/shots/.

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, isAbsolute } from 'node:path'
import { createInterface } from 'node:readline'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = resolve(HERE, 'shots')
const PORT = Number(process.env.CDP_PORT || 9222)
const PROFILE = `/tmp/publish3ook-cdp-${PORT}`

const CHROME = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
].filter(Boolean).find((p) => {
  try { return statSync(p).isFile() }
  catch { return false }
})

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function launchChrome() {
  if (!CHROME) throw new Error('No Chrome binary found. Set CHROME_BIN.')
  rmSync(PROFILE, { recursive: true, force: true })
  const proc = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1440,900',
    'about:blank',
  ], { stdio: 'ignore', detached: false })

  // /json/version only answers once the DevTools endpoint is listening.
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (r.ok) return { proc, ...(await r.json()) }
    }
    catch { /* not up yet */ }
    await sleep(250)
  }
  throw new Error('Chrome DevTools endpoint never came up')
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.listeners = []
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : res(msg.result)
      }
      else if (msg.method) {
        for (const fn of this.listeners) fn(msg)
      }
    })
  }

  static async connect(url) {
    const ws = new WebSocket(url)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true })
      ws.addEventListener('error', rej, { once: true })
    })
    return new CDP(ws)
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params, sessionId }))
    return new Promise((res, rej) => this.pending.set(id, { resolve: res, reject: rej }))
  }

  on(fn) { this.listeners.push(fn) }
}

// One page target, with console/exception capture wired up.
async function openPage(browser) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })

  const errors = []
  browser.on((msg) => {
    if (msg.sessionId !== sessionId) return
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      errors.push(`[exception] ${d.exception?.description || d.text}`)
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(`[console.error] ${msg.params.args.map(a => a.value ?? a.description ?? a.type).join(' ')}`)
    }
  })

  const call = (m, p) => browser.send(m, p, sessionId)
  await call('Page.enable')
  await call('Runtime.enable')
  await call('Page.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  })

  // Runs before any page script — the only window early enough to beat the
  // onMounted gate in useOneTimePopup. Without this the WelcomeModal opens a
  // second after hydration and eats the first click of every flow.
  await call('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { localStorage.setItem('welcomePopup:v3', 'true') } catch {}`,
  })

  return { call, errors, sessionId }
}

const evalJs = async (page, expression) => {
  const { result, exceptionDetails } = await page.call('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  })
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text)
  return result.value
}

// Nuxt is a SPA here: Page.loadEventFired fires long before Vue has mounted,
// so poll for real content inside #__nuxt instead of trusting the load event.
async function goto(page, url, { timeout = 30000 } = {}) {
  page.errors.length = 0
  await page.call('Page.navigate', { url })
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const ready = await evalJs(page, `(() => {
        const root = document.getElementById('__nuxt')
        return !!root && root.innerText.trim().length > 0
      })()`)
      if (ready) {
        // The sidebar animates open after mount; settle before measuring
        // anything, or click coordinates land where the element used to be.
        await sleep(800)
        // The DevTools anchor mounts late, so hide it here rather than on init.
        await evalJs(page, `(() => {
          const s = document.createElement('style')
          s.textContent = '#nuxt-devtools-container,#vue-tracer-overlay{display:none!important}'
          document.head.append(s)
        })()`)
        return
      }
    }
    catch { /* mid-navigation, context swapped */ }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for Nuxt to hydrate at ${url}`)
}

// @nuxt/ui components (reka-ui) often open on pointerdown, which a synthetic
// el.click() never fires. Dispatch real mouse input at the element centre.
async function click(page, selectorOrText) {
  const box = await evalJs(page, `(() => {
    const q = ${JSON.stringify(selectorOrText)}
    let el = null
    try { el = document.querySelector(q) } catch {}
    if (!el) {
      el = [...document.querySelectorAll('button, a, [role=button], input, label')]
        .find((n) => n.innerText && n.innerText.trim().includes(q))
    }
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })()`)
  if (!box) return `not found: ${selectorOrText}`
  for (const type of ['mousePressed', 'mouseReleased']) {
    await page.call('Input.dispatchMouseEvent', {
      type, x: box.x, y: box.y, button: 'left', clickCount: 1,
    })
  }
  await sleep(700)
  return `clicked ${selectorOrText}`
}

async function shot(page, outFile) {
  const { data } = await page.call('Page.captureScreenshot', { format: 'png' })
  mkdirSync(SHOTS, { recursive: true })
  const target = isAbsolute(outFile) ? outFile : resolve(SHOTS, outFile)
  writeFileSync(target, Buffer.from(data, 'base64'))
  return target
}

const slug = route => (route.replace(/^\//, '').replace(/[^\w-]+/g, '_') || 'index') + '.png'

// Routes that render without a logged-in wallet. Everything under
// /my-books, /sales-report, etc. bounces to the login panel instead.
const SMOKE_ROUTES = ['/', '/about', '/latest-books']

async function main() {
  const [cmd = 'smoke', ...rest] = process.argv.slice(2)
  const baseFrom = a => (a && a.startsWith('http') ? a : 'http://localhost:3000')

  const { proc, webSocketDebuggerUrl } = await launchChrome()
  const browser = await CDP.connect(webSocketDebuggerUrl)
  const page = await openPage(browser)
  let failed = false

  const finish = () => {
    try { proc.kill() }
    catch { /* already gone */ }
    process.exit(failed ? 1 : 0)
  }

  try {
    if (cmd === 'smoke') {
      const base = baseFrom(rest[0])
      for (const route of SMOKE_ROUTES) {
        try {
          await goto(page, base + route)
          const title = await evalJs(page, 'document.title')
          const file = await shot(page, slug(route))
          const errs = page.errors.filter(e => !/Intercom|posthog|magic|walletconnect/i.test(e))
          console.log(`PASS ${route}  title=${JSON.stringify(title)}  shot=${file}`)
          for (const e of errs) console.log(`     ! ${e.slice(0, 200)}`)
        }
        catch (e) {
          failed = true
          console.log(`FAIL ${route}  ${e.message}`)
        }
      }

      // Interaction check: the login panel is the only flow reachable without
      // a wallet, so it is what proves the app is actually driveable.
      try {
        await goto(page, base + '/about')
        await click(page, '登入 / 註冊')
        const dialogs = await evalJs(page, 'document.querySelectorAll("[role=dialog]").length')
        const file = await shot(page, 'login-panel.png')
        if (!dialogs) throw new Error('login panel did not open')
        console.log(`PASS interaction: login panel opened  shot=${file}`)
      }
      catch (e) {
        failed = true
        console.log(`FAIL interaction: ${e.message}`)
      }
    }
    else if (cmd === 'shot') {
      const [route, out, base] = rest
      await goto(page, baseFrom(base) + route)
      console.log(await shot(page, out || slug(route)))
    }
    else if (cmd === 'eval') {
      const [route, expr, base] = rest
      await goto(page, baseFrom(base) + route)
      console.log(JSON.stringify(await evalJs(page, expr), null, 2))
    }
    else if (cmd === 'repl') {
      const base = baseFrom(rest[0])
      console.log(`ready (base=${base})`)
      const rl = createInterface({ input: process.stdin })
      for await (const line of rl) {
        const [verb, ...args] = line.trim().split(/\s+/)
        const arg = args.join(' ')
        try {
          if (!verb) continue
          else if (verb === 'goto') { await goto(page, arg.startsWith('http') ? arg : base + arg); console.log('ok ' + arg) }
          else if (verb === 'shot') console.log(await shot(page, args[0] || 'repl.png'))
          else if (verb === 'eval') console.log(JSON.stringify(await evalJs(page, arg)))
          else if (verb === 'text') console.log(await evalJs(page, 'document.body.innerText.slice(0,4000)'))
          else if (verb === 'click') console.log(await click(page, arg))
          else if (verb === 'type') {
            const [sel, ...val] = args
            console.log(await evalJs(page, `(() => {
              const el = document.querySelector(${JSON.stringify(sel)})
              if (!el) return 'not found'
              const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set
              setter.call(el, ${JSON.stringify(val.join(' '))})
              el.dispatchEvent(new Event('input', { bubbles: true }))
              return 'typed'
            })()`))
          }
          else if (verb === 'errors') console.log(page.errors.join('\n') || '(none)')
          else if (verb === 'quit') break
          else console.log('? verbs: goto shot eval text click type errors quit')
        }
        catch (e) { console.log('ERR ' + e.message) }
      }
    }
    else {
      console.log('usage: driver.mjs smoke|shot|eval|repl')
      failed = true
    }
  }
  catch (e) {
    console.error(e)
    failed = true
  }
  finish()
}

main()
