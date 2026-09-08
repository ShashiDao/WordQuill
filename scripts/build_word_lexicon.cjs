const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const requireCjs = createRequire(__filename);

const wordsJsonPath = path.join(__dirname, '../src/data/words.json');
const existingWords = JSON.parse(fs.readFileSync(wordsJsonPath, 'utf8'));

console.log(`Loaded ${existingWords.length} existing words.`);

const newAdvanced = requireCjs('./new_advanced.cjs');
const newLiterary = requireCjs('./new_literary.cjs');
const newAcademic = requireCjs('./new_academic.cjs');
const newEloquence = requireCjs('./new_eloquence.cjs');
const newEveryday = requireCjs('./new_everyday.cjs');

console.log(`New entries loaded:
- Advanced: ${newAdvanced.length}
- Literary: ${newLiterary.length}
- Academic: ${newAcademic.length}
- Eloquence: ${newEloquence.length}
- Everyday: ${newEveryday.length}
`);

// Existing words tag mapping
const categoryDefaultTags = {
  advanced: ['GRE'],
  literary: ['literary-craft'],
  academic: ['academic-writing'],
  eloquence: ['rhetoric', 'everyday-eloquence'],
  everyday: ['everyday-eloquence', 'business-writing']
};

// Known confused-with pairs for existing words
const commonConfusions = {
  compliment: [
    { word: 'complement', distinction: 'A compliment is praise or flattery; a complement is something that completes or pairs well with something.' }
  ],
  discreet: [
    { word: 'discrete', distinction: 'Discreet means tactful and keeping secrets; discrete means separate, distinct, or detached.' }
  ],
  affect: [
    { word: 'effect', distinction: 'Affect is usually a verb meaning to influence; effect is usually a noun meaning a result.' }
  ],
  ephemeral: [
    { word: 'evanescent', distinction: 'Ephemeral emphasizes short-lived duration (lasting a day); evanescent emphasizes vanishing like mist or vapor.' }
  ],
  perspicacious: [
    { word: 'perspicuous', distinction: 'Perspicacious means having sharp mental insight; perspicuous means clearly expressed and easily understood.' }
  ],
  venal: [
    { word: 'venial', distinction: 'Venal means corrupt and open to bribery; venial means minor, pardonable, or excusable (as in a sin).' }
  ],
  tortuous: [
    { word: 'torturous', distinction: 'Tortuous means full of twists and turns; torturous means involving severe pain or suffering.' }
  ],
  disinterested: [
    { word: 'uninterested', distinction: 'Disinterested means unbiased and impartial; uninterested means bored or lacking interest.' }
  ],
  ingenious: [
    { word: 'ingenuous', distinction: 'Ingenious means clever, inventive, and brilliant; ingenuous means innocent, naive, and unsuspecting.' }
  ]
};

// Enrich existing words
const enrichedExisting = existingWords.map((item) => {
  const enriched = { ...item };
  if (!enriched.tags || enriched.tags.length === 0) {
    enriched.tags = [...(categoryDefaultTags[item.category] || ['vocabulary'])];
  }
  const lowerWord = item.word.toLowerCase();
  if (commonConfusions[lowerWord] && (!enriched.confusedWith || enriched.confusedWith.length === 0)) {
    enriched.confusedWith = commonConfusions[lowerWord];
  }
  return enriched;
});

// Process new words and assign IDs starting from 251
const allNewWords = [
  ...newAdvanced,
  ...newLiterary,
  ...newAcademic,
  ...newEloquence,
  ...newEveryday
];

let nextId = existingWords.length + 1;
const enrichedNewWords = allNewWords.map((item) => {
  const idStr = String(nextId++).padStart(3, '0');
  return {
    id: idStr,
    word: item.word.trim(),
    phonetic: item.phonetic.trim(),
    definition: item.definition.trim(),
    example: item.example.trim(),
    category: item.category.trim(),
    synonyms: item.synonyms || [],
    antonyms: item.antonyms || [],
    etymology: item.etymology || '',
    tags: item.tags && item.tags.length > 0 ? item.tags : categoryDefaultTags[item.category] || ['vocabulary'],
    ...(item.confusedWith ? { confusedWith: item.confusedWith } : {})
  };
});

const fullDataset = [...enrichedExisting, ...enrichedNewWords];

// Validation
console.log(`Total combined words: ${fullDataset.length}`);

if (fullDataset.length !== 500) {
  throw new Error(`Expected exactly 500 words, got ${fullDataset.length}`);
}

const seenWords = new Set();
const duplicateWords = [];
const catCounts = {};

for (const w of fullDataset) {
  const lower = w.word.toLowerCase();
  if (seenWords.has(lower)) {
    duplicateWords.push(lower);
  }
  seenWords.add(lower);

  catCounts[w.category] = (catCounts[w.category] || 0) + 1;

  if (!w.id || !w.word || !w.phonetic || !w.definition || !w.example || !w.category) {
    throw new Error(`Word item missing required field: ${JSON.stringify(w)}`);
  }
}

if (duplicateWords.length > 0) {
  throw new Error(`Duplicate words detected: ${duplicateWords.join(', ')}`);
}

console.log('Category distribution:', catCounts);

for (const [cat, count] of Object.entries(catCounts)) {
  if (count !== 100) {
    throw new Error(`Category ${cat} has ${count} words, expected 100.`);
  }
}

fs.writeFileSync(wordsJsonPath, JSON.stringify(fullDataset, null, 2) + '\n', 'utf8');
console.log(`Successfully written 500 words to ${wordsJsonPath}!`);
