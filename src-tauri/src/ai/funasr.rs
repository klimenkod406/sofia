//! FunASR (Chinese/English) integration and whisper.cpp fallback.
//!
//! Both backends are invoked as child processes (Python for FunASR, the
//! `whisper-cli` binary for whisper.cpp) so the app never links native ML
//! libraries into the GUI process. Model *selection* is driven by the model's
//! `config.backend` field and its `local_path` — see `transcription.rs`.

use crate::ai::transcription::{TranscriptionJob, TranscriptionResult, TranscriptionSegment};
use crate::db::models::AIModel;
use anyhow::Result;
use std::path::{Path, PathBuf};
use tokio::process::Command;

pub struct FunASRTranscriber {
    model_dir: String,
    python_executable: String,
    script_path: String,
}

impl FunASRTranscriber {
    pub fn new(model_dir: &str) -> Result<Self> {
        let python_executable = Self::find_python()?;
        let script_path = Self::find_funasr_script()?;

        Ok(Self {
            model_dir: model_dir.to_string(),
            python_executable,
            script_path,
        })
    }

    pub(crate) fn find_python() -> Result<String> {
        for cmd in ["python3", "python", "py"] {
            if let Ok(output) = std::process::Command::new(cmd).arg("--version").output() {
                if output.status.success() {
                    return Ok(cmd.to_string());
                }
            }
        }
        Err(anyhow::anyhow!(
            "Python not found. Please install Python 3.8+"
        ))
    }

    fn find_funasr_script() -> Result<String> {
        let possible_paths = [
            "resources/funasr/transcribe.py",
            "../resources/funasr/transcribe.py",
            "../../resources/funasr/transcribe.py",
        ];

        for path in possible_paths {
            if Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }

        // Return default path - will be created at runtime
        Ok("resources/funasr/transcribe.py".to_string())
    }

    pub async fn transcribe_with_model(
        &self,
        model: &AIModel,
        audio_path: &str,
        language: &str,
    ) -> Result<TranscriptionResult> {
        let model_id = model
            .model_id
            .as_deref()
            .unwrap_or("iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch");
        self.transcribe_core(model_id, audio_path, language).await
    }

    pub async fn transcribe(&self, job: &TranscriptionJob) -> Result<TranscriptionResult> {
        let model_id = job
            .model_id
            .as_deref()
            .unwrap_or("iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch");
        self.transcribe_core(model_id, &job.audio_path, &job.language)
            .await
    }

