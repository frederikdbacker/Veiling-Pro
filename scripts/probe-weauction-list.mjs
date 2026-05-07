// Probe een weauction.nl-instance voor alle auction-URLs op de hoofdpagina.
import puppeteer from 'puppeteer'

const URL = process.argv[2]
if (!URL) { console.error('Usage: node scripts/probe-weauction-list.mjs <url>'); process.exit(1) }

const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise((r) => setTimeout(r, 2500))
// Scroll
await page.evaluate(async () => {
  await new Promise((resolve) => {
    let h = 0
    const t = setInterval(() => {
      window.scrollBy(0, 600); h += 600
      if (h >= document.body.scrollHeight) { clearInterval(t); resolve() }
    }, 200)
  })
})
await new Promise((r) => setTimeout(r, 2000))

// Probeer cookies te accepteren
try {
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, a')]
    const accept = btns.find((b) => /accept|accepteren|cookies accepter|ta emot/i.test(b.textContent))
    if (accept) { accept.click(); return accept.textContent.trim() }
    return null
  })
  console.error(`[cookies] clicked: ${clicked}`)
  await new Promise((r) => setTimeout(r, 2500))
  // Scroll opnieuw na cookies
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let h = 0
      const t = setInterval(() => {
        window.scrollBy(0, 500); h += 500
        if (h >= document.body.scrollHeight) { clearInterval(t); resolve() }
      }, 200)
    })
  })
  await new Promise((r) => setTimeout(r, 2500))
} catch (e) {
  console.error('[cookies] err', e.message)
}

const data = await page.evaluate(() => {
  const all = [...document.querySelectorAll('a')]
    .map((a) => ({ href: a.href, text: a.textContent.trim().slice(0, 100) }))
    .filter((l) => l.href && !l.href.endsWith('#'))
  const auctionUrls = all.filter((l) => /\/auctions?\/[a-f0-9-]{20,}/i.test(l.href))
  // Alle h1-h4 voor context
  const titles = [...document.querySelectorAll('h1, h2, h3, h4')]
    .map((h) => h.textContent.trim()).filter((t) => t && t.length < 200).slice(0, 20)
  // Sample alle hrefs (eerste 20) om patroon te zien
  const sampleHrefs = [...new Set(all.map((l) => l.href))].slice(0, 30)
  // Tel grote items + sample structuur
  const cardSelectors = ['app-auction-card', 'app-auction', '.auction-card', '[class*="auction"]', '[class*="Auction"]']
  const counts = {}
  for (const s of cardSelectors) counts[s] = document.querySelectorAll(s).length
  // Body text length om te zien of content geladen is
  const bodyText = document.body.textContent.replace(/\s+/g,' ').trim()
  // Check ook alle elementen met "auction" in className
  // Vind alle 'View'-knoppen of cards binnen .auction-list
  const list = document.querySelector('.auction-list')
  const cards = list ? [...list.querySelectorAll('a, button')].map((el) => ({
    tag: el.tagName,
    href: el.href || null,
    routerLink: el.getAttribute('routerlink') || el.getAttribute('routerLink') || el.getAttribute('ng-reflect-router-link'),
    text: el.textContent.replace(/\s+/g,' ').trim().slice(0, 80),
  })).filter((c) => c.text || c.href || c.routerLink) : []
  return { auctionUrls, titles, sampleHrefs, counts, bodyText: bodyText.slice(0, 800), cards }
})
await browser.close()
console.log(JSON.stringify(data, null, 2))
