import puppeteer from 'puppeteer'

const URL = process.argv[2] || 'https://bid.aloga-auction.com/auctions/98423791-25df-4b65-ad6d-08dd83054a6a'
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
  // Onderzoek: hoeveel item-panel selectors overlap?
  const itemPanels = document.querySelectorAll('.item-panel').length
  const appItemOverview = document.querySelectorAll('app-item-overview').length
  const appAuctionItem = document.querySelectorAll('app-auction-item').length
  const overviewName = document.querySelectorAll('.item-overview-name').length
  const overviewSubtitle = document.querySelectorAll('.item-overview-subtitle').length

  // Sample 3 panels and dump structure
  const samples = [...document.querySelectorAll('.item-panel')].slice(0, 4).map((p) => ({
    name: p.querySelector('.item-overview-name, h4')?.textContent.trim(),
    subtitle: p.querySelector('.item-overview-subtitle')?.textContent.trim(),
    subtitleH5: p.querySelector('h5')?.textContent.trim(),
    description: p.querySelector('.item-overview-description, p')?.textContent.trim()?.slice(0, 100),
    h5Count: p.querySelectorAll('h5').length,
    pCount: p.querySelectorAll('p').length,
    rawSubtitleHTML: p.querySelector('.item-overview-subtitle')?.innerHTML?.slice(0, 200),
  }))

  return { counts: { itemPanels, appItemOverview, appAuctionItem, overviewName, overviewSubtitle }, samples }
})
await browser.close()
console.log(JSON.stringify(data, null, 2))