    async fn transcribe_core(
        &self,
        model_id: &str,
        audio_path: &str,
        language: &str,
    ) -> Result<TranscriptionResult> {
        let mut cmd = Command::new(&self.python_executable);
        cmd.arg(&self.script_path)
            .arg("--audio")
            .arg(audio_path)
            .arg("--model")
            .arg(model_id)
            .arg("--model_dir")
            .arg(&self.model_dir)
            .arg("--language")
            .arg(language)
            .arg("--output_format")
            .arg("json");

        // Add VAD and punctuation models if available
        let vad_model = format!(
            "{}/speech_fsmn_vad_zh-cn-16k-common-pytorch",
            self.model_dir
        );
        let punc_model = format!(
            "{}/punc_ct-transformer_zh-cn-common-vocab272727-pytorch",
            self.model_dir
        );

        if Path::new(&vad_model).exists() {
            cmd.arg("--vad_model").arg(&vad_model);
        }
        if Path::new(&punc_model).exists() {
            cmd.arg("--punc_model").arg(&punc_model);
        }

        let output = cmd.output().await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("FunASR transcription failed: {stderr}"));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        self.parse_output(&stdout)
    }

    pub async fn transcribe_stream(
        &self,
        job: &TranscriptionJob,
        sender: tokio::sync::mpsc::Sender<TranscriptionSegment>,
    ) -> Result<()> {
        let audio_path = &job.audio_path;
        let language = &job.language;
        let model_id = job
            .model_id
            .as_deref()
            .unwrap_or("iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch");

        let mut cmd = Command::new(&self.python_executable);
        cmd.arg(&self.script_path)
            .arg("--audio")
            .arg(audio_path)
            .arg("--model")
            .arg(model_id)
            .arg("--model_dir")
            .arg(&self.model_dir)
            .arg("--language")
            .arg(language)
            .arg("--stream")
            .arg("true")
            .arg("--output_format")
            .arg("jsonl");

        let mut child = cmd.spawn()?;

        use tokio::io::{AsyncBufReadExt, BufReader};
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow::anyhow!("Failed to capture stdout"))?;
        let mut reader = BufReader::new(stdout).lines();

        while let Some(line) = reader.next_line().await? {
            if line.trim().is_empty() {
                continue;
            }
            if let Ok(segment) = serde_json::from_str::<TranscriptionSegment>(&line) {
                if sender.send(segment).await.is_err() {
                    break; // Receiver dropped
                }
            }
        }

        child.wait().await?;
        Ok(())
    }

    fn parse_output(&self, output: &str) -> Result<TranscriptionResult> {
        #[derive(serde::Deserialize)]
        struct FunASROutput {
            text: String,
            segments: Vec<FunASRSegment>,
        }

        #[derive(serde::Deserialize)]
        struct FunASRSegment {
            start: f32,
            end: f32,
            text: String,
            speaker: Option<String>,
            confidence: Option<f32>,
        }

        let parsed: FunASROutput = serde_json::from_str(output)
            .map_err(|e| anyhow::anyhow!("Failed to parse FunASR output: {e}"))?;

        let segments: Vec<TranscriptionSegment> = parsed
            .segments
            .into_iter()
            .map(|s| TranscriptionSegment {
                start: s.start,
                end: s.end,
                text: s.text,
                speaker: s.speaker,
                confidence: s.confidence.unwrap_or(1.0),
            })
            .collect();

        let duration = segments.last().map(|s| s.end).unwrap_or(0.0);
        let language = detect_language(&parsed.text);

        Ok(TranscriptionResult {
            text: parsed.text,
            segments,
            duration,
            language,
        })
    }

    pub async fn download_models(&self, model_id: &str) -> Result<()> {
        let mut cmd = Command::new(&self.python_executable);
        cmd.arg("-m")
            .arg("modelscope.cli")
            .arg("download")
            .arg("--model")
            .arg(model_id)
            .arg("--local_dir")
            .arg(&self.model_dir);

        let output = cmd.output().await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Model download failed: {stderr}"));
        }

        Ok(())
    }
}

/// Fallback implementation using whisper.cpp when FunASR is not available.
///
/// The CLI is looked up in `<models dir>/bin/whisper-cli(.exe)` first — the app
/// bundles the official whisper.cpp v1.5.4 Windows build during model
/// installation (matching the ggml-*.bin weights) — then on PATH. We ask for
/// VTT output (`-ovtt`) because its `HH:MM:SS.mmm` timestamps are unambiguous,
/// unlike the version-dependent `t0`/`t1` units in `-oj` JSON.
#[derive(Clone)]
pub struct WhisperCppTranscriber {
    whisper_cli: PathBuf,
}

impl WhisperCppTranscriber {
    /// Prefer the CLI bundled next to the models, then fall back to PATH.
    pub fn new(models_dir: &str) -> Result<Self> {
        let bundled = Path::new(models_dir).join("bin").join(if cfg!(windows) {
            "whisper-cli.exe"
        } else {
            "whisper-cli"
        });
        if bundled.exists() {
            return Ok(Self {
                whisper_cli: bundled,
            });
        }
        Ok(Self {
            whisper_cli: Self::find_on_path()?,
        })
    }

    /// Construct directly from a known CLI path (e.g. after an on-demand
    /// download of the bundled binary).
    pub fn new_with_cli(cli: PathBuf) -> Result<Self> {
        Ok(Self { whisper_cli: cli })
    }

    fn find_on_path() -> Result<PathBuf> {
        for cmd in ["whisper-cli", "whisper", "main"] {
            if let Ok(output) = std::process::Command::new(cmd).arg("--help").output() {
                if output.status.success() {
                    return Ok(PathBuf::from(cmd));
                }
            }
        }
        Err(anyhow::anyhow!(
            "whisper.cpp not found. Please install whisper.cpp"
        ))
    }

