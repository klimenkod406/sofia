-- Local whisper.cpp transcription models for live, on-device transcription.
--
-- Model sizes / RAM / real-time factors are the whisper.cpp (GGML) figures:
--   tiny  39M   75 MB   ~1 GB RAM   RTF ~0.15
--   base  74M  142 MB   ~1 GB RAM   RTF ~0.30
--   small 244M 466 MB   ~2 GB RAM   RTF ~0.60
--   medium 769M 1.5 GB  ~5 GB RAM   RTF ~1.20  (borderline realtime on CPU)
--   large-v3 1550M 2.9 GB ~10 GB RAM RTF ~2.5
--   large-v3-turbo 809M 1.6 GB ~6 GB RAM RTF ~1.4
--
-- All multilingual (zh/en/ja/ko/…). For Chinese the extremely accurate option is
-- FunASR (seeded in 004); these whisper models are the laptop-friendly,
-- Python-free fallback that scales with available RAM.
--
-- `source='local'` + `huggingface_repo='ggerganov/whisper.cpp'` routes downloads
-- through the existing HuggingFace GGUF/GGML path in `ModelManager`.

INSERT OR IGNORE INTO ai_models (
    id, name, model_type, source, model_id, huggingface_repo, local_path, size_bytes,
    quantization, languages, capabilities, config,
    is_active, is_downloaded, min_ram_gb, recommended_ram_gb,
    supports_gpu, supports_cpu, max_context_length,
    sample_rate, chunk_duration_seconds, overlap_duration_seconds,
    created_at, updated_at
) VALUES
('whisper-tiny',
 'Whisper Tiny (local, multilingual)',
 'transcription', 'local', 'ggml-tiny.bin', 'ggerganov/whisper.cpp', NULL,
 75000000, 'f32',
 '["zh","en","ja","ko","ru","de","fr","es","auto","multilingual"]',
 '["transcription","timestamps","translation"]',
 '{"backend":"whisper_cpp","n_threads":4,"beam_size":1,"rft_cpu":0.15}',
 TRUE, FALSE, 1, 2, FALSE, TRUE, 0, 16000, 30.0, 2.0,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('whisper-base',
 'Whisper Base (local, multilingual)',
 'transcription', 'local', 'ggml-base.bin', 'ggerganov/whisper.cpp', NULL,
 142000000, 'f32',
 '["zh","en","ja","ko","ru","de","fr","es","auto","multilingual"]',
 '["transcription","timestamps","translation"]',
 '{"backend":"whisper_cpp","n_threads":4,"beam_size":1,"rft_cpu":0.3}',
 TRUE, FALSE, 1, 2, FALSE, TRUE, 0, 16000, 30.0, 2.0,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('whisper-small',
 'Whisper Small (local, multilingual)',
 'transcription', 'local', 'ggml-small.bin', 'ggerganov/whisper.cpp', NULL,
 466000000, 'f32',
 '["zh","en","ja","ko","ru","de","fr","es","auto","multilingual"]',
 '["transcription","timestamps","translation"]',
 '{"backend":"whisper_cpp","n_threads":4,"beam_size":1,"rft_cpu":0.6}',
 TRUE, FALSE, 2, 4, FALSE, TRUE, 0, 16000, 30.0, 2.0,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('whisper-medium',
 'Whisper Medium (local, multilingual)',
 'transcription', 'local', 'ggml-medium.bin', 'ggerganov/whisper.cpp', NULL,
 1500000000, 'f16',
 '["zh","en","ja","ko","ru","de","fr","es","auto","multilingual"]',
 '["transcription","timestamps","translation"]',
 '{"backend":"whisper_cpp","n_threads":4,"beam_size":2,"rft_cpu":1.2}',
 TRUE, FALSE, 4, 8, FALSE, TRUE, 0, 16000, 30.0, 2.0,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('whisper-large-v3-turbo',
 'Whisper Large v3 Turbo (local, multilingual)',
 'transcription', 'local', 'ggml-large-v3-turbo.bin', 'ggerganov/whisper.cpp', NULL,
 1600000000, 'f16',
 '["zh","en","ja","ko","ru","de","fr","es","auto","multilingual"]',
 '["transcription","timestamps","translation"]',
 '{"backend":"whisper_cpp","n_threads":4,"beam_size":2,"rft_cpu":1.4}',
 TRUE, FALSE, 4, 8, FALSE, TRUE, 0, 16000, 30.0, 2.0,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('whisper-large-v3',
 'Whisper Large v3 (local, multilingual)',
 'transcription', 'local', 'ggml-large-v3.bin', 'ggerganov/whisper.cpp', NULL,
 2900000000, 'f16',
 '["zh","en","ja","ko","ru","de","fr","es","auto","multilingual"]',
 '["transcription","timestamps","translation"]',
 '{"backend":"whisper_cpp","n_threads":4,"beam_size":5,"rft_cpu":2.5}',
 FALSE, FALSE, 8, 12, FALSE, TRUE, 0, 16000, 30.0, 2.0,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);