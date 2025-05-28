import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent'; // Updated import

const productCache = {};

const proxies = [
  "http://pokemondealer:ZFT2ZBZ7PXw72jgwFJBByu6U~@168.151.202.243:20000",
  "http://pokemondealer:ZFT2ZBZ7PXw72jgwFJBByu6U~@188.42.21.191:20000",
  "http://pokemondealer:ZFT2ZBZ7PXw72jgwFJBByu6U~@188.42.21.90:20000"
];

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomProxy(proxiesArray) {
  return proxiesArray[Math.floor(Math.random() * proxiesArray.length)];
}

function parseProxy(proxyUrl) {
  const match = proxyUrl.match(/http:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);
  if (!match) throw new Error(`Invalid proxy format: ${proxyUrl}`);
  const [, username, password, host, port] = match;
  return { username, password, host, port };
}

function getRetailerName(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '').split('.')[0];
    const retailerMap = { 'target': 'Target', 'bestbuy': 'Best Buy' };
    return retailerMap[domain.toLowerCase()] || domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch (error) {
    console.error('Error parsing retailer from URL:', error.message);
    return 'Unknown Retailer';
  }
}

async function testProxy(proxy) {
  const { host, port, username, password } = parseProxy(proxy);
  const agent = new HttpsProxyAgent(`http://${username}:${password}@${host}:${port}`);
  const response = await fetch('https://www.target.com', { agent }).catch(() => null);
  return response?.status === 200;
}

async function scrapeWithRetry(url, page, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
      return true;
    } catch (error) {
      console.log(`Attempt ${attempt}/${retries} failed for ${url}: ${error.message}`);
      if (attempt === retries) throw error;
      await wait(2000 * attempt); // Exponential backoff
    }
  }
}

