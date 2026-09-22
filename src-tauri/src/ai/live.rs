//! Live (streaming) transcription session manager.
//!
//! The frontend captures microphone audio as 16 kHz mono 16-bit PCM, splits it
//! into short chunks and pushes them here via Tauri commands. A per-session
//! worker accumulates the PCM and, on a fixed cadence, re-decodes the growing
//! buffer through the model's backend (`TranscriptionEngine::transcribe_with_model`).
//! Segments far enough from the live tail (`STABLE_LOOKBACK_SECS`) are treated
//! as *final* — they will not change on the next decode — grouped into logical
//! paragraphs and emitted as `segment` events. The unstable tail is emitted as
//! a `partial` event so the UI can show interim text without committing it.
//!
//! Re-decoding the full buffer is simple and correct (whisper.cpp is
//! deterministic for identical input); a production build would swap this for a
//! persistent streaming ASR process, but the event contract is unchanged.

use crate::ai::segmentation::{split_into_paragraphs, SegmentationOptions};
use crate::ai::transcription::{TranscriptionEngine, TranscriptionResult};
use crate::db::models::AIModel;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, oneshot, RwLock};

pub const EVT_SEGMENT: &str = "live-transcription://segment";
pub const EVT_PARTIAL: &str = "live-transcription://partial";
pub const EVT_STATUS: &str = "live-transcription://status";

const DECODE_INTERVAL_MS: u64 = 1200;
const MIN_AUDIO_SECS: f32 = 1.0;
const STABLE_LOOKBACK_SECS: f32 = 1.5;

/// A finalized logical paragraph ready to insert into the note.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveSegment {
    pub session_id: String,
    pub paragraph_id: u64,
    pub speaker: Option<String>,
    pub language: String,
    pub text: String,
    pub start: f32,
    pub end: f32,
    pub is_final: bool,
}

/// Interim (unstable) transcription text for the live UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LivePartial {
    pub session_id: String,
    pub text: String,
    pub duration_seconds: f32,
    pub language: String,
}

/// Session lifecycle status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveStatus {
    pub session_id: String,
    pub state: String, // recording | processing | stopped | error
    pub partial_text: String,
    pub duration_seconds: f32,
    pub model_id: String,
    pub language: String,
    pub error: Option<String>,
}

/// User controls for a live session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveOptions {
    pub language: String,
    pub break_on_silence: bool,
    pub silence_break_seconds: f32,
    pub break_on_speaker: bool,
    pub sentence_break_gap_seconds: f32,
    pub max_paragraph_chars: usize,
}

impl Default for LiveOptions {
    fn default() -> Self {
        Self {
            language: "auto".to_string(),
            break_on_silence: true,
            silence_break_seconds: 1.5,
            break_on_speaker: true,
            sentence_break_gap_seconds: 0.4,
            max_paragraph_chars: 600,
        }
    }
}

/// The complete transcript accumulated over the session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveTranscriptionResult {
    pub session_id: String,
    pub text: String,
    pub paragraphs: Vec<LiveSegment>,
    pub duration_seconds: f32,
    pub language: String,
}

struct SessionHandle {
    chunk_tx: mpsc::Sender<Vec<u8>>,
    result_rx: oneshot::Receiver<Result<LiveTranscriptionResult, String>>,
}

pub struct LiveTranscriptionManager {
    engine: Arc<TranscriptionEngine>,
    sessions: Arc<RwLock<HashMap<String, SessionHandle>>>,
}

