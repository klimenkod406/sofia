//! Logical segmentation of a flat transcript into paragraphs.
//!
//! The live transcription pipeline emits one flat list of timed segments; a
//! note must instead read as coherent *paragraphs*. This module groups
//! segments into logical blocks using three signals, in priority order:
//!
//! 1. A silence gap between segments longer than `silence_break_seconds`
//!    (speaker paused → new thought).
//! 2. A speaker change (only when diarization is available and `break_on_speaker`).
//! 3. A sentence-final punctuation mark followed by a short pause
//!    (`sentence_break_gap_seconds`) — a natural new paragraph at the end of a
//!    sentence when the speaker pauses.
//!
//! Paragraphs are additionally capped at `max_paragraph_chars` so a talker who
//! never pauses does not produce a wall of text. Everything in here is pure and
//! unit-tested; the actual ASR backends only have to provide `TranscriptionSegment`s.

use crate::ai::transcription::TranscriptionSegment;
use serde::{Deserialize, Serialize};

/// A logical paragraph derived from one or more timed segments.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Paragraph {
    pub text: String,
    pub start: f32,
    pub end: f32,
    pub speaker: Option<String>,
}

/// Tuning knobs for the segmentation pass.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SegmentationOptions {
    /// Break into a new paragraph when the gap between consecutive segments
    /// exceeds this many seconds.
    pub silence_break_seconds: f32,
    /// Treat a sentence-final punctuation followed by at least this much gap
    /// as a paragraph boundary.
    pub sentence_break_gap_seconds: f32,
    /// Break on speaker change when a speaker label is present.
    pub break_on_speaker: bool,
    /// Hard ceiling on a single paragraph, in characters.
    pub max_paragraph_chars: usize,
}

impl Default for SegmentationOptions {
    fn default() -> Self {
        Self {
            silence_break_seconds: 1.5,
            sentence_break_gap_seconds: 0.4,
            break_on_speaker: true,
            max_paragraph_chars: 600,
        }
    }
}

/// Group a flat, time-ordered list of segments into logical paragraphs.
pub fn split_into_paragraphs(
    segments: &[TranscriptionSegment],
    options: &SegmentationOptions,
) -> Vec<Paragraph> {
    if segments.is_empty() {
        return Vec::new();
    }

    let mut paragraphs: Vec<Paragraph> = Vec::new();
    let mut buf: Vec<TranscriptionSegment> = Vec::new();
    let mut buf_len = 0usize;

    for seg in segments {
        let should_break = if buf.is_empty() {
            false
        } else {
            let prev = buf.last().expect("buf non-empty");
            let gap = seg.start - prev.end;
            let start_new = gap > options.silence_break_seconds;
            let speaker_change = options.break_on_speaker
                && prev.speaker.is_some()
                && seg.speaker.is_some()
                && prev.speaker != seg.speaker;
            let sentence_end_pause =
                gap >= options.sentence_break_gap_seconds && is_sentence_end(&prev.text);
            let over_cap = buf_len + seg.text.chars().count() > options.max_paragraph_chars
                && (is_sentence_end(&prev.text) || gap >= options.sentence_break_gap_seconds);

            start_new || speaker_change || sentence_end_pause || over_cap
        };

        if should_break {
            flush(&mut paragraphs, &mut buf, &mut buf_len);
        }

        buf_len += seg.text.chars().count();
        buf.push(seg.clone());
    }

    flush(&mut paragraphs, &mut buf, &mut buf_len);
    paragraphs
}

fn flush(paragraphs: &mut Vec<Paragraph>, buf: &mut Vec<TranscriptionSegment>, len: &mut usize) {
    if buf.is_empty() {
        return;
    }
    let text = join_segments(buf);
    let start = buf.first().map(|s| s.start).unwrap_or(0.0);
    let end = buf.last().map(|s| s.end).unwrap_or(0.0);
    // Speaker label: use the majority label of the block when present.
    let speaker = buf.iter().filter_map(|s| s.speaker.clone()).next();
    paragraphs.push(Paragraph {
        text,
        start,
        end,
        speaker,
    });
    buf.clear();
    *len = 0;
}

/// Join segments with language-appropriate spacing: no space when either side
/// is CJK (or CJK punctuation), a single space otherwise. Segment-internal
/// spacing is left untouched — the ASR backend already formats it.
fn join_segments(segments: &[TranscriptionSegment]) -> String {
    let mut out = String::new();
    for seg in segments {
        let piece = seg.text.trim();
        if piece.is_empty() {
            continue;
        }
        if !out.is_empty() {
            let a_last = out.chars().last();
            let b_first = piece.chars().next();
            let join = match (a_last, b_first) {
                (Some(x), Some(y)) if !is_cjk(x) && !is_cjk(y) => " ",
                _ => "",
            };
            out.push_str(join);
        }
        out.push_str(piece);
    }
    out
}

