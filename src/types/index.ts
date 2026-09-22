// Type definitions for Σόφια

export interface Note {
  id: string;
  folder_id: string | null;
  title: string;
  content: string;
  content_md: string;
  content_html: string;
  excerpt: string;
  word_count: number;
  char_count: number;
  reading_time: number;
  is_pinned: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  is_favorite: boolean;
  cover_image: string | null;
  cover_color: string | null;
  template_id: string | null;
  tags?: Tag[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  last_edited_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  color: string;
  icon: string;
  sort_order: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface FolderTree extends Folder {
  children: FolderTree[];
  note_count: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
  is_system: boolean;
  parent_id: string | null;
  usage_count: number;
  created_at: string;
}

export interface NoteWithRelations {
  note: Note;
  folder: Folder | null;
  tags: Tag[];
  attachments: Attachment[];
}

export interface Event {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  location: string;
  color: string;
  calendar_id: string;
  recurrence_rule: string | null;
  recurrence_exception: string | null;
  reminder_minutes: number;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventWithReminder {
  event: Event;
  reminder: Reminder | null;
}

export interface Reminder {
  id: string;
  target_type: 'event' | 'note';
  target_id: string;
  title: string;
  message: string;
  trigger_at: string;
  is_sent: boolean;
  is_dismissed: boolean;
  repeat_rule: string | null;
  sound: string;
  vibration: boolean;
  priority: number;
  snooze_minutes: number;
  max_snooze_count: number;
  snooze_count: number;
  action_url: string | null;
  metadata: string;
  created_at: string;
}

export interface AIModel {
  id: string;
  name: string;
  model_type: 'transcription' | 'analysis' | 'chat' | 'embedding';
  source: 'local' | 'api' | 'huggingface';
  model_id: string | null;
  api_endpoint: string | null;
  api_key_encrypted: string | null;
  local_path: string | null;
  huggingface_repo: string | null;
  huggingface_revision: string | null;
  tokenizer_path: string | null;
  config_path: string | null;
  size_bytes: number;
  quantization: string | null;
  languages: string;
  capabilities: string;
  config: string;
  min_ram_gb: number;
  recommended_ram_gb: number;
  supports_gpu: boolean;
  supports_cpu: boolean;
  max_context_length: number;
  sample_rate: number;
  chunk_duration_seconds: number;
  overlap_duration_seconds: number;
  is_active: boolean;
  is_downloaded: boolean;
  download_progress: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIChat {
  id: string;
  note_id: string | null;
  title: string;
  model_id: string | null;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  chat_id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls: string | null;
  tool_call_id: string | null;
  tokens_used: number;
  created_at: string;
}

export interface TranscriptionJob {
  id: string;
  audio_path: string;
  model_id: string | null;
  language: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  result_text: string;
  result_segments: string;
  error_message: string | null;
  duration_seconds: number;
  created_at: string;
  completed_at: string | null;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker: string | null;
  confidence: number;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  duration: number;
  language: string;
}

export interface AnalysisType {
  type:
    | 'summarize'
    | 'correct'
    | 'improve'
    | 'translate'
    | 'extract_key_points'
    | 'extract_action_items'
    | 'analyze_sentiment'
    | 'generate_tags'
    | 'custom';
  target_language?: string;
  prompt?: string;
}

export interface AnalysisResult {
  result: string;
  metadata: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ChatOptions {
  temperature: number;
  max_tokens: number;
  top_p: number;
  stream: boolean;
}

export interface ChatCompletion {
  message: ChatMessage;
  tokens_used: number;
  model: string;
}

export interface Attachment {
  id: string;
  note_id: string | null;
  file_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  thumbnail_path: string | null;
  created_at: string;
}

export interface Settings {
  theme: 'light' | 'dark';
  font_family: string;
  font_size: number;
  line_height: number;
  editor_mode: 'wysiwyg' | 'markdown';
  auto_save: boolean;
  auto_save_interval: number;
  spell_check: boolean;
  show_line_numbers: boolean;
  vim_mode: boolean;
  transcription_language: string;
  transcription_model: string;
  analysis_model: string;
  api_provider: string;
  sidebar_collapsed: boolean;
  editor_layout: 'single' | 'split' | 'triple';
  show_word_count: boolean;
  show_reading_time: boolean;
}

export interface FontSettings {
  family: string;
  size: number;
  lineHeight: number;
}

export interface EditorSettings {
  mode: 'wysiwyg' | 'markdown';
  autoSave: boolean;
  autoSaveInterval: number;
  spellCheck: boolean;
  showLineNumbers: boolean;
  vimMode: boolean;
}

export interface AISettings {
  transcriptionLanguage: string;
  transcriptionModel: string;
  analysisModel: string;
  apiProvider: string;
}

export interface UIPreferences {
  sidebarCollapsed: boolean;
  editorLayout: 'single' | 'split' | 'triple';
  showWordCount: boolean;
  showReadingTime: boolean;
}

export interface SearchResult {
  id: string;
  type: 'note' | 'event' | 'folder';
  title: string;
  excerpt: string;
  highlight: string;
  score: number;
  created_at: string;
  updated_at: string;
}

export interface Statistics {
  total_notes: number;
  total_folders: number;
  total_words: number;
  total_characters: number;
  total_events: number;
  total_tags: number;
  notes_this_week: number;
  notes_this_month: number;
  average_note_length: number;
  most_used_tags: [string, number][];
  notes_by_folder: Record<string, number>;
}

export interface ExportFormat {
  format: 'markdown' | 'html' | 'pdf' | 'json' | 'plaintext';
}

export interface ImportFormat {
  format: 'markdown' | 'html' | 'plaintext' | 'json';
}

export interface BackupMetadata {
  version: string;
  created_at: string;
  note_count: number;
  folder_count: number;
  event_count: number;
  tag_count: number;
  size_bytes: number;
}

export interface ImportResult {
  success: boolean;
  imported_count: number;
  failed_count: number;
  errors: string[];
  notes: Note[];
}

export interface ModelInfo {
  model: AIModel;
  files_exist: boolean;
  estimated_load_time_ms: number;
}

export interface DownloadState {
  model_id: string;
  progress: number;
  status: 'pending' | 'downloading' | 'verifying' | 'completed' | 'failed' | 'cancelled';
  error: string | null;
  bytes_downloaded: number;
  total_bytes: number;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string | null;
}

export interface DiskUsage {
  total_size: number;
  file_count: number;
  notes_size: number;
  attachments_size: number;
  models_size: number;
  backups_size: number;
}

export interface SystemInfo {
  os: string;
  os_version: string;
  kernel_version: string;
  host_name: string;
  total_memory: number;
  used_memory: number;
  available_memory: number;
  cpu_count: number;
  cpu_usage: number;
  total_disk_space: number;
  available_disk_space: number;
  total_network_received: number;
  total_network_transmitted: number;
}

export interface UpdateInfo {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  release_notes: string;
  download_url: string;
}

export interface AppInfo {
  name: string;
  version: string;
  authors: string[];
  description: string;
  homepage: string;
  license: string;
}

// ---- Live transcription -------------------------------------------------

export interface DeviceProfile {
  total_ram_gb: number;
  available_ram_gb: number;
  cpu_count: number;
  gpu_accelerated: boolean;
  os: string;
}

export interface ModelRecommendation {
  model_id: string;
  model_name: string;
  reason: string;
  is_downloaded: boolean;
  fits_ram: boolean;
  estimated_realtime_factor: number;
}

export interface LiveSegment {
  session_id: string;
  paragraph_id: number;
  speaker: string | null;
  language: string;
  text: string;
  start: number;
  end: number;
  is_final: boolean;
}

export interface LivePartial {
  session_id: string;
  text: string;
  duration_seconds: number;
  language: string;
}

export interface LiveStatus {
  session_id: string;
  state: 'recording' | 'processing' | 'stopped' | 'error';
  partial_text: string;
  duration_seconds: number;
  model_id: string;
  language: string;
  error: string | null;
}

export interface LiveOptions {
  language: string;
  break_on_silence: boolean;
  silence_break_seconds: number;
  break_on_speaker: boolean;
  sentence_break_gap_seconds: number;
  max_paragraph_chars: number;
}

export interface LiveTranscriptionResult {
  session_id: string;
  text: string;
  paragraphs: LiveSegment[];
  duration_seconds: number;
  language: string;
}
