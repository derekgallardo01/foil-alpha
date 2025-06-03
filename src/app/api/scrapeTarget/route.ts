import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST() {
  console.time('api-scrape-target');
  try {
    console.log('🚀 Starting scrape process...');
    const command = '/var/www/my-next-app/myenv/bin/python3 /var/www/my-next-app/scrape_target.py';
    const { stdout, stderr } = await execPromise(command);
    
    console.log('✅ Scrape completed:', stdout);
    if (stderr.trim()) console.warn('⚠️ Scrape stderr:', stderr);
    
    return new Response(JSON.stringify({ 
      message: 'Scraping completed', 
      output: stdout,
      errors: stderr.trim() || null 
    }), { status: 200 });
  } catch (error) {
    console.error('❌ Error during scrape:', error);
    return new Response(JSON.stringify({ 
      error: 'Scraping failed', 
      details: error.message,
      stderr: error.stderr || null 
    }), { status: 500 });
  } finally {
    console.timeEnd('api-scrape-target');
  }
}