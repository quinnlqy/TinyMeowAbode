const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');
const INDEX_HTML_PATH = path.join(PROJECT_ROOT, 'index.html');
const MAIN_JS_PATH = path.join(PROJECT_ROOT, 'scripts', 'main.js');

// Helper to run commands
function run(cmd) {
    console.log(`> ${cmd}`);
    try {
        execSync(cmd, { stdio: 'inherit', cwd: PROJECT_ROOT });
    } catch (e) {
        console.error(`Command failed: ${cmd}`);
        process.exit(1);
    }
}

// 1. Read current version from main.js
console.log('Reading current version from scripts/main.js...');
let mainJsContent = fs.readFileSync(MAIN_JS_PATH, 'utf8');
const versionMatch = mainJsContent.match(/window\.GAME_VERSION\s*=\s*["']v?(\d+\.\d+)["'];/);

if (!versionMatch) {
    console.error('Could not find window.GAME_VERSION in scripts/main.js');
    process.exit(1);
}

let currentVerStr = versionMatch[1];
let currentVer = parseFloat(currentVerStr);
let newVer = (currentVer + 0.1).toFixed(1);
let newVerStr = `v${newVer}`;

console.log(`Current Version: v${currentVerStr} -> New Version: ${newVerStr}`);

// 2. Update scripts/main.js
mainJsContent = mainJsContent.replace(
    /window\.GAME_VERSION\s*=\s*["']v?\d+\.\d+["'];/,
    `window.GAME_VERSION = "${newVerStr}";`
);
fs.writeFileSync(MAIN_JS_PATH, mainJsContent);
console.log('Updated scripts/main.js');

// 3. Update index.html
console.log('Updating index.html...');
let indexHtmlContent = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
// Regex for <span id="game-version" ... >V1.5</span>
// Note: The span content might have whitespace
indexHtmlContent = indexHtmlContent.replace(
    /(<span id="game-version"[^>]*>)\s*V?\d+\.\d+\s*(<\/span>)/i,
    `$1${newVerStr}$2` // Keep V uppercase if needed? The user used "V1.5" in HTML but "v1.5" in JS.
    // Let's use the newVerStr which is "v1.6" (lowercase v). 
    // Wait, HTML had "V1.5". Let's match case.
    // Actually, let's just use "V" + newVer.
);

// Fix: explicitly replace the version text
indexHtmlContent = indexHtmlContent.replace(
    /(id="game-version"[^>]*>)\s*(V|v)?\d+\.\d+\s*(<\/)/,
    `$1V${newVer}$3` // Always use uppercase V in HTML
);

fs.writeFileSync(INDEX_HTML_PATH, indexHtmlContent);
console.log('Updated index.html');

// 4. Git Operations
const commitMsg = process.argv[2] || `Update to ${newVerStr}`;
console.log(`Committing with message: "${commitMsg}"...`);

run('git add .');
run(`git commit -m "${commitMsg}"`);
run('git push');

console.log('Done! 🚀');
