const fs = require('fs');
const srv = fs.readFileSync('ABchatbot/standalone/server.js', 'utf8');

const start = srv.indexOf('return `');
const end = srv.indexOf('`;', start);
const rawBody = srv.substring(start + 7, end);

// In the raw source between backticks of a template literal:
// \` is the escape for a literal backtick -> should become backtick
// \${ is the escape for literal ${ -> should become ${ 
// \\n is the escape for literal \n -> should become \n
// \\ -> is the escape for literal \ -> should become \

// But we need to handle the actual content. Let me look at what we have.
// The raw source has sequences like: \`  and  \${  and  \\n
// In a template literal, these are escape sequences.
// We need to process them as the template literal engine would.

let html = '';

// Simple state machine to process escapes
for (let i = 0; i < rawBody.length; i++) {
  if (rawBody[i] === '\\' && i + 1 < rawBody.length) {
    const next = rawBody[i + 1];
    if (next === '`') {
      html += '`';
      i++;
    } else if (next === '$') {
      html += '$';
      i++;
    } else if (next === '\\') {
      html += '\\';
      i++;
    } else if (next === 'n') {
      html += '\n';
      i++;
    } else {
      html += rawBody[i];
    }
  } else {
    html += rawBody[i];
  }
}

fs.writeFileSync('ABchatbot/standalone/app.html', html);
console.log('Generated app.html, length:', html.length);

const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
if (scriptMatch) {
  const js = scriptMatch[1];
  console.log('Has function App():', js.includes('function App()'));
  console.log('Has sendMessage:', js.includes('async function sendMessage'));
  console.log('Has template literal (backtick):', js.includes('`'));
  console.log('Has template interpolation ${}:', js.includes('${'));
}
