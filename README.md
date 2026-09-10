# WordQuill

WordQuill is an offline-first vocabulary learning Progressive Web App (PWA) designed for focused language mastery without accounts, ads, or telemetry.

<!-- TODO: add screenshot -->

## Features

- **Flashcard Study**: Interactive flashcards with phonetic IPA notations, definitions, contextual example sentences, synonyms, and mnemonics.
- **SM-2 Spaced Repetition**: Intelligent review scheduling using the SuperMemo SM-2 algorithm to optimize retention intervals.
- **Multiple Quiz Modes**: Test recall with definition matching, fill-in-the-blank sentences, synonyms, and reverse quizzes.
- **Pronunciation Support**: Built-in speech pronunciation using the browser's native Web Speech API with configurable speech rates.
- **Progress Tracking & Streaks**: Visual activity heatmaps, daily streak tracking, streak freeze safeguards, and leech identification for difficult words.
- **Custom Vocabulary**: Add personal words and custom notes directly into your study deck.
- **100% Local Storage**: All study data, custom words, review schedules, and preferences are stored locally in your browser via IndexedDB. No backend servers, accounts, or trackers.
- **PWA & Offline-First**: Installable to desktop or mobile home screens with full offline capability powered by service worker caching.

## Tech Stack

- **React 19** (`react`, `react-dom`)
- **Vite 6** (`vite`, `@vitejs/plugin-react`)
- **TypeScript**
- **Tailwind CSS v4** (`@tailwindcss/vite`, `tailwindcss`)
- **Dexie.js** (`dexie`, `dexie-react-hooks`) for client-side IndexedDB management
- **vite-plugin-pwa** for service worker generation, offline caching, and PWA manifest
- **lucide-react** for UI icons

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

### Installation

```bash
# Clone the repository and install dependencies
npm install
```

### Development

```bash
# Start the local development server (binds to port 3000)
npm run dev
```

Open `http://localhost:3000` in your browser.

### Building for Production

```bash
# Build the production-ready PWA bundle
npm run build

# Preview the production build locally
npm run preview
```

### Type Checking / Linting

```bash
# Run TypeScript compilation check
npm run lint
```

## Data Privacy & Backup

All your progress — review intervals, quiz history, custom words, and streak records — lives strictly inside your browser's IndexedDB storage. WordQuill does not transmit your data to any remote server or third-party analytics service.

Because your data is stored locally in the browser:
- Clearing your browser cache or using Incognito/Private mode may reset your records.
- To safeguard your learning history, export a JSON backup file periodically from the **Progress Dashboard** or **Settings**.
- You can restore your backup at any time from the Onboarding screen or Settings panel.

## License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.
