import undetected_chromedriver as uc
import sys
import json
import uuid
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from concurrent.futures import ThreadPoolExecutor, as_completed
import mysql.connector
from mysql.connector import Error
import os
from dotenv import load_dotenv
from datetime import datetime
import decimal
from urllib.parse import urlparse
from webdriver_manager.chrome import ChromeDriverManager

load_dotenv('/var/www/foil-alpha/.env.local')

db_config = {
    'host': os.getenv('MYSQL_HOST'),
    'user': os.getenv('MYSQL_USER'),
    'password': os.getenv('MYSQL_PASSWORD'),
    'database': os.getenv('MYSQL_DATABASE')
}

def get_retailer(url):
    parsed_url = urlparse(url)
    if "target.com" in parsed_url.netloc:
        return "Target"
    elif "amazon.com" in parsed_url.netloc:
        return "Amazon"
    return "Unknown"

def connect_db():
    sys.stderr.write("Debug: Attempting DB connection\n")
    sys.stderr.flush()
    try:
        connection = mysql.connector.connect(**db_config)
        if connection.is_connected():
            sys.stderr.write("Debug: Connected to MySQL database\n")
            sys.stderr.flush()
            return connection
    except Error as e:
        sys.stderr.write(f"Error connecting to MySQL: {str(e)}\n")
        sys.stderr.flush()
        return None

def check_existing_products(connection, urls):
    cursor = None
    try:
        cursor = connection.cursor()
        placeholders = ','.join(['%s'] * len(urls))
        query = f"""
            SELECT p.product_id, p.retailer, p.title, p.url, p.image, p.screenshot, p.stock_status, 
                   ph.price, ph.recorded_at
            FROM products p
            LEFT JOIN (
                SELECT product_id, price, recorded_at
                FROM pricehistory
                WHERE (product_id, recorded_at) IN (
                    SELECT product_id, MAX(recorded_at)
                    FROM pricehistory
                    GROUP BY product_id
                )
            ) ph ON p.product_id = ph.product_id
            WHERE p.url IN ({placeholders})
        """
        cursor.execute(query, urls)
        rows = cursor.fetchall()

        existing_data = {}
        for row in rows:
            recorded_at = row[8]
            if isinstance(recorded_at, (int, float, decimal.Decimal)):
                recorded_at = datetime.fromtimestamp(float(recorded_at))
            elif recorded_at is None:
                recorded_at = None
            else:
                recorded_at = recorded_at

            price_value = row[7] if row[7] is not None else 0.0
            formatted_price = f"${float(price_value):.2f}"

            existing_data[row[3]] = {
                'retailer': row[1],
                'title': row[2],
                'url': row[3],
                'image': row[4],
                'screenshot': row[5],
                'stockStatus': row[6],
                'price': formatted_price,
                'recorded_at': recorded_at.isoformat() if recorded_at else None
            }
        
        sys.stderr.write(f"Debug: Found {len(existing_data)} existing products in DB\n")
        sys.stderr.flush()
        return existing_data
    except Error as e:
        sys.stderr.write(f"Error checking existing products: {str(e)}\n")
        sys.stderr.flush()
        return {}
    finally:
        if cursor:
            cursor.close()

