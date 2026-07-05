
import { Builder, By, until, WebDriver } from 'selenium-webdriver';
import { Options } from 'selenium-webdriver/chrome';
import { ServiceBuilder } from 'selenium-webdriver/chrome';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Update for Windows environment; adjust path as needed
process.env.WEBDRIVER_CHROME_DRIVER = 'C:/chromedriver/chromedriver.exe';

// This route drives a real browser (Selenium/Chrome) at request time. Marking
// it dynamic stops Next from executing the handler during the build's static-
// generation pass, which would hang on hosts without a browser (e.g. Railway).
export const dynamic = 'force-dynamic';

interface ProductData {
  title: string;
  image: string;
  price: string;
  stockStatus: string;
  isAvailable: boolean;
  notifyMessage: string;
  url?: string;
  retailer?: string;
  message?: string;
  error?: string;
}

const productCache: { [key: string]: ProductData } = {};
const proxies = [
  "http://pokemondealer:ZFT2ZBZ7PXw72jgwFJBByu6U~@168.151.202.243:20000",
  "http://pokemondealer:ZFT2ZBZ7PXw72jgwFJBByu6U~@188.42.21.191:20000",
  "http://pokemondealer:ZFT2ZBZ7PXw72jgwFJBByu6U~@188.42.21.90:20000"
];

interface Proxy {
  username: string;
  password: string;
  host: string;
  port: string;
}

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseProxy(proxyUrl: string): Proxy {
  const match = proxyUrl.match(/http:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);
  if (!match) throw new Error(`Invalid proxy format: ${proxyUrl}`);
  const [, username, password, host, port] = match;
  return { username, password, host, port };
}

function getRetailerName(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '').split('.')[0];
    const retailerMap: { [key: string]: string } = { 'target': 'Target', 'bestbuy': 'Best Buy' };
    return retailerMap[domain.toLowerCase()] || domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch (error) {
    console.error('Error parsing retailer from URL:', (error as Error).message);
    return 'Unknown Retailer';
  }
}

async function testProxy(proxy: string): Promise<boolean> {
  const { host, port, username, password } = parseProxy(proxy);
  const agent = new HttpsProxyAgent(`http://${username}:${password}@${host}:${port}`);
  const response = await fetch('https://www.target.com', { agent }).catch(() => null);
  return response?.status === 200;
}

async function scrapeWithRetry(driver: WebDriver, url: string, retries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await driver.get(url);
      await driver.wait(
        until.elementsLocated(By.css('[data-test="product-price"], [data-test="shipping-text"], .price, .stock')),
        90000
      );
      return true;
    } catch (error) {
      console.log(`Attempt ${attempt}/${retries} failed for ${url}: ${(error as Error).message}`);
      if (attempt === retries) throw error;
      await wait(2000 * attempt);
    }
  }
  return false;
}

