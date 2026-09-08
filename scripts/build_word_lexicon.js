// Node script to build the 500-word dataset with tags, confusedWith, and 250 new curated words.
const fs = require('fs');
const path = require('path');

const wordsJsonPath = path.join(__dirname, '../src/data/words.json');
const existingWords = JSON.parse(fs.readFileSync(wordsJsonPath, 'utf8'));

console.log(`Loaded ${existingWords.length} existing words.`);
