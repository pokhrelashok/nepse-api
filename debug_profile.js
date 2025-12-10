const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log('Navigating...');
    await page.goto('https://www.nepalstock.com/company/detail/2790', { waitUntil: 'networkidle0', timeout: 60000 });

    console.log('Checking Initial Text (Sector/Status)...');
    const text1 = await page.evaluate(() => document.body.innerText);
    // console.log(text1); // Too long
    // Check finding "Sector"
    console.log('Sector Match:', text1.match(/Sector:.*/));
    console.log('Status Match:', text1.match(/Status:.*/));

    console.log('Clicking Profile Tab...');
    // Try to find element with text "Profile"
    const clicked = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('a, button, li, div'));
      const profileTab = els.find(el => el.innerText && el.innerText.trim() === 'Profile');
      if (profileTab) {
        profileTab.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log('Clicked. Waiting...');
      await new Promise(r => setTimeout(r, 3000)); // Wait for tab switch

      const text2 = await page.evaluate(() => document.body.innerText);
      console.log('PROFILE TEXT START');
      // Log relevant parts
      console.log(text2.substring(0, 500));

      // Check for Logo image
      const logo = await page.evaluate(() => {
        const img = document.querySelector('img.company-logo, .profile-logo img, img[alt*="logo"]');
        return img ? img.src : 'Not Found';
      });
      console.log('Logo Src:', logo);

      // Check for Description
      const desc = await page.evaluate(() => {
        // Description usually in p tag in active tab
        const p = document.querySelector('.tab-content p, .profile-section p');
        return p ? p.innerText : 'Not Found';
      });
      console.log('Desc:', desc);

    } else {
      console.log('Profile tab not found.');
    }

  } catch (e) {
    console.error(e);
  }
  await browser.close();
})();
