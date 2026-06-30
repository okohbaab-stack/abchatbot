const fs = require('fs');
let html = fs.readFileSync('ABchatbot/standalone/app.html', 'utf8');

console.log('Original length:', html.length);
console.log('First 100:', JSON.stringify(html.substring(0, 100)));

// The app.html contains raw source between template literal backticks.
// This means escape sequences for the template literal are still present.
// We need to convert template-literal escapes to actual characters.
//
// Common patterns in the raw source:
// \`  -> `  (escaped backtick becomes backtick)
// \${ -> ${ (escaped dollar-brace becomes dollar-brace)
// \\n -> newline (if preceded by \)
// \\  -> \ (double backslash)
//
// But we only want to process these when they actually represent
// template literal escapes, not when they're actual JS string content.

let result = '';
for (let i = 0; i < html.length; i++) {
  if (html[i] === '\\' && i + 1 < html.length) {
    const next = html[i + 1];
    if (next === '`') {
      result += '`';
      i++;
    } else if (next === '$') {
      result += '$';
      i++;
    } else if (next === '\\') {
      result += '\\';
      i++;
    } else if (next === 'n' && html[i - 1] === '\\') {
      // Already handled by the double backslash case above
      result += 'n';
      i++;
    } else {
      result += html[i];
    }
  } else {
    result += html[i];
  }
}

console.log('Processed length:', result.length);
console.log('First 100 after fix:', JSON.stringify(result.substring(0, 100)));

// Verify key patterns
console.log('Has raw backtick:', result.includes('`'));
console.log('Has ${}:', result.includes('${'));
console.log('Has function App():', result.includes('function App()'));

fs.writeFileSync('ABchatbot/standalone/app.html', result);
console.log('Saved!');