export async function GET() {
  const productUrls = [
    "https://www.target.com/p/2025-pokemon-scarlet-violet-s8-5-poster-collection/-/A-93803457",
    "https://www.target.com/p/2024-pok-scarlet-violet-s8-5-elite-trainer-box/-/A-93954435",
    "https://www.target.com/p/pokemon-scarlet-violet-s3-5-booster-bundle-box/-/A-88897904",
    "https://www.target.com/p/pok-233-mon-trading-card-game-crown-zenith-booster-bundle-box/-/A-94091405",
    "https://www.target.com/p/pokemon-trading-card-game-scarlet-38-violet-151-elite-trainer-box/-/A-88897899",
    "https://www.target.com/p/pokemon-trading-card-game-scarlet-38-violet-151-ultra-premium-collection/-/A-88897906",
    "https://www.target.com/p/2025-pokemon-prismatic-evolutions-binder-collection/-/A-94300066",
    "https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-151-collection-zapdos-ex/-/A-88897898"
  ];

  let browser;
  let workingProxy = null;

  try {
    // Find a working proxy
    for (const proxy of proxies) {
      if (await testProxy(proxy)) {
        workingProxy = proxy;
        console.log(`Using proxy: ${parseProxy(proxy).host}:${parseProxy(proxy).port}`);
        break;
      }
    }
    if (!workingProxy) console.log('No working proxies found, proceeding without proxy');

    browser = await puppeteer.launch({
      headless: 'new',
      args: workingProxy ? [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,800',
        `--proxy-server=${parseProxy(workingProxy).host}:${parseProxy(workingProxy).port}`
      ] : [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,800',
      ],
      defaultViewport: { width: 1280, height: 800 },
    });

    const scrapeProduct = async (productUrl, index) => {
      if (productCache[productUrl]) {
        console.log('Serving from cache...', productUrl);
        return productCache[productUrl];
      }

      const page = await browser.newPage();
      if (workingProxy) await page.authenticate(parseProxy(workingProxy));

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.target.com/',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1',
      });
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.navigator.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      });

      const cookies = [
        { name: 'visitorId', value: 'YOUR_CURRENT_VISITOR_ID_HERE', domain: '.target.com' },
      ];
      await page.setCookie(...cookies);

      let networkData = {};
      await page.setRequestInterception(true);
      page.on('request', request => request.continue());
      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('redsky') || url.includes('product') || url.includes('fulfillment')) {
          try {
            const json = await response.json();
            networkData[url] = json;
            console.log(`Captured response from ${url}:`, JSON.stringify(json).substring(0, 300));
          } catch (e) {}
        }
      });

      try {
        await scrapeWithRetry(productUrl, page);
        await wait(5000);

        await page.screenshot({ path: `screenshot-${index}.png`, fullPage: true });
        console.log(`Screenshot saved for ${productUrl} at ${process.cwd()}/screenshot-${index}.png`);

        const productData = await page.evaluate(() => {
          const title = document.querySelector('h1[data-test="product-title"]')?.innerText.trim() ||
                        document.querySelector('h1')?.innerText.trim() || 'Title not found';

          const image = document.querySelector('img[alt="product image"]')?.getAttribute('src') ||
                        document.querySelector('img')?.getAttribute('src') || 'Image not found';

          const priceElements = [
            document.querySelector('[data-test="product-price"]'),
            document.querySelector('[data-test="current-price"]'),
          ].filter(el => el);
          console.log('Price elements found:', priceElements.map(el => ({
            selector: el.getAttribute('data-test') || el.className,
            text: el.innerText.trim(),
          })));

          const priceElement = priceElements.find(el => /\$\d/.test(el.innerText.trim()));
          let price = priceElement ? priceElement.innerText.trim() : 'Price not found';
          if (price !== 'Price not found' && /\$\d/.test(price)) {
            price = price.match(/\$\d+\.?\d*/)?.[0] || price;
          }

          let stockStatus = document.querySelector('[data-test="shipping-text"]')?.innerText.trim() || 'Stock status not found';
          const notifyMeButton = document.querySelector('[data-test="notifyMe"]');
          const notifyMessage = notifyMeButton?.innerText.trim() || 'No notify option available';

          if (notifyMeButton && notifyMessage.toLowerCase().includes('notify me')) {
            stockStatus = 'Out of stock (Notify me available)';
          } else if (stockStatus.toLowerCase().includes('out of stock') || title.toLowerCase().includes('not available')) {
            stockStatus = 'Out of stock';
          } else if (stockStatus.toLowerCase().includes('in stock') || (price !== 'Price not found' && stockStatus === 'Stock status not found')) {
            stockStatus = 'In stock';
          }

          const isAvailable = stockStatus.toLowerCase().includes('in stock');

          return { title, image, price, stockStatus, isAvailable, notifyMessage };
        });

        if (productData.price === 'Price not found' || productData.stockStatus === 'Stock status not found') {
          const tcin = productUrl.match(/A-(\d+)/)?.[1];
          if (tcin) {
            const apiUrl = `https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1?key=9f36aeafbe60771e321a7cc95a78140772ab3e96&tcin=${tcin}&pricing_store_id=1865&is_bot=false&zip=07047&state=NJ`;
            try {
              const response = await fetch(apiUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'application/json',
                  'Referer': 'https://www.target.com/',
                  'Cookie': `visitorId=${cookies[0].value}`,
                },
              });
              const data = await response.json();
              console.log(`Direct API response for ${tcin}:`, JSON.stringify(data).substring(0, 500));
              if (data?.data?.product?.price?.formatted_current_price) {
                productData.price = data.data.product.price.formatted_current_price;
                console.log(`Price from direct API: ${productData.price}`);
              }
              if (data?.data?.product?.fulfillment?.store_options?.[0]?.availability_status) {
                productData.stockStatus = data.data.product.fulfillment.store_options[0].availability_status === 'IN_STOCK' ? 'In stock' : 'Out of stock';
                console.log(`Stock from direct API: ${productData.stockStatus}`);
              }
            } catch (apiError) {
              console.error(`Direct API fetch failed for ${productUrl}:`, apiError.message);
            }
          }
        }

        const retailer = getRetailerName(productUrl);
        const productWithUrl = { ...productData, url: productUrl, retailer };
        productCache[productUrl] = productWithUrl;
        return productWithUrl;

      } catch (scrapeError) {
        console.error(`Final error scraping ${productUrl}:`, scrapeError.message);
        const html = await page.content();
        await fs.writeFile(`error-${index}.html`, html);
        return { 
          message: `Error scraping product: ${productUrl}`, 
          error: scrapeError.message,
          url: productUrl,
          retailer: getRetailerName(productUrl)
        };
      } finally {
        await page.close();
      }
    };

    // Process URLs sequentially
    const allProductData = [];
    for (let i = 0; i < productUrls.length; i++) {
      allProductData.push(await scrapeProduct(productUrls[i], i));
      await wait(2000); // Delay between requests
    }

    console.log("All scraped product data:", allProductData);
    return new Response(JSON.stringify(allProductData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Critical error in scraping process:', error.message);
    return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    if (browser) await browser.close();
  }
}