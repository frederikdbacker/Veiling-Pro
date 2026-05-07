import puppeteer from 'puppeteer'

const URL = process.argv[2]
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise((r) => setTimeout(r, 2000))
await page.evaluate(async () => {
  await new Promise((resolve) => {
    let h = 0
    const t = setInterval(() => {
      window.scrollBy(0, 600); h += 600
      if (h >= document.body.scrollHeight) { clearInterval(t); resolve() }
    }, 200)
  })
})
await new Promise((r) => setTimeout(r, 3000))

const data = await page.evaluate(() => {
  // Find all h4 elements and their surrounding container
  const h4s = [...document.querySelectorAll('h4')]
    .filter((h) => h.textContent.trim() && h.textContent.trim() !== 'Accept cookies')

  return h4s.slice(0, 3).map((h) => {
    // Climb up to find the smallest enclosing container with images and text
    let el = h
    for (let i = 0; i < 8; i++) {
      if (el.parentElement && el.parentElement.querySelectorAll('img').length > 0) {
        el = el.parentElement
        break
      }
      el = el.parentElement
      if (!el) break
    }
    return {
      h4: h.textContent.trim(),
      containerTag: el?.tagName,
      containerClass: el?.className?.slice(0, 100),
      text: el?.textContent.trim().slice(0, 600),
      imgs: [...(el?.querySelectorAll('img') || [])].map((i) => i.src).slice(0, 3),
      innerHTML: el?.innerHTML.slice(0, 1500),
    }
  })
})
console.log(JSON.stringify(data, null, 2))
await browser.close()