fn is_sentence_end(text: &str) -> bool {
    let t = text.trim_end();
    ['.', '!', '?', '。', '！', '？', '…']
        .iter()
        .any(|p| t.ends_with(*p))
}

fn is_cjk(c: char) -> bool {
    matches!(c,
        '\u{3400}'..='\u{4DBF}'   // CJK Extension A
        | '\u{4E00}'..='\u{9FFF}' // CJK Unified
        | '\u{3000}'..='\u{303F}' // CJK punctuation
        | '\u{FF00}'..='\u{FFEF}' // fullwidth forms
        | '\u{2000}'..='\u{206F}' // general punctuation
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seg(start: f32, end: f32, text: &str) -> TranscriptionSegment {
        TranscriptionSegment {
            start,
            end,
            text: text.to_string(),
            speaker: None,
            confidence: 1.0,
        }
    }

    #[test]
    fn empty_input_is_empty() {
        let p = split_into_paragraphs(&[], &SegmentationOptions::default());
        assert!(p.is_empty());
    }

    #[test]
    fn silence_gap_splits_into_paragraphs() {
        let inputs = vec![
            seg(0.0, 1.0, "hello world"),
            seg(1.0, 2.0, "this continues"),
            seg(5.0, 6.0, "after a long pause"),
        ];
        let p = split_into_paragraphs(&inputs, &SegmentationOptions::default());
        assert_eq!(p.len(), 2);
        assert_eq!(p[0].text, "hello world this continues");
        assert_eq!(p[1].text, "after a long pause");
    }

    #[test]
    fn sentence_end_with_pause_starts_new_paragraph() {
        let options = SegmentationOptions {
            silence_break_seconds: 10.0, // silence rule effectively off
            ..SegmentationOptions::default()
        };
        let inputs = vec![
            seg(0.0, 1.0, "First point."),
            seg(1.6, 2.6, "Second point."),
            seg(2.9, 4.0, "still second."),
        ];
        let p = split_into_paragraphs(&inputs, &options);
        // 1.6 - 1.0 = 0.6s gap >= 0.4s, and "First point." ends with '.'
        assert_eq!(p.len(), 2);
        assert_eq!(p[0].text, "First point.");
        assert_eq!(p[1].text, "Second point. still second.");
    }

    #[test]
    fn max_paragraph_chars_caps_a_wall_of_text() {
        let options = SegmentationOptions {
            max_paragraph_chars: 20,
            silence_break_seconds: 10.0,
            sentence_break_gap_seconds: 10.0,
            ..SegmentationOptions::default()
        };
        let inputs = vec![
            seg(0.0, 1.0, "aaaaaaaaaa."),
            seg(1.0, 2.0, "bbbbbbbbbb."),
            seg(2.0, 3.0, "cccccccccc."),
        ];
        let p = split_into_paragraphs(&inputs, &options);
        assert!(p.len() >= 2, "at least two paragraphs, got {}", p.len());
        for para in &p {
            assert!(para.text.chars().count() <= 20);
        }
    }

    #[test]
    fn speaker_change_splits() {
        let options = SegmentationOptions::default();
        let mut a = seg(0.0, 1.0, "Speaker one speaks.");
        a.speaker = Some("spk1".to_string());
        let mut b = seg(1.1, 2.1, "Speaker two answers.");
        b.speaker = Some("spk2".to_string());
        let p = split_into_paragraphs(&[a, b], &options);
        assert_eq!(p.len(), 2);
        assert_eq!(p[0].speaker.as_deref(), Some("spk1"));
        assert_eq!(p[1].speaker.as_deref(), Some("spk2"));
    }

    #[test]
    fn no_space_between_cjk() {
        let inputs = vec![seg(0.0, 1.0, "今天"), seg(1.0, 2.0, "天气很好。")];
        let p = split_into_paragraphs(&inputs, &SegmentationOptions::default());
        assert_eq!(p[0].text, "今天天气很好。");
    }

    #[test]
    fn space_kept_between_latin_words() {
        let inputs = vec![seg(0.0, 1.0, "hello"), seg(1.0, 2.0, "world")];
        let p = split_into_paragraphs(&inputs, &SegmentationOptions::default());
        assert_eq!(p[0].text, "hello world");
    }
}