    pub async fn transcribe(
        &self,
        model: &AIModel,
        audio_path: &str,
        language: &str,
    ) -> Result<TranscriptionResult> {
        let model_path = model
            .local_path
            .as_deref()
            .ok_or_else(|| anyhow::anyhow!("Model file not set — download it first"))?;

        if !Path::new(model_path).exists() {
            return Err(anyhow::anyhow!("Model file not found: {model_path}"));
        }

        let config: serde_json::Value =
            serde_json::from_str(&model.config).unwrap_or(serde_json::json!({}));
        let n_threads = config
            .get("n_threads")
            .and_then(|v| v.as_i64())
            .unwrap_or(4) as usize;
        let n_threads = std::thread::available_parallelism()
            .map(|n| n_threads.min(n.get()))
            .unwrap_or(n_threads);
        let lang = if language.is_empty() {
            "auto"
        } else {
            language
        };

        let mut cmd = Command::new(&self.whisper_cli);
        cmd.arg("-m")
            .arg(model_path)
            .arg("-f")
            .arg(audio_path)
            .arg("-ovtt")
            .arg("-l")
            .arg(lang)
            .arg("-t")
            .arg(n_threads.to_string());

        // Optional beam size / no-speech threshold from config.
        if let Some(beam) = config.get("beam_size").and_then(|v| v.as_i64()) {
            cmd.arg("--beam-size").arg(beam.to_string());
        }

        let output = cmd.output().await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!(
                "whisper.cpp transcription failed: {stderr}"
            ));
        }

        // `-ovtt` writes the transcript to `<input>.vtt` — parse that file, it
        // is the canonical VTT. Fall back to stdout for builds that print the
        // same cues instead of (or in addition to) writing the file.
        let vtt_path = format!("{audio_path}.vtt");
        let vtt_file = tokio::fs::read_to_string(&vtt_path)
            .await
            .unwrap_or_default();
        if !vtt_file.trim().is_empty() {
            self.parse_vtt(&vtt_file)
        } else {
            let stdout = String::from_utf8_lossy(&output.stdout);
            self.parse_vtt(&stdout)
        }
    }

    fn parse_vtt(&self, output: &str) -> Result<TranscriptionResult> {
        let segments = parse_vtt(output)?;
        let text = segments
            .iter()
            .map(|s| s.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        let duration = segments.last().map(|s| s.end).unwrap_or(0.0);
        let language = detect_language(&text);

        Ok(TranscriptionResult {
            text,
            segments,
            duration,
            language,
        })
    }
}

/// Parse a WebVTT body into timed segments. Handles both formats whisper.cpp
/// produces:
/// - the `.vtt` file written by `-ovtt` (`HH:MM:SS.mmm --> HH:MM:SS.mmm` on its
///   own line, cue text on the following lines), and
/// - the stdout progress format (`[HH:MM:SS.mmm --> HH:MM:SS.mmm]  text` with
///   the cue text on the same line).
pub(crate) fn parse_vtt(output: &str) -> Result<Vec<TranscriptionSegment>> {
    let mut segments = Vec::new();
    let mut start: Option<f32> = None;
    let mut end: Option<f32> = None;
    let mut text_lines: Vec<String> = Vec::new();

    for raw in output.lines() {
        let line = raw.trim_end();
        if let Some(idx) = line.find("-->") {
            // Flush the previous VTT-format cue (timestamp alone on a line,
            // text on the following lines) before starting a new one.
            push_vtt_segment(&mut segments, start.take(), end.take(), &mut text_lines);

            let left = line[..idx].trim();
            let right = line[idx + 3..].trim();

            // stdout progress format carries the cue text after the closing
            // `]` on the timestamp line itself: `[t1 --> t2]  text`.
            let left = left.strip_prefix('[').unwrap_or(left);
            let (right, inline_text) = match right.find(']') {
                Some(close) => (right[..close].trim(), right[close + 1..].trim()),
                None => (right, ""),
            };

            match (parse_vtt_timestamp(left), parse_vtt_timestamp(right)) {
                (Some(s), Some(e)) if !inline_text.is_empty() => {
                    segments.push(TranscriptionSegment {
                        start: s,
                        end: e,
                        text: inline_text.to_string(),
                        speaker: None,
                        confidence: 1.0,
                    });
                }
                (Some(s), Some(e)) => {
                    start = Some(s);
                    end = Some(e);
                }
                _ => {} // malformed timestamp line — ignore
            }
        } else if line.is_empty()
            || line.starts_with("WEBVTT")
            || line.starts_with("NOTE")
            || line.starts_with("Kind:")
            || line.starts_with("Language:")
        {
            continue;
        } else if start.is_some() {
            text_lines.push(line.trim().to_string());
        }
    }

    push_vtt_segment(&mut segments, start, end, &mut text_lines);
    Ok(segments)
}

