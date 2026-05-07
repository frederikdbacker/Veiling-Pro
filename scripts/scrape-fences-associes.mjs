// Scrape Fences associes (committee) via Puppeteer.
// Divi page builder lazy-loadt content; Puppeteer rendert de pagina volledig.

import puppeteer from 'puppeteer'
import { writeFile } from 'node:fs/promises'

const URL = 'https://www.fences.fr/associes/'
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise((r) => setTimeout(r, 2500))

// Scroll om lazy-loaded content te triggeren
await page.evaluate(async () => {
  await new Promise((resolve) => {
    let h = 0
    const t = setInterval(() => {
      window.scrollBy(0, 500); h += 500
      if (h >= document.body.scrollHeight) { clearInterval(t); resolve() }
    }, 250)
  })
})
await new Promise((r) => setTimeout(r, 3000))

// Dump structuur: zoek alle h2/h3/h4 + bijbehorende img + omliggende text
const data = await page.evaluate(() => {
  // Strategie: voor elk image dat NIET een logo/icon is, zoek de naam
  // (h2-h4 nabij) en role (text-p of nabije tag).
  const imgs = [...document.querySelectorAll('img')]
    .map((img) => {
      const src = img.currentSrc || img.src
      if (!src || /logo|icon|sprite|placeholder/i.test(src)) return null
      const rect = img.getBoundingClientRect()
      if (rect.width < 80 || rect.height < 80) return null
      // Klim op om module-container te vinden (Divi's .et_pb_team_member of .et_pb_module)
      let container = img.closest('.et_pb_team_member, .et_pb_module, .et_pb_column, [class*="et_pb_"]') || img.parentElement
      const text = container?.textContent?.replace(/\s+/g, ' ').trim() || ''
      // Naam = eerste h2/h3/h4 tekst, of strong, of eerste regel
      const heading = container?.querySelector('h1, h2, h3, h4, .et_pb_team_member_name')?.textContent?.trim()
      const role = container?.querySelector('.et_pb_team_member_position, .et_pb_team_member_description, p')?.textContent?.trim()
      return {
        src, alt: img.alt, heading, role,
        nearText: text.slice(0, 300),
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      }
    })
    .filter(Boolean)

  return { imgs, title: document.querySelector('h1')?.textContent.trim() }
})

await browser.close()

console.log(`📋 ${data.imgs.length} candidate images`)
for (const i of data.imgs) {
  console.log(`\n  📷 ${i.src.slice(-80)}  (${i.rect.w}x${i.rect.h})`)
  console.log(`     alt: ${i.alt}`)
  console.log(`     heading: ${i.heading || '—'}`)
  console.log(`     role: ${i.role?.slice(0, 80) || '—'}`)
  console.log(`     near: ${i.nearText.slice(0, 120)}`)
}

await writeFile('/tmp/fences-associes-probe.json', JSON.stringify(data, null, 2))
console.log('\n💾 /tmp/fences-associes-probe.json')
