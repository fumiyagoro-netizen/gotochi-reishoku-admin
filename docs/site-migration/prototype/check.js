const { chromium } = require('playwright');
const S = process.argv[2];
(async () => {
  const b = await chromium.launch();
  for (const w of [400, 768, 1280, 1440]) {
    const page = await b.newPage({ viewport: { width: w, height: 900 } });
    await page.goto('file://' + S + '/gotouchi-2027-prototype.html'); await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const vw = innerWidth, bad = [];
      document.querySelectorAll('body *').forEach(el => { if (el.closest('.marquee, .logos, .scroller')) return; const rc = el.getBoundingClientRect(); if (rc.width > 0 && (rc.right > vw + 1 || rc.left < -1)) bad.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' ' + Math.round(rc.left) + '-' + Math.round(rc.right)); });
      return { sw: document.documentElement.scrollWidth, bad: bad.slice(0, 8) };
    });
    console.log(w + 'px scrollWidth=' + r.sw + (r.bad.length ? ' overflow: ' + r.bad.join(' | ') : ' ok'));
    await page.close();
  }
  await b.close();
})();
