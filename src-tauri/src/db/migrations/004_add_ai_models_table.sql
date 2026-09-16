-- AI Models table for Σόφια

-- AI Models table (already created in initial migration, this adds more details)
-- Adding additional columns for model management

ALTER TABLE ai_models ADD COLUMN huggingface_repo TEXT DEFAULT NULL;
ALTER TABLE ai_models ADD COLUMN huggingface_revision TEXT DEFAULT NULL;
ALTER TABLE ai_models ADD COLUMN tokenizer_path TEXT DEFAULT NULL;
ALTER TABLE ai_models ADD COLUMN config_path TEXT DEFAULT NULL;
ALTER TABLE ai_models ADD COLUMN min_ram_gb INTEGER DEFAULT 2;
ALTER TABLE ai_models ADD COLUMN recommended_ram_gb INTEGER DEFAULT 8;
ALTER TABLE ai_models ADD COLUMN supports_gpu BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_models ADD COLUMN supports_cpu BOOLEAN DEFAULT TRUE;
ALTER TABLE ai_models ADD COLUMN max_context_length INTEGER DEFAULT 4096;
ALTER TABLE ai_models ADD COLUMN sample_rate INTEGER DEFAULT 16000;
ALTER TABLE ai_models ADD COLUMN chunk_duration_seconds REAL DEFAULT 30.0;
ALTER TABLE ai_models ADD COLUMN overlap_duration_seconds REAL DEFAULT 2.0;

-- Default FunASR model for transcription
INSERT OR IGNORE INTO ai_models (
    id, name, model_type, source, model_id, local_path, size_bytes,
    quantization, languages, capabilities, config,
    is_active, is_downloaded, min_ram_gb, recommended_ram_gb,
    supports_gpu, supports_cpu, max_context_length,
    sample_rate, chunk_duration_seconds, overlap_duration_seconds,
    created_at, updated_at
) VALUES (
    'funasr-zh-en',
    'FunASR Chinese/English',
    'transcription',
    'local',
    'iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch',
    NULL,
    1200000000,
    'int8',
    '["zh", "en", "auto"]',
    '["transcription", "timestamps", "speaker_diarization", "punctuation"]',
    '{"vad_model": "iic/speech_fsmn_vad_zh-cn-16k-common-pytorch", "punc_model": "iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch", "spk_model": "iic/speech_campplus_sv_zh-cn_16k-common"}',
    TRUE, FALSE, 4, 8, TRUE, TRUE, 4096,
    16000, 30.0, 2.0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Default local LLM for analysis (using llama.cpp compatible models)
INSERT OR IGNORE INTO ai_models (
    id, name, model_type, source, model_id, local_path, size_bytes,
    quantization, languages, capabilities, config,
    is_active, is_downloaded, min_ram_gb, recommended_ram_gb,
    supports_gpu, supports_cpu, max_context_length,
    created_at, updated_at
) VALUES (
    'llama-3.2-3b-instruct-q4',
    'Llama 3.2 3B Instruct (Q4)',
    'analysis',
    'local',
    'bartowski/Llama-3.2-3B-Instruct-GGUF',
    NULL,
    2000000000,
    'Q4_K_M',
    '["en", "zh", "multilingual"]',
    '["text_analysis", "summarization", "correction", "translation", "extraction", "chat"]',
    '{"context_length": 8192, "n_gpu_layers": -1, "n_threads": 4, "batch_size": 512}',
    TRUE, FALSE, 4, 8, TRUE, TRUE, 8192,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO ai_models (
    id, name, model_type, source, model_id, local_path, size_bytes,
    quantization, languages, capabilities, config,
    is_active, is_downloaded, min_ram_gb, recommended_ram_gb,
    supports_gpu, supports_cpu, max_context_length,
    created_at, updated_at
) VALUES (
    'qwen2.5-7b-instruct-q4',
    'Qwen 2.5 7B Instruct (Q4)',
    'analysis',
    'local',
    'bartowski/Qwen2.5-7B-Instruct-GGUF',
    NULL,
    4500000000,
    'Q4_K_M',
    '["zh", "en", "multilingual"]',
    '["text_analysis", "summarization", "correction", "translation", "extraction", "chat", "coding"]',
    '{"context_length": 32768, "n_gpu_layers": -1, "n_threads": 4, "batch_size": 512}',
    TRUE, FALSE, 8, 16, TRUE, TRUE, 32768,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- OpenAI API model placeholder
INSERT OR IGNORE INTO ai_models (
    id, name, model_type, source, model_id, api_endpoint,
    languages, capabilities, config,
    is_active, is_downloaded, min_ram_gb, recommended_ram_gb,
    supports_gpu, supports_cpu, max_context_length,
    created_at, updated_at
) VALUES (
    'gpt-4o-mini',
    'GPT-4o Mini (OpenAI)',
    'chat',
    'api',
    'gpt-4o-mini',
    'https://api.openai.com/v1',
    '["multilingual"]',
    '["chat", "analysis", "summarization", "correction", "translation", "transcription"]',
    '{"temperature": 0.7, "max_tokens": 16384}',
    TRUE, TRUE, 0, 0, FALSE, TRUE, 128000,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO ai_models (
    id, name, model_type, source, model_id, api_endpoint,
    languages, capabilities, config,
    is_active, is_downloaded, min_ram_gb, recommended_ram_gb,
    supports_gpu, supports_cpu, max_context_length,
    created_at, updated_at
) VALUES (
    'whisper-1',
    'Whisper (OpenAI API)',
    'transcription',
    'api',
    'whisper-1',
    'https://api.openai.com/v1',
    '["multilingual"]',
    '["transcription", "translation"]',
    '{"temperature": 0.0, "response_format": "verbose_json"}',
    TRUE, TRUE, 0, 0, FALSE, TRUE, 0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);