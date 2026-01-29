const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Browser Manager - Handles Puppeteer browser lifecycle
 */
class BrowserManager {
  constructor(options = {}) {
    this.browser = null;
    this.initializingPromise = null;
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.userDataDir = null;
    this.headless = options.headless !== undefined ? options.headless : true;
  }

  async init() {
    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    if (this.browser && this.browser.isConnected()) {
      console.log('♻️ Reusing existing browser instance');
      return;
    }

    this.initializingPromise = (async () => {
      try {
        console.log('🚀 Initializing Puppeteer browser...');

        // Create a unique temp directory for this session
        const tmpDir = os.tmpdir();
        this.userDataDir = fs.mkdtempSync(path.join(tmpDir, 'nepse-scraper-'));
        console.log(`📂 Created temp user data dir: ${this.userDataDir}`);

        const launchOptions = {
          headless: this.headless,
          userDataDir: this.userDataDir,
          pipe: true, // Use pipe instead of websocket for better stability
          timeout: 60000,
          ignoreHTTPSErrors: true, // Ignore SSL certificate errors from nepalstock.com
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--disable-background-networking',
            '--disable-background-mode',
            '--disable-http2',
            // Storage and Cache optimizations
            '--aggressive-cache-discard',
            '--disable-cache',
            '--disable-application-cache',
            '--disable-gpu-shader-disk-cache',
            '--media-cache-size=0',
            '--disk-cache-size=0',
            // Speed and resource optimizations
            '--blink-settings=imagesEnabled=false',
            '--blink-settings=stylesheetEnabled=false',
            '--ignore-certificate-errors'
          ]
        };

        // Use system Chrome in production
        let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

        // Auto-detect common paths if not explicitly provided
        if (!executablePath) {
          const commonPaths = [
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium'
          ];
          for (const p of commonPaths) {
            if (fs.existsSync(p)) {
              executablePath = p;
              console.log(`🔍 Auto-detected Chrome at: ${p}`);
              break;
            }
          }
        }

        if (executablePath) {
          console.log(`🔧 Using Chrome executable: ${executablePath}`);
          launchOptions.executablePath = executablePath;

          // Check if executable exists (already done for auto-detected, but good for env var)
          try {
            if (fs.existsSync(executablePath)) {
              console.log('✅ Chrome executable found');
            } else {
              console.error(`❌ Chrome executable not found at: ${executablePath}`);
            }
          } catch (e) {
            console.warn('⚠️ Could not verify Chrome executable existence:', e.message);
          }
        } else {
          console.log('📦 Using bundled Chromium');
        }

        console.log('🌐 Launching browser...');
        this.browser = await puppeteer.launch(launchOptions);
        console.log('✅ Browser launched successfully');

        // Configure download behavior to use temp directory
        const pages = await this.browser.pages();
        if (pages.length > 0) {
          const page = pages[0];
          const client = await page.target().createCDPSession();
          await client.send('Browser.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: this.userDataDir
          });
          console.log(`📥 Download path set to: ${this.userDataDir}`);

          // Set up request interception for all future pages
          await this.browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
              const newPage = await target.page();
              await this._setupRequestInterception(newPage);
            }
          });

          // Setup for initial page
          await this._setupRequestInterception(page);
        }

        // Reset if browser disconnects
        this.browser.on('disconnected', () => {
          console.warn('⚠️ Browser disconnected');

          // Clean up temp directory if it exists
          if (this.userDataDir) {
            try {
              console.log(`🧹 Cleaning up temp dir after disconnect: ${this.userDataDir}`);
              fs.rmSync(this.userDataDir, { recursive: true, force: true });
            } catch (err) {
              console.warn(`⚠️ Failed to clean up temp dir on disconnect: ${err.message}`);
            }
            this.userDataDir = null;
          }

          this.browser = null;
          this.initializingPromise = null;
        });

      } catch (error) {
        console.error('❌ Browser launch failed:', error.message);
        this.browser = null;
        this.initializingPromise = null;
        throw error;
      } finally {
        this.initializingPromise = null;
      }
    })();

    return this.initializingPromise;
  }

  async close() {
    if (this.browser) {
      console.log('🔒 Closing browser...');
      await this.browser.close();
      this.browser = null;
    }

    if (this.userDataDir) {
      try {
        console.log(`🧹 Cleaning up temp dir: ${this.userDataDir}`);
        // Use recursive force deletion to ensure it's gone
        fs.rmSync(this.userDataDir, { recursive: true, force: true });
        console.log('✅ Temp dir cleaned up');
      } catch (err) {
        console.warn(`⚠️ Failed to clean up temp dir: ${err.message}`);
      }
      this.userDataDir = null;
    }
  }

  getBrowser() {
    return this.browser;
  }

  getUserAgent() {
    return this.userAgent;
  }

  /**
   * Set up request interception to block images, CSS, and fonts
   * @param {Object} page - Puppeteer page instance
   * @private
   */
  async _setupRequestInterception(page) {
    try {
      if (!page) return;
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
    } catch (err) {
      console.warn(`⚠️ Failed to setup request interception: ${err.message}`);
    }
  }
}

module.exports = BrowserManager;
