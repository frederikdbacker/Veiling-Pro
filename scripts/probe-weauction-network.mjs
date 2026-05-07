// Sniff Angular API-calls om auction UUIDs te vinden.
import puppeteer from 'puppeteer'

const URL = process.argv[2]
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000 })

const apiCalls = []
page.on('response', async (resp) => {
  const url = resp.url()
  if (/api|graphql|auction/i.test(url) && resp.status() === 200) {
    try {
      const ct = resp.headers()['content-type'] || ''
      if (ct.includes('json')) {
        const body = await resp.text()
        apiCalls.push({ url, body: body.slice(0, 1500) })
      }
    } catch {}
  }
})

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise((r) => setTimeout(r, 3000))
await browser.close()

console.log(`API calls captured: ${apiCalls.length}`)
for (const c of apiCalls.slice(0, 15)) {
  console.log(`\n--- ${c.url}`)
  console.log(c.body)
}