export async function GET(): Promise<Response> {
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

  let driver: WebDriver | null = null;
  let workingProxy: string | null = null;

  try {
    for (const proxy of proxies) {
      if (await testProxy(proxy)) {
        workingProxy = proxy;
        console.log(`Using proxy: ${parseProxy(proxy).host}:${parseProxy(proxy).port}`);
        break;
      }
    }
    if (!workingProxy) throw new Error('No working proxies found');

    const chromedriverPath = process.env.WEBDRIVER_CHROME_DRIVER;
    if (!chromedriverPath) {
      throw new Error('WEBDRIVER_CHROME_DRIVER environment variable is not set');
    }
    console.log('Using chromedriver at:', chromedriverPath);

    try {
      await fs.access(chromedriverPath, fs.constants.X_OK);
      console.log('Chromedriver binary is accessible and executable');
    } catch (err) {
      throw new Error(`Chromedriver at ${chromedriverPath} not accessible: ${(err as Error).message}`);
    }

    const service = new ServiceBuilder(chromedriverPath);
    const chromeOptions = new Options();
    chromeOptions.addArguments(
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--headless=new',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-extensions',
      '--ignore-certificate-errors',
      `--proxy-server=${parseProxy(workingProxy).host}:${parseProxy(workingProxy).port}`
    );

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeService(service)
      .setChromeOptions(chromeOptions)
      .build();

    await driver.executeScript(`
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      window.chrome = { runtime: {} };
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type) {
        const ctx = getContext.apply(this, arguments);
        if (type === '2d') {
          const fillText = ctx.fillText;
          ctx.fillText = function() {
            fillText.apply(this, arguments);
            ctx.fillStyle = '#f00';
            ctx.fillRect(0, 0, 1, 1);
          };
        }
        return ctx;
      };
    `);

    const { username, password } = parseProxy(workingProxy);
    try {
      await driver.executeScript(`
        window.proxyAuth = { username: '${username}', password: '${password}' };
        setTimeout(() => {
          window.scrollTo(0, Math.random() * 500);
        }, 2000);
      `);
    } catch (error) {
      console.error('Error setting proxy authentication:', (error as Error).message);
      throw new Error('Failed to configure proxy authentication');
    }

    const scrapeProduct = async (productUrl: string, index: number): Promise<ProductData> => {
      if (productCache[productUrl]) {
        console.log('Serving from cache...', productUrl);
        return productCache[productUrl];
      }

      try {
        await scrapeWithRetry(driver!, productUrl);
        await wait(10000);

        await driver!.actions()
          .move({ x: Math.floor(Math.random() * 1000), y: Math.floor(Math.random() * 600) })
          .perform();
        await driver!.executeScript('window.scrollBy(0, Math.random() * 500);');

        const screenshot = await driver!.takeScreenshot();
        await fs.writeFile(`screenshot-${index}.png`, screenshot, 'base64');
        console.log(`Screenshot saved for ${productUrl} at ${process.cwd()}/screenshot-${index}.png`);

        const pageTitle = await driver!.getTitle();
        console.log(`Page title for ${productUrl}: ${pageTitle}`);

        const debugElements = await driver!.executeScript(`
          const priceEls = Array.from(document.querySelectorAll('[data-test="product-price"], [data-test="current-price"], .price, [class*="price"]'))
            .map(el => ({ selector: el.getAttribute('data-test') || el.className || el.tagName, text: el.innerText.trim() }));
          const stockEls = Array.from(document.querySelectorAll('[data-test="shipping-text"], .stock, [class*="stock"], [class*="availability"]'))
            .map(el => ({ selector: el.getAttribute('data-test') || el.className || el.tagName, text: el.innerText.trim() }));
          return { priceEls, stockEls };
        `);
        console.log(`Debug elements for ${productUrl}:`, JSON.stringify(debugElements, null, 2));

        const productData: ProductData = await driver!.executeScript(`
          const title = document.querySelector('h1[data-test="product-title"]')?.innerText.trim() ||
                        document.querySelector('h1')?.innerText.trim() || 'Title not found';
          const image = document.querySelector('img[alt="product image"]')?.getAttribute('src') ||
                        document.querySelector('img')?.getAttribute('src') || 'Image not found';
          const priceElements = Array.from(document.querySelectorAll('[data-test="product-price"], [data-test="current-price"], .price, [class*="price"]'))
            .filter(el => el);
          const priceElement = priceElements.find(el => /\\$\\d/.test(el.innerText.trim()));
          let price = priceElement ? priceElement.innerText.trim() : 'Price not found';
          if (price !== 'Price not found' && /\\$\\d/.test(price)) {
            price = price.match(/\\$\\d+\\.?\\d*/)?.[0] || price;
          }
          const stockElements = Array.from(document.querySelectorAll('[data-test="shipping-text"], .stock, [class*="stock"], [class*="availability"]'))
            .filter(el => el);
          let stockStatus = stockElements.find(el => el.innerText.trim())?.innerText.trim() || 'Stock status not found';
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
        `);

        if (productData.price === 'Price not found' || productData.stockStatus === 'Stock status not found') {
          const tcin = productUrl.match(/A-(\d+)/)?.[1];
          if (tcin) {
            const apiUrl = `https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1?key=9f36aeafbe60771e321a7cc95a78140772ab3e96&tcin=${tcin}&pricing_store_id=1865&is_bot=false&zip=07047&state=NJ`;
            const response = await fetch(apiUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://www.target.com/',
              },
            });
            const data = await response.json();
            console.log(`API response for ${tcin}:`, JSON.stringify(data, null, 2));
            if (data?.data?.product?.price?.formatted_current_price) {
              productData.price = data.data.product.price.formatted_current_price;
            }
            if (data?.data?.product?.fulfillment?.store_options?.[0]?.availability_status) {
              productData.stockStatus = data.data.product.fulfillment.store_options[0].availability_status === 'IN_STOCK' ? 'In stock' : 'Out of stock';
              productData.isAvailable = productData.stockStatus === 'In stock';
            }
          }
        }

        const retailer = getRetailerName(productUrl);
        const productWithUrl: ProductData = { ...productData, url: productUrl, retailer };
        productCache[productUrl] = productWithUrl;
        return productWithUrl;
      } catch (scrapeError) {
        console.error(`Final error scraping ${productUrl}:`, (scrapeError as Error).message);
        const html = await driver!.getPageSource();
        await fs.writeFile(`error-${index}.html`, html);
        return {
          message: `Error scraping product: ${productUrl}`,
          error: (scrapeError as Error).message,
          url: productUrl,
          retailer: getRetailerName(productUrl),
          title: 'Error',
          image: 'Error',
          price: 'Error',
          stockStatus: 'Error',
          isAvailable: false,
          notifyMessage: 'Error'
        };
      }
    };

    const allProductData: ProductData[] = [];
    for (let i = 0; i < productUrls.length; i++) {
      allProductData.push(await scrapeProduct(productUrls[i], i));
      await wait(2000);
    }

    console.log("All scraped product data:", allProductData);
    return new Response(JSON.stringify(allProductData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Critical error in scraping process:', (error as Error).message);
    return new Response(JSON.stringify({ error: 'Server error', details: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    if (driver) await driver.quit();
  }
}