fn push_vtt_segment(
    segments: &mut Vec<TranscriptionSegment>,
    start: Option<f32>,
    end: Option<f32>,
    text_lines: &mut Vec<String>,
) {
    let text = text_lines.join(" ").trim().to_string();
    text_lines.clear();
    if let (Some(s), Some(e)) = (start, end) {
        if !text.is_empty() {
            segments.push(TranscriptionSegment {
                start: s,
                end: e,
                text,
                speaker: None,
                confidence: 1.0,
            });
        }
    }
}

fn parse_vtt_timestamp(s: &str) -> Option<f32> {
    let s = s.trim();
    let parts: Vec<&str> = s.split(':').collect();
    if parts.is_empty() {
        return None;
    }
    let (h, m, sec) = match parts.len() {
        3 => (
            parts[0].parse::<f32>().ok()?,
            parts[1].parse::<f32>().ok()?,
            parts[2].parse::<f32>().ok()?,
        ),
        2 => (
            0.0,
            parts[0].parse::<f32>().ok()?,
            parts[1].parse::<f32>().ok()?,
        ),
        _ => return None,
    };
    Some(h * 3600.0 + m * 60.0 + sec)
}

/// Very small heuristic language tag: CJK-heavy text is treated as `zh`.
fn detect_language(text: &str) -> String {
    let cjk = text
        .chars()
        .filter(|c| ('\u{4E00}'..='\u{9FFF}').contains(c))
        .count();
    let total = text.chars().filter(|c| c.is_alphabetic()).count();
    if total > 0 && cjk as f32 / total as f32 > 0.3 {
        "zh".to_string()
    } else {
        "auto".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_vtt_timestamps() {
        assert!((parse_vtt_timestamp("00:00:01.500").unwrap() - 1.5).abs() < 0.001);
        assert!((parse_vtt_timestamp("00:01:00.000").unwrap() - 60.0).abs() < 0.001);
        assert!((parse_vtt_timestamp("01:00:00.000").unwrap() - 3600.0).abs() < 0.001);
    }

    #[test]
    fn parses_vtt_body_into_segments() {
        let vtt = "WEBVTT\n\n00:00:00.000 --> 00:00:02.100\nhello world\n\n\
00:00:02.500 --> 00:00:04.000\nsecond segment\n";
        let segs = parse_vtt(vtt).unwrap();
        assert_eq!(segs.len(), 2);
        assert_eq!(segs[0].text, "hello world");
        assert!((segs[0].end - 2.1).abs() < 0.001);
        assert_eq!(segs[1].text, "second segment");
    }

    #[test]
    fn parses_whisper_stdout_progress_format() {
        // `whisper-cli` prints cues to stdout as `[t1 --> t2]  text` — the
        // same timestamps it writes into the .vtt file, but inline. Both must
        // produce the same segments (this was the "nothing happens" bug: the
        // parser only understood the file format and dropped every cue).
        let out = "[00:00:00.000 --> 00:00:02.000]   Привет!\n\
[00:00:02.000 --> 00:00:04.000]   Привет\n";
        let segs = parse_vtt(out).unwrap();
        assert_eq!(segs.len(), 2);
        assert_eq!(segs[0].text, "Привет!");
        assert!((segs[0].start - 0.0).abs() < 0.001);
        assert!((segs[0].end - 2.0).abs() < 0.001);
        assert_eq!(segs[1].text, "Привет");
        assert!((segs[1].start - 2.0).abs() < 0.001);
        assert!((segs[1].end - 4.0).abs() < 0.001);
    }

    #[test]
    fn detects_chinese() {
        assert_eq!(detect_language("今天天气很好"), "zh");
        assert_eq!(detect_language("hello world"), "auto");
    }
}
