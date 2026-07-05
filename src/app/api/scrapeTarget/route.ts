import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execPromise = promisify(exec);

export async function POST() {
  console.time('api-scrape-target');

  // The Python scraper (scrape_target.py + headless Chrome) is not available in
  // the default Railway runtime. It stays disabled unless a host that provides
  // Python + Chrome sets ENABLE_SCRAPER=true, so the route degrades gracefully
  // instead of trying to exec a missing interpreter.
  if (process.env.ENABLE_SCRAPER !== 'true') {
    console.timeEnd('api-scrape-target');
    return new Response(
      JSON.stringify({
        error: 'Scraping is disabled in this environment',
        details: 'Set ENABLE_SCRAPER=true on a host with Python + Chrome to enable it.',
      }),
      { status: 503 }
    );
  }

  try {
    console.log('🚀 Starting scrape process...');

    // Dynamic path based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const scriptPath = isProduction 
      ? '/var/www/foil-alpha/scrape_target.py'
      : path.join(process.cwd(), 'scrape_target.py');
    
    const pythonCommand = isProduction 
      ? '/var/www/foil-alpha/myenv/bin/python3'
      : 'python';
    
    const command = `${pythonCommand} ${scriptPath}`;
    const { stdout, stderr } = await execPromise(command);

    console.log('✅ Scrape completed:', stdout);
    if (stderr.trim()) console.warn('⚠️ Scrape stderr:', stderr);

    return new Response(
      JSON.stringify({
        message: 'Scraping completed',
        output: stdout,
        errors: stderr.trim() || null,
      }),
      { status: 200 }
    );
  } catch (error: unknown) {
    // Type guard to ensure error is an Error object
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Error during scrape:', err);

    // Safely access stderr if it exists
    const stderr = 'stderr' in err && typeof err.stderr === 'string' ? err.stderr : null;

    return new Response(
      JSON.stringify({
        error: 'Scraping failed',
        details: err.message,
        stderr,
      }),
      { status: 500 }
    );
  } finally {
    console.timeEnd('api-scrape-target');
  }
}