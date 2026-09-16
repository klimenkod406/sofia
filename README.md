# Σόφια (Sofia) - Modern Note-Taking App

A beautiful, AI-powered note-taking application built with Tauri, React, and Rust. Features Markdown editing, calendar integration, AI transcription (FunASR for Chinese/English), and local LLM analysis.

## ✨ Features

### 📝 Notes & Editing
- **Rich Text Editor** - Tiptap-based WYSIWYG with Markdown support
- **Folder Organization** - Hierarchical folders with drag-and-drop
- **Tags & Filtering** - Flexible tagging system with color coding
- **Export/Import** - Markdown, HTML, PDF, JSON formats
- **Full-text Search** - SQLite FTS5 powered search
- **Version History** - Automatic note versioning

### 📅 Calendar
- **Multiple Views** - Month, Week, Day views
- **Event Management** - Recurring events, reminders, locations
- **Natural Language** - Create events with natural language input
- **Integration** - Link events to notes

### 🤖 AI Features
- **Transcription** - FunASR for Chinese/English (local + API)
- **Text Analysis** - Summarize, correct, improve, translate
- **Chat Assistant** - Overlay chat with context awareness
- **Local Models** - llama.cpp integration for privacy
- **API Support** - OpenAI, Anthropic, custom endpoints

### 🎨 Design
- **Apple-style UI** - Modern, clean, accessible
- **Dark/Light Themes** - System-aware with manual override
- **Teal-Green Accent** - Custom Sofia color palette
- **Glassmorphism** - Matte, semi-transparent elements
- **Responsive** - Works on laptops and desktops

### ⚡ Performance
- **SQLite** - Fast, local-first storage
- **Lazy Loading** - Code-split React components
- **Background Sync** - Non-blocking auto-save
- **Memory Efficient** - Optimized for low-end laptops

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, Radix UI, Lucide Icons |
| Editor | Tiptap (ProseMirror) |
| State | Zustand |
| Backend | Tauri 2, Rust |
| Database | SQLite (sqlx, rusqlite) |
| AI/ML | llama.cpp, FunASR, candle |
| Audio | symphonia, cpal, rubato |

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Rust 1.75+
- Tauri CLI (`cargo install tauri-cli`)
- Python 3.8+ (for FunASR)
- ffmpeg (for audio processing)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/sofia.git
cd sofia

# Install frontend dependencies
npm install

# Install Rust dependencies (auto on first build)
# Tauri handles this automatically

# Development
npm run dev

# Build for production
npm run build
```

### Development Commands

```bash
# Start dev server with hot reload
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format

# Tests
npm run test
npm run test:watch
npm run test:coverage

# Database
npm run db:generate
npm run db:migrate
npm run db:studio
```

## 📁 Project Structure

```
sofia/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # Base UI components
│   │   ├── editor/        # Editor-specific components
│   │   ├── calendar/      # Calendar components
│   │   ├── home/          # Home page components
│   │   ├── ai/            # AI chat components
│   │   └── settings/      # Settings components
│   ├── pages/             # Page components
│   ├── stores/            # Zustand stores
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Utility functions
│   ├── styles/            # Global styles
│   ├── types/             # TypeScript types
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── src-tauri/              # Backend (Rust)
│   ├── src/
│   │   ├── commands/      # Tauri command handlers
│   │   ├── db/            # Database layer
│   │   │   ├── models.rs  # Data models
│   │   │   ├── repository/ # Repository pattern
│   │   │   └── migrations/ # SQL migrations
│   │   ├── services/      # Business logic
│   │   ├── ai/            # AI integration
│   │   │   ├── transcription.rs
│   │   │   ├── analysis.rs
│   │   │   ├── models.rs
│   │   │   ├── funasr.rs
│   │   │   └── llama_cpp.rs
│   │   ├── utils/         # Utility functions
│   │   └── main.rs        # Application entry
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── public/                 # Static assets
├── package.json            # Frontend dependencies
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite config
├── tailwind.config.js      # Tailwind config
└── README.md
```

## 🔧 Configuration

### Tauri Config (`src-tauri/tauri.conf.json`)
- Window settings (size, transparency, titlebar)
- Security CSP
- Bundle targets (Windows, macOS, Linux)
- Plugin configuration

### Environment Variables
Create `.env` file:
```env
# Optional: API keys for cloud AI
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Custom model paths
FUNASR_MODEL_DIR=/path/to/models
GGUF_MODEL_DIR=/path/to/gguf
```

## 🎯 Key Implementation Details

### Database Schema
- **Notes** - Full-text search via FTS5
- **Folders** - Hierarchical with recursive CTEs
- **Events** - Calendar with recurrence rules
- **AI Models** - Local/API with download tracking
- **Chat** - Sessions with message history
- **Reminders** - Background notification system

### AI Architecture
```
TranscriptionEngine
├── FunASRTranscriber (primary for zh/en)
├── WhisperCppTranscriber (fallback)
└── APITranscriber (OpenAI Whisper)

AnalysisEngine
├── LlamaCppEngine (local LLMs)
└── APIEngine (OpenAI, Anthropic)

ModelManager
├── Download (HuggingFace, ModelScope)
├── API Key Management (encrypted)
└── Hardware Detection (GPU/CPU)
```

### Performance Optimizations
- **Virtualized Lists** - For large note collections
- **Debounced Auto-save** - 2s default, configurable
- **Lazy Route Loading** - React.lazy + Suspense
- **SQLite Indexes** - Optimized query performance
- **Background Workers** - Heavy operations off main thread

## 📦 Building for Production

### Windows (NSIS/MSIX)
```bash
npm run build
# Output: src-tauri/target/release/bundle/nsis/
```

### macOS (DMG/AppImage)
```bash
npm run build
# Output: src-tauri/target/release/bundle/dmg/
```

### Linux (AppImage/Deb)
```bash
npm run build
# Output: src-tauri/target/release/bundle/appimage/
```

## 🧪 Testing

```bash
# Unit tests (Rust)
cargo test --package sofia

# Frontend tests
npm run test

# E2E tests
npm run test:e2e
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) - Desktop app framework
- [Tiptap](https://tiptap.dev/) - Headless editor
- [FunASR](https://github.com/alibaba-damo-academy/FunASR) - Speech recognition
- [llama.cpp](https://github.com/ggerganov/llama.cpp) - Local LLM inference
- [Radix UI](https://www.radix-ui.com/) - Accessible components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS

---

**Σόφια** - Wisdom in every note. 📖✨