-- Clear the seeded AI model settings that pretended models were configured.
-- Nothing is installed or connected until the user downloads local weights or
-- adds an API key, so the stored defaults must not claim otherwise
-- (migration 001 seeded 'funasr' / 'local' / 'openai').
UPDATE settings SET value = '', updated_at = CURRENT_TIMESTAMP
WHERE key IN ('transcription_model', 'analysis_model', 'api_provider')
  AND value != '';
