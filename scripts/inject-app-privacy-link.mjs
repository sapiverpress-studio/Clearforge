import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'public', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const privacyHref = '/app/privacy/';

if (html.includes(`href="${privacyHref}"`) || html.includes(`href='${privacyHref}'`)) {
  console.log('Main page already links to the app privacy policy.');
  process.exit(0);
}

const link = '<a href="/app/privacy/">Privacy</a>';
let updated = html;

if (/<\/footer>/i.test(updated)) {
  updated = updated.replace(/<\/footer>/i, `<p class="privacy-link">${link}</p></footer>`);
} else if (/<\/body>/i.test(updated)) {
  updated = updated.replace(/<\/body>/i, `<footer class="site-footer"><p>${link}</p></footer></body>`);
} else {
  throw new Error('Could not find a safe insertion point in public/index.html');
}

fs.writeFileSync(file, updated, 'utf8');
console.log('Added Privacy link to the main Sapiver Forge page.');