def scrape_url(url):
    driver = None
    try:
        options = uc.ChromeOptions()
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--headless')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36')
        options.add_argument('--disable-blink-features=AutomationControlled')

        sys.stderr.write(f"Debug: Initializing Chrome for {url}\n")
        sys.stderr.flush()
        driver = uc.Chrome(options=options, driver_executable_path=ChromeDriverManager().install(), version_main=133)
        sys.stderr.write(f"Debug: Loading URL: {url}\n")
        sys.stderr.flush()
        driver.get(url)
        retailer = get_retailer(url)

        # Clean the title by removing ": Target" if present
        raw_title = driver.title
        cleaned_title = raw_title.replace(": Target", "").strip()
        sys.stderr.write(f"Debug: Cleaned title from '{raw_title}' to '{cleaned_title}'\n")
        sys.stderr.flush()

        try:
            image_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '.styles_zoomableImage__R_OOf img'))
            )
            image_url = image_element.get_attribute('src')
        except Exception as e:
            sys.stderr.write(f"Failed to find image for {url}: {str(e)}\n")
            image_url = 'Image not found'

        try:
            price_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '[data-test="product-price"]'))
            )
            price = price_element.text.strip()
            sys.stderr.write(f"Debug: Scraped price for {url}: {price}\n")
            sys.stderr.flush()
        except Exception as e:
            sys.stderr.write(f"Failed to find price for {url}: {str(e)}\n")
            price = 'Price not found'

        try:
            stock_element = WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, '[data-test="@web/AddToCart/Fulfillment/ShippingSection"] span'))
            )
            stockStatus = stock_element.text.strip()
        except Exception as e:
            sys.stderr.write(f"Failed to find stock status for {url}: {str(e)}\n")
            stockStatus = "Stock status not found"

        screenshot_path = f"/var/www/foil-alpha/screenshots/screenshot_{uuid.uuid4().hex[:8]}.png"
        try:
            os.makedirs(os.path.dirname(screenshot_path), exist_ok=True)
            driver.save_screenshot(screenshot_path)
            sys.stderr.write(f"Debug: Screenshot saved at: {screenshot_path}\n")
            sys.stderr.flush()
        except Exception as e:
            sys.stderr.write(f"Failed to save screenshot for {url}: {str(e)}\n")
            screenshot_path = "Screenshot not saved"

        return {
            "retailer": retailer,
            "title": cleaned_title,  # Use the cleaned title here
            "url": url,
            "image": image_url,
            "price": price,
            "stockStatus": stockStatus,
            "screenshot": screenshot_path
        }
    except Exception as e:
        sys.stderr.write(f"Critical failure in scrape_url for {url}: {str(e)}\n")
        sys.stderr.flush()
        return None
    finally:
        if driver:
            driver.quit()

