# Development Guide

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start development
npm run dev
```

## Architecture Overview

### Frontend (React + TypeScript)
- **State Management**: Zustand stores in `src/stores/`
- **Components**: Atomic design in `src/components/`
- **Pages**: Route-level components in `src/pages/`
- **Hooks**: Custom hooks in `src/hooks/`
- **Types**: Shared types in `src/types/`

### Backend (Rust + Tauri)
- **Commands**: Tauri invoke handlers in `src-tauri/src/commands/`
- **Database**: SQLite with sqlx/rusqlite in `src-tauri/src/db/`
- **Services**: Business logic in `src-tauri/src/services/`
- **AI**: Transcription/Analysis in `src-tauri/src/ai/`

## Adding New Features

### 1. New Database Table
1. Create migration in `src-tauri/src/db/migrations/`
2. Add model in `src-tauri/src/db/models.rs`
3. Create repository in `src-tauri/src/db/repository/`
4. Register in `src-tauri/src/db/mod.rs`

### 2. New Tauri Command
1. Add command in `src-tauri/src/commands/`
2. Export in `src-tauri/src/commands/mod.rs`
3. Register in `src-tauri/src/main.rs` invoke_handler

### 3. New Frontend Feature
1. Add types in `src/types/index.ts`
2. Create store in `src/stores/`
3. Build components in `src/components/`
4. Create page in `src/pages/`
5. Add route in `src/App.tsx`

## Database Migrations

```bash
# Generate new migration
npm run db:generate

# Apply migrations
npm run db:migrate

# Open Drizzle Studio
npm run db:studio
```

## AI Model Integration

### Adding a Local Model
1. Add model entry to `ai_models` table via migration
2. Implement downloader in `ModelManager`
3. Add engine support in `TranscriptionEngine` or `AnalysisEngine`

### Adding an API Model
1. Add model entry with `source = 'api'`
2. Implement API client in respective engine
3. Add API key management in settings

## Testing

```bash
# Frontend unit tests
npm run test

# Backend unit tests
cd src-tauri && cargo test

# E2E tests
npm run test:e2e
```

## Building

```bash
# Development build
npm run build:dev

# Production build
npm run build

# Create installer
# Windows: creates NSIS installer
# macOS: creates DMG
# Linux: creates AppImage
```

## Debugging

### Frontend
- Open DevTools in Tauri window (Ctrl+Shift+I)
- React DevTools available

### Backend
- Use `println!` or `tracing::info!` 
- Check `src-tauri/target/debug/` for binary
- Attach debugger to Tauri process

### Database
```bash
# Open SQLite database
sqlite3 src-tauri/sofia.db

# Or use Drizzle Studio
npm run db:studio
```

## Performance Tips

1. **Lazy Load Routes** - Use `React.lazy` + `Suspense`
2. **Virtualize Lists** - For large datasets
3. **Debounce Inputs** - Use `useDebounce` hook
4. **Memoize Components** - `React.memo`, `useMemo`, `useCallback`
5. **Index Database** - Add indexes for common queries
5. **Batch Operations** - Use transactions for bulk writes

## Common Issues

### "Command not found: tauri"
```bash
cargo install tauri-cli
```

### "Python not found" (FunASR)
```bash
# Install Python 3.8+ and add to PATH
```

### "Database locked"
- Ensure only one Tauri instance runs
- Check for unclosed connections

### "Model download failed"
- Check internet connection
- Verify HuggingFace/ModelScope access
- Check disk space

## Useful Commands

```bash
# Format code
npm run format

# Lint
npm run lint:fix

# Type check
npm run typecheck

# Clean build
rm -rf node_modules dist src-tauri/target && npm install && npm run build
```