impl LiveTranscriptionManager {
    pub fn new(engine: Arc<TranscriptionEngine>) -> Self {
        Self {
            engine,
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn start(
        &self,
        app: AppHandle,
        model: AIModel,
        options: LiveOptions,
    ) -> Result<String> {
        let session_id = uuid::Uuid::new_v4().to_string();
        let (chunk_tx, chunk_rx) = mpsc::channel::<Vec<u8>>(512);
        let (result_tx, result_rx) = oneshot::channel();

        let _ = app.emit(
            EVT_STATUS,
            LiveStatus {
                session_id: session_id.clone(),
                state: "recording".to_string(),
                partial_text: String::new(),
                duration_seconds: 0.0,
                model_id: model.id.clone(),
                language: options.language.clone(),
                error: None,
            },
        );

        let engine = self.engine.clone();
        tokio::spawn(run_session(
            app,
            engine,
            model,
            options,
            session_id.clone(),
            result_tx,
            chunk_rx,
        ));

        self.sessions.write().await.insert(
            session_id.clone(),
            SessionHandle {
                chunk_tx,
                result_rx,
            },
        );

        Ok(session_id)
    }

    pub async fn push(&self, session_id: &str, chunk: Vec<u8>) -> Result<()> {
        let sessions = self.sessions.read().await;
        let handle = sessions
            .get(session_id)
            .ok_or_else(|| anyhow::anyhow!("Unknown live session: {session_id}"))?;
        handle
            .chunk_tx
            .send(chunk)
            .await
            .map_err(|_| anyhow::anyhow!("Live session already stopped"))?;
        Ok(())
    }

    pub async fn stop_and_finish(&self, session_id: &str) -> Result<LiveTranscriptionResult> {
        let handle = {
            let mut sessions = self.sessions.write().await;
            sessions
                .remove(session_id)
                .ok_or_else(|| anyhow::anyhow!("Unknown live session: {session_id}"))?
        };
        // Dropping the sender closes the channel: the worker drains, flushes the
        // final decode, and answers on the oneshot.
        drop(handle.chunk_tx);

        match tokio::time::timeout(Duration::from_secs(120), handle.result_rx).await {
            Ok(Ok(Ok(result))) => Ok(result),
            Ok(Ok(Err(e))) => Err(anyhow::anyhow!("{e}")),
            Ok(Err(_recv)) => Err(anyhow::anyhow!(
                "Live transcription worker closed without a result"
            )),
            Err(_) => Err(anyhow::anyhow!("Live transcription timed out finalizing")),
        }
    }

    pub async fn active_sessions(&self) -> Vec<String> {
        self.sessions.read().await.keys().cloned().collect()
    }
}

async fn run_session(
    app: AppHandle,
    engine: Arc<TranscriptionEngine>,
    model: AIModel,
    options: LiveOptions,
    session_id: String,
    result_tx: oneshot::Sender<Result<LiveTranscriptionResult, String>>,
    mut chunk_rx: mpsc::Receiver<Vec<u8>>,
) {
    let sample_rate = model.sample_rate.clamp(8000, 48000) as u32;
    let bytes_per_sec = sample_rate as usize * 2;

    let mut pcm: Vec<u8> = Vec::new();
    let mut paragraphs: Vec<LiveSegment> = Vec::new();
    let mut paragraph_seq: u64 = 0;
    let mut committed: usize = 0;
    let mut detected_language = options.language.clone();
    let lang_hint = options.language.clone();
    let mut partial_text = String::new();
    let mut last_error: Option<String> = None;

    let seg_opts = SegmentationOptions {
        silence_break_seconds: if options.break_on_silence {
            options.silence_break_seconds
        } else {
            f32::MAX
        },
        sentence_break_gap_seconds: options.sentence_break_gap_seconds,
        break_on_speaker: options.break_on_speaker,
        max_paragraph_chars: options.max_paragraph_chars.max(60),
    };

    loop {
        let recv =
            tokio::time::timeout(Duration::from_millis(DECODE_INTERVAL_MS), chunk_rx.recv()).await;

        let mut got_audio = false;
        let mut closed = false;
        match recv {
            Ok(Some(bytes)) => {
                pcm.extend_from_slice(&bytes);
                got_audio = true;
            }
            Ok(None) => closed = true,
            Err(_) => {} // cadence tick
        }

        let total_secs = pcm.len() as f32 / bytes_per_sec as f32;

        if got_audio && total_secs >= MIN_AUDIO_SECS {
            let stable_cutoff = total_secs - STABLE_LOOKBACK_SECS;
            match decode(&engine, &model, &pcm, sample_rate, &lang_hint, &session_id).await {
                Ok(result) => {
                    detected_language = if result.language.is_empty() {
                        detected_language.clone()
                    } else {
                        result.language.clone()
                    };
                    let newly_final: Vec<_> = result
                        .segments
                        .iter()
                        .skip(committed)
                        .filter(|s| s.end <= stable_cutoff)
                        .cloned()
                        .collect();

                    for para in split_into_paragraphs(&newly_final, &seg_opts) {
                        let seg = LiveSegment {
                            session_id: session_id.clone(),
                            paragraph_id: paragraph_seq,
                            speaker: para.speaker,
                            language: detected_language.clone(),
                            text: para.text,
                            start: para.start,
                            end: para.end,
                            is_final: true,
                        };
                        paragraph_seq += 1;
                        let _ = app.emit(EVT_SEGMENT, &seg);
                        paragraphs.push(seg);
                    }
                    committed += newly_final.len();

                    partial_text = result
                        .segments
                        .iter()
                        .skip(committed)
                        .map(|s| s.text.as_str())
                        .collect::<Vec<_>>()
                        .join(" ");
                    let _ = app.emit(
                        EVT_PARTIAL,
                        LivePartial {
                            session_id: session_id.clone(),
                            text: partial_text.clone(),
                            duration_seconds: total_secs,
                            language: detected_language.clone(),
                        },
                    );
                }
                Err(e) => {
                    last_error = Some(e.to_string());
                    let _ = app.emit(
                        EVT_STATUS,
                        LiveStatus {
                            session_id: session_id.clone(),
                            state: "error".to_string(),
                            partial_text: partial_text.clone(),
                            duration_seconds: total_secs,
                            model_id: model.id.clone(),
                            language: detected_language.clone(),
                            error: Some(e.to_string()),
                        },
                    );
                }
            }
        }

        let _ = app.emit(
            EVT_STATUS,
            LiveStatus {
                session_id: session_id.clone(),
                state: "processing".to_string(),
                partial_text: partial_text.clone(),
                duration_seconds: total_secs,
                model_id: model.id.clone(),
                language: detected_language.clone(),
                error: None,
            },
        );

        if closed {
            break;
        }
    }

    // Final flush: decode the whole buffer and finalize everything.
    let total_secs = pcm.len() as f32 / bytes_per_sec as f32;
    if !pcm.is_empty() {
        match decode(&engine, &model, &pcm, sample_rate, &lang_hint, &session_id).await {
            Ok(result) => {
                if result.language.is_empty() == false {
                    detected_language = result.language.clone();
                }
                let remainder: Vec<_> = result.segments.iter().skip(committed).cloned().collect();
                for para in split_into_paragraphs(&remainder, &seg_opts) {
                    let seg = LiveSegment {
                        session_id: session_id.clone(),
                        paragraph_id: paragraph_seq,
                        speaker: para.speaker,
                        language: detected_language.clone(),
                        text: para.text,
                        start: para.start,
                        end: para.end,
                        is_final: true,
                    };
                    paragraph_seq += 1;
                    // Emit the same way as the live loop so the frontend, which
                    // inserts on `segment` events only, receives the tail too.
                    let _ = app.emit(EVT_SEGMENT, &seg);
                    paragraphs.push(seg);
                }
            }
            Err(e) => {
                last_error = Some(e.to_string());
            }
        }
    }

    let text = paragraphs
        .iter()
        .map(|p| p.text.as_str())
        .collect::<Vec<_>>()
        .join("\n\n");

    let _ = app.emit(
        EVT_STATUS,
        LiveStatus {
            session_id: session_id.clone(),
            state: "stopped".to_string(),
            partial_text: String::new(),
            duration_seconds: total_secs,
            model_id: model.id.clone(),
            language: detected_language.clone(),
            error: last_error.clone(),
        },
    );

    let outcome = if paragraphs.is_empty() && last_error.is_some() && !pcm.is_empty() {
        Err(last_error.unwrap_or_else(|| "transcription produced no text".to_string()))
    } else {
        Ok(LiveTranscriptionResult {
            session_id,
            text,
            paragraphs,
            duration_seconds: total_secs,
            language: detected_language,
        })
    };

    let _ = result_tx.send(outcome);
}

async fn decode(
    engine: &TranscriptionEngine,
    model: &AIModel,
    pcm: &[u8],
    sample_rate: u32,
    language: &str,
    session_id: &str,
) -> Result<TranscriptionResult> {
    let wav = pcm_to_wav(pcm, sample_rate);
    let path = std::env::temp_dir().join(format!("sofia-live-{session_id}.wav"));
    tokio::fs::write(&path, &wav).await?;
    engine
        .transcribe_with_model(model, &path.to_string_lossy(), language)
        .await
}

/// Wrap raw 16 kHz mono s16le PCM in a minimal RIFF/WAVE header so the ASR
/// backends (which consume files, not raw buffers) accept it.
fn pcm_to_wav(pcm: &[u8], sample_rate: u32) -> Vec<u8> {
    let byte_rate = sample_rate * 2;
    let data_len = pcm.len() as u32;
    let mut wav = Vec::with_capacity(44 + pcm.len());
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_len).to_le_bytes());
    wav.extend_from_slice(b"WAVE");
    wav.extend_from_slice(b"fmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
    wav.extend_from_slice(&1u16.to_le_bytes()); // mono
    wav.extend_from_slice(&sample_rate.to_le_bytes());
    wav.extend_from_slice(&byte_rate.to_le_bytes());
    wav.extend_from_slice(&2u16.to_le_bytes()); // block align
    wav.extend_from_slice(&16u16.to_le_bytes()); // bits per sample
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_len.to_le_bytes());
    wav.extend_from_slice(pcm);
    wav
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wav_header_is_well_formed() {
        let pcm = vec![0u8; 16];
        let wav = pcm_to_wav(&pcm, 16000);
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert_eq!(&wav[12..16], b"fmt ");
        // "data" marker at offset 36
        assert_eq!(&wav[36..40], b"data");
        // data length field
        let len = u32::from_le_bytes([wav[40], wav[41], wav[42], wav[43]]);
        assert_eq!(len as usize, pcm.len());
        assert_eq!(wav.len(), 44 + pcm.len());
    }
}
