<div align="center">

<img src="public/favicon.svg" width="84" height="84" alt="Sofia logo" />

# Σόφια · Sofia

**A local-first desktop note-taking app with AI transcription, a built-in calendar, and full-text search.**

Everything stays on your machine. No accounts, no cloud, no telemetry.

[![CI](https://github.com/klimenkod406/sofia/actions/workflows/ci.yml/badge.svg)](https://github.com/klimenkod406/sofia/actions/workflows/ci.yml)
[![version](https://img.shields.io/badge/version-0.2.1-00BFA6?style=flat-square)](https://github.com/klimenkod406/sofia/releases)
[![license](https://img.shields.io/badge/license-MIT-teal?style=flat-square)](LICENSE)

[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-2021-DEA584?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![SQLite](https://img.shields.io/badge/SQLite-FTS5-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

[Русский](README.md) · [Releases](https://github.com/klimenkod406/sofia/releases) · [Report an issue](https://github.com/klimenkod406/sofia/issues)

</div>

---

## 📸 Screenshots

### Home — folders and notes

A grid of notes and folders with global search, sorting, and quick access to the calendar, archive, and a new note.

![Home](docs/screenshots/home.png)

### Editor

A WYSIWYG editor built on Tiptap: headings, lists, tasks, tables, syntax-highlighted code, quotes, alignment, and text highlighting. Formatting panels are pinned to both sides of the canvas, with a word counter and stats at the bottom.

![Note editor](docs/screenshots/editor.png)

### Calendar — month

Monthly view with a mini-calendar, an event legend, a reminders sidebar, and an upcoming-events list. Creating an event, linking it to a note, and setting recurrence take a couple of clicks.

![Calendar — month](docs/screenshots/calendar-month.png)

### Calendar — week

A weekly grid with an hourly timeline: overlapping events are visible at a glance, and the view scrolls vertically through the day.

![Calendar — week](docs/screenshots/calendar-week.png)

### Calendar — day

The day view adds a summary panel: what was created, what changed, and which reminders are scheduled. Full keyboard navigation.

![Calendar — day](docs/screenshots/calendar-day.png)

### Archive

Archived notes live separately from the main list and return with a single right-click.

![Archive](docs/screenshots/archive.png)

### Settings

Appearance, interface language, editor fonts, calendar behaviour, and advanced options — all in one place.

![Settings](docs/screenshots/settings.png)

---

## ✨ Features

### 📝 Notes and editing

- **WYSIWYG editor** powered by Tiptap (ProseMirror) with Markdown support
- **Folders** — hierarchical, with drag-and-drop and note reordering
- **Tags** — colour coding and filtering
- **Full-text search** — SQLite FTS5 with match highlighting
- **Export** — Markdown, HTML, PDF, JSON, Plain Text
- **Import** — load a note from a file
- **Archive** — soft delete with instant restore
- **Duplicate and pin** — quick actions straight from the note card
- **Version history** — every note change is saved automatically (last 50)

### 📅 Calendar

- **Three views** — month, week, and day
- **Events** — recurrence, locations, duration, and links to notes
- **Reminders** — attached to notes, with an overdue flag and snooze, plus a badge counter in the header
- **Day digest** — created and edited notes next to the agenda

### 🤖 AI

- **Transcription** — speech recognition from audio and video
- **Live transcription** — streaming mode, text appears as you record
- **Text analysis** — summarise, correct, improve, translate, extract key points, generate tags
- **Chat assistant** — a dedicated screen with context from the current note
- **Local models** — GGUF via llama.cpp, nothing leaves your machine
- **Cloud APIs** — OpenAI, Anthropic, and any compatible endpoint
- **Model manager** — downloads with progress, hardware detection, model recommendations for CPU/GPU

### 🎨 Interface

- **Dark and light themes** — follow the system or set it manually
- **Languages** — Russian, English, Spanish, French, German
- **Typography** — font family, size, and line height
- **Custom title bar** — frameless macOS-style window with a tray icon and global shortcuts
- **Responsive layout** — from 1024×700 up to ultrawide displays

### ⚡ Performance

- **Local storage** — SQLite; your data never leaves the device
- **Lazy loading** — pages are code-split and loaded on demand via `React.lazy`
- **Auto-save** — configurable interval, written asynchronously so the UI never blocks
- **Database indexes** — optimised queries across notes, tags, and calendar events
- **Background work** — heavy tasks run off the main thread

---

## 🛠 Tech Stack

| Layer | Technologies |
|-------|--------------|
| Shell | Tauri 2 (Rust) — a lightweight desktop runtime |
| Frontend | React 18, TypeScript 5.6, Vite 5 |
| UI | Tailwind CSS 3.4, Radix UI, Lucide Icons |
| Editor | Tiptap (ProseMirror), tiptap-markdown, lowlight |
| State | Zustand, TanStack Query |
| Database | SQLite (tauri-plugin-sql, sqlx), FTS5, Drizzle ORM |
| AI/ML | llama.cpp (GGUF), FunASR, Whisper.cpp — external processes, with no ML libraries linked into the app |
| Testing | Vitest, cargo test |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+
- **Rust** 1.75+
- **Tauri CLI** — `cargo install tauri-cli`
- **Python** 3.8+ — for FunASR (optional)
- **whisper-cli / llama-cli** — from the respective projects, if you want local models

### Installation

```bash
git clone https://github.com/klimenkod406/sofia.git
cd sofia

npm install          # frontend dependencies
npm run tauri:dev    # run the app with hot reload
```

### Development commands

```bash
npm run dev          # Vite dev server only (port 1420)
npm run tauri:dev    # the full application
npm run tauri:build  # production build with installers

npm run typecheck    # type checking
npm run lint         # ESLint
npm run lint:fix     # ESLint with autofix
npm run format       # Prettier
npm run format:check # formatting check

npm run test         # frontend unit tests
npm run test:watch   # tests in watch mode
npm run test:coverage

npm run db:generate  # generate migrations
npm run db:migrate   # apply migrations
npm run db:studio    # Drizzle Studio
```

---

## 📁 Project Structure

```
sofia/
├── src/                        # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── ui/                 # Base UI primitives
│   │   ├── home/               # Home page
│   │   ├── editor/             # Editor and formatting panels
│   │   ├── calendar/           # Calendar
│   │   ├── ai/                 # AI chat and analysis widgets
│   │   └── settings/           # Settings
│   ├── pages/                  # home, editor, calendar, archive, settings, ai-chat
│   ├── stores/                 # Zustand stores (notes, calendar, ai, settings, i18n)
│   ├── hooks/                  # Reusable hooks
│   ├── lib/                    # Localization (i18n)
│   ├── styles/                 # Global styles and themes
│   ├── types/                  # Shared types
│   ├── App.tsx                 # Routes and layout
│   └── main.tsx                # Entry point
├── src-tauri/                  # Backend (Rust)
│   └── src/
│       ├── commands/           # Tauri commands (notes, folders, tags, calendar, ai, files)
│       ├── db/
│       │   ├── models.rs       # Data models
│       │   ├── repository/     # Repository pattern
│       │   └── migrations/     # SQL migrations
│       ├── services/           # Business logic (export, backup, file_ops)
│       ├── ai/
│       │   ├── transcription.rs # Transcription
│       │   ├── live.rs          # Streaming transcription
│       │   ├── analysis.rs      # Text analysis
│       │   ├── llama_cpp.rs     # Local LLMs
│       │   ├── funasr.rs        # FunASR
│       │   └── models.rs        # Model manager
│       └── main.rs
├── docs/screenshots/           # README screenshots
├── public/                     # Static assets (favicon, intro)
└── package.json
```

---

## ⚙️ Configuration

### Environment variables

Create a `.env` file in the project root:

```env
# Cloud AI providers (optional)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Custom OpenAI-compatible endpoint
OPENAI_BASE_URL=https://your-endpoint/v1

# Local model paths (optional)
FUNASR_MODEL_DIR=/path/to/models
GGUF_MODEL_DIR=/path/to/gguf
```

### Theme and language

Switch the theme (light / dark / system) and the interface language in the app: **Settings → Appearance**. The choice is stored locally.

---

## 🧠 AI Architecture

```
TranscriptionEngine
├── WhisperCppTranscriber — the whisper-cli binary
├── FunASRTranscriber     — a Python process running FunASR
└── Backend::Api          — cloud providers

LiveTranscriptionManager   — streams chunks and decodes them

AnalysisEngine
├── LlamaCppEngine     — local GGUF models (llama-cli / llama-server)
└── APIEngine          — OpenAI, Anthropic, compatible endpoints

ModelManager
├── Model downloads (HuggingFace, ModelScope) with progress
├── API key management
└── Hardware detection (GPU / CPU) and model selection
```

The backend is picked from the model's `backend` field: FunASR for Chinese and English, Whisper.cpp for other languages, API for cloud providers. Local engines run as **child processes**, so ML libraries are never linked into the GUI process.

---

## 🧪 Testing & CI

```bash
npm run test                 # frontend
cd src-tauri && cargo test  # backend
```

GitHub Actions runs the linter, type check, formatting check, frontend and backend unit tests, `cargo fmt`, `cargo clippy`, and builds the application on **Ubuntu, Windows, and macOS**.

---

## 📦 Building

```bash
npm run tauri:build
```

Installers land in `src-tauri/target/release/bundle/`:

| Platform | Format |
|----------|--------|
| Windows | NSIS `.exe`, MSI |
| macOS | `.app`, `.dmg` |
| Linux | AppImage, `.deb` |

---

## 🤝 Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

Before submitting, make sure `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm run test` all pass.

---

## 📄 License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

**Σόφια** — wisdom in every note. 📖✨

</div>
