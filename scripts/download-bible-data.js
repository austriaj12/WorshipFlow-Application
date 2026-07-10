/**
 * Download Bible Data Script
 * Downloads KJV and ASV Bible JSON files from the aruljohn GitHub repos.
 * 
 * Usage: node scripts/download-bible-data.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel',
  'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
  'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts',
  'Romans', '1 Corinthians', '2 Corinthians', 'Galatians',
  'Ephesians', 'Philippians', 'Colossians',
  '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
  'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

const TRANSLATIONS = {
  KJV: {
    repo: 'aruljohn/Bible-kjv',
    branch: 'master'
  }
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const makeRequest = (requestUrl, redirectCount = 0) => {
      if (redirectCount > 5) return reject(new Error('Too many redirects'));
      
      https.get(requestUrl, { headers: { 'User-Agent': 'WorshipFlow-Bible-Downloader' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return makeRequest(res.headers.location, redirectCount + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${requestUrl}`));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    };
    makeRequest(url);
  });
}

async function downloadBook(translation, bookName, outputDir) {
  const config = TRANSLATIONS[translation];
  // Strip spaces for aruljohn/Bible-kjv file name convention
  const rawBookName = bookName.replace(/\s+/g, '');
  const url = `https://raw.githubusercontent.com/${config.repo}/${config.branch}/${rawBookName}.json`;
  
  try {
    const json = await fetchUrl(url);
    // Validate it's valid JSON
    JSON.parse(json);
    const filePath = path.join(outputDir, `${bookName}.json`);
    fs.writeFileSync(filePath, json, 'utf8');
    return true;
  } catch (err) {
    console.error(`  ✗ Failed: ${bookName} (${translation}): ${err.message}`);
    return false;
  }
}

async function main() {
  const rootDir = path.join(__dirname, '..', 'bible-data');
  
  console.log('═══════════════════════════════════════════');
  console.log('  WorshipFlow Bible Data Downloader');
  console.log('═══════════════════════════════════════════\n');

  for (const [translation, config] of Object.entries(TRANSLATIONS)) {
    const translationDir = path.join(rootDir, translation);
    fs.mkdirSync(translationDir, { recursive: true });
    
    console.log(`📖 Downloading ${translation} from ${config.repo}...`);
    
    let success = 0;
    let failed = 0;
    
    for (let i = 0; i < BIBLE_BOOKS.length; i++) {
      const book = BIBLE_BOOKS[i];
      const existing = path.join(translationDir, `${book}.json`);
      
      // Skip if already downloaded
      if (fs.existsSync(existing)) {
        const stat = fs.statSync(existing);
        if (stat.size > 100) {
          success++;
          continue;
        }
      }
      
      process.stdout.write(`  [${i + 1}/${BIBLE_BOOKS.length}] ${book}...`);
      const ok = await downloadBook(translation, book, translationDir);
      if (ok) {
        process.stdout.write(' ✓\n');
        success++;
      } else {
        failed++;
      }
      
      // Small delay to be respectful to GitHub
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log(`  ✅ ${translation}: ${success} books downloaded, ${failed} failed\n`);
  }
  
  console.log('Done! Bible data is ready in bible-data/');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
