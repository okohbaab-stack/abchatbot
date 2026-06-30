const fs = require('fs');
const html = fs.readFileSync('ABchatbot/standalone/app.html', 'utf8');

const s = html.indexOf('<script>');
const e = html.indexOf('</script>');
const js = html.substring(s + 8, e);

console.log('JS length:', js.length);

// Check quote balance
const sq = (js.match(/'/g) || []).length;
const dq = (js.match(/"/g) || []).length;
console.log('Single quotes:', sq, '- even:', sq % 2 === 0);
console.log('Double quotes:', dq, '- even:', dq % 2 === 0);

// Check for HTML entities in JS
const hasQuot = html.includes('&quot;');
const hasApos = html.includes('&#39;');
console.log('Has &quot;:', hasQuot);
console.log('Has &#39;:', hasApos);

// Try parsing JS
try {
  new Function(js);
  console.log('JS PARSES OK!');
} catch (e) {
  console.log('JS PARSE ERROR:', e.message);
}