def save_to_db(connection, results):
    cursor = None
    try:
        cursor = connection.cursor()
        sys.stderr.write("Debug: Starting DB save\n")
        sys.stderr.flush()
        
        if not results:
            sys.stderr.write("Debug: No results to save\n")
            sys.stderr.flush()
            return

        product_inserts = []
        price_inserts = []
        for result in results:
            if not result:
                continue
            sys.stderr.write(f"Debug: Processing URL: {result['url']}\n")
            sys.stderr.flush()
            cursor.execute("SELECT product_id FROM products WHERE url = %s", (result['url'],))
            product_row = cursor.fetchone()

            if not product_row:
                product_inserts.append((
                    result['retailer'], result['title'], result['url'], result['image'], 
                    result['screenshot'], result['stockStatus']
                ))

            try:
                price_str = result['price'].replace('$', '').replace(',', '').strip()
                price = float(price_str) if price_str else 0.0
                sys.stderr.write(f"Debug: Converted price for {result['url']}: {price}\n")
                sys.stderr.flush()
            except (ValueError, AttributeError) as e:
                sys.stderr.write(f"Debug: Price conversion failed for {result['price']}: {str(e)}\n")
                price = 0.0

            price_inserts.append((product_row[0] if product_row else None, price))

        if product_inserts:
            cursor.executemany("""
                INSERT INTO products (retailer, title, url, image, screenshot, stock_status)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, product_inserts)
            cursor.execute("SELECT url, product_id FROM products WHERE url IN (%s)" % ','.join(['%s'] * len(results)), 
                          [r['url'] for r in results if r])
            new_ids = {row[0]: row[1] for row in cursor.fetchall()}
            price_inserts = [(new_ids.get(r['url'], pid), price) for (pid, price), r in zip(price_inserts, [r for r in results if r])]

        if price_inserts:
            cursor.executemany("""
                INSERT INTO pricehistory (product_id, price)
                VALUES (%s, %s)
            """, price_inserts)

        connection.commit()
        sys.stderr.write("Debug: Data saved to database\n")
        sys.stderr.flush()
    except Error as e:
        sys.stderr.write(f"Database error: {str(e)}\n")
        sys.stderr.flush()
        if connection:
            connection.rollback()
    finally:
        if cursor:
            cursor.close()

def main():
    urls = [
        "https://www.target.com/p/2025-pokemon-scarlet-violet-s8-5-poster-collection/-/A-93803457",
        "https://www.target.com/p/2024-pok-scarlet-violet-s8-5-elite-trainer-box/-/A-93954435",
        "https://www.target.com/p/pokemon-scarlet-violet-s3-5-booster-bundle-box/-/A-88897904",
        "https://www.target.com/p/pok-233-mon-trading-card-game-crown-zenith-booster-bundle-box/-/A-94091405",
        "https://www.target.com/p/pokemon-trading-card-game-scarlet-38-violet-151-elite-trainer-box/-/A-88897899",
        "https://www.target.com/p/pokemon-trading-card-game-scarlet-38-violet-151-ultra-premium-collection/-/A-88897906",
        "https://www.target.com/p/2025-pokemon-prismatic-evolutions-binder-collection/-/A-94300066",
        "https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-151-collection-zapdos-ex/-/A-88897898",
        "https://www.target.com/p/2025-pok-233-mon-prismatic-evolutions-super-premium-collection/-/A-94300072",
        "https://www.target.com/p/pok-233-mon-trading-card-game-scarlet-38-violet-prismatic-evolutions-booster-bundle/-/A-93954446",
        "https://www.target.com/p/2025-pok-233-mon-scarlet-violet-s9-elite-trainer-box/-/A-93803439"
    ]
    
    connection = None
    try:
        connection = connect_db()
        if not connection:
            sys.exit(1)

        existing_data = check_existing_products(connection, urls)
        sys.stdout.write(json.dumps(list(existing_data.values()), ensure_ascii=False) + "\n")
        sys.stdout.flush()

        urls_to_scrape = [url for url in urls if url not in existing_data]
        sys.stderr.write(f"Debug: URLs to scrape: {urls_to_scrape}\n")
        sys.stderr.flush()

        if urls_to_scrape:
            chrome_path = uc.find_chrome_executable()
            sys.stderr.write(f"Debug: Using Chrome at: {chrome_path}\n")
            sys.stderr.flush()

            sys.stderr.write("Debug: Starting parallel scraping\n")
            sys.stderr.flush()
            results = []
            with ThreadPoolExecutor(max_workers=4) as executor:
                future_to_url = {executor.submit(scrape_url, url): url for url in urls_to_scrape}
                for future in as_completed(future_to_url):
                    url = future_to_url[future]
                    try:
                        result = future.result()
                        if result:
                            results.append(result)
                        else:
                            sys.stderr.write(f"Scraping failed for {url}: No result returned\n")
                    except Exception as e:
                        sys.stderr.write(f"Scraping failed for {url}: {str(e)}\n")
                        sys.stderr.flush()

            sys.stderr.write("Debug: Scraping complete, saving to DB\n")
            sys.stderr.flush()
            if results:
                save_to_db(connection, results)

            # Re-fetch to include new data
            final_data = check_existing_products(connection, urls)
            sys.stdout.write(json.dumps(list(final_data.values()), ensure_ascii=False) + "\n")
            sys.stdout.flush()

    except Exception as e:
        sys.stderr.write(f"Scraping failed: {str(e)}\n")
        sys.stderr.flush()
        sys.exit(1)
    finally:
        if connection and connection.is_connected():
            connection.close()
            sys.stderr.write("Debug: Database connection closed\n")
            sys.stderr.flush()

if __name__ == "__main__":
    main()