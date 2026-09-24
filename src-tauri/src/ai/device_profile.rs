//! Device capability assessment and local transcription model recommendation.
//!
//! Live, on-device speech recognition only keeps up if the chosen model fits
//! the machine. Laptops dominate this app's install base, so RAM is the hard
//! constraint (ASR models are loaded fully into memory; a model that spills to
//! swap cannot transcribe in real time). This module turns `sysinfo` readings
//! into a hardware profile and picks the best *downloadable / downloaded*
//! transcription model for it.

use crate::db::models::AIModel;
use serde::{Deserialize, Serialize};

/// Coarse but actionable picture of the current hardware.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceProfile {
    pub total_ram_gb: u32,
    pub available_ram_gb: u32,
    pub cpu_count: usize,
    /// Best-effort GPU detection (NVIDIA via nvidia-smi, Metal on macOS).
    pub gpu_accelerated: bool,
    pub os: String,
}

/// A concrete suggestion: which transcription model to use and why.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRecommendation {
    pub model_id: String,
    pub model_name: String,
    pub reason: String,
    pub is_downloaded: bool,
    pub fits_ram: bool,
    /// Estimated CPU real-time factor (< 1.0 = faster than real time).
    /// Read from the model's `config.json` `rft_cpu` field when present.
    pub estimated_realtime_factor: f32,
}

impl DeviceProfile {
    pub fn assess() -> Self {
        use sysinfo::System;

        let mut sys = System::new_all();
        sys.refresh_all();

        let total_ram_gb = (sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0).round() as u32;
        let available_ram_gb =
            (sys.available_memory() as f64 / 1024.0 / 1024.0 / 1024.0).round() as u32;
        let cpu_count = sys.cpus().len().max(1);

        Self {
            total_ram_gb,
            available_ram_gb,
            cpu_count,
            gpu_accelerated: detect_gpu(),
            os: System::name().unwrap_or_default(),
        }
    }
}

/// Recommend the most capable transcription model that fits the hardware.
///
/// Only considers `is_active` transcription models. Prefers a **downloaded**
/// local model that fits available RAM; when none is downloaded yet it points
/// at the best model to download for this tier and flags `needs download`.
pub fn recommend_transcription_model(
    profile: &DeviceProfile,
    models: &[AIModel],
) -> Option<ModelRecommendation> {
    let candidates: Vec<&AIModel> = models
        .iter()
        .filter(|m| m.model_type == "transcription" && m.is_active)
        .collect();

    if candidates.is_empty() {
        return None;
    }

    // Score = how well it fits. Quality is encoded in recommended RAM: a larger
    // model is higher quality, so we pick the biggest model that still fits.
    let fits = |m: &AIModel| (m.recommended_ram_gb as u32) <= profile.available_ram_gb;

    let best = if let Some(best_downloaded) = download_pick(&candidates, fits, true) {
        // Among downloaded models that fit, take the highest quality.
        best_downloaded
    } else if let Some(any_downloaded) = download_pick(&candidates, |_| true, true) {
        // A downloaded model exists but nothing *fits* free RAM — recommend the
        // lightest downloaded one and warn it may not keep up.
        any_downloaded
    } else {
        // Nothing downloaded: recommend the best downloadable fit for the tier.
        download_pick(&candidates, fits, false)?
    };

    let fits_ram = fits(best);
    let is_downloaded = best.is_downloaded;

    let reason = if is_downloaded && fits_ram {
        format!(
            "Модель установлена и подходит для вашего устройства (~{} ГБ свободной памяти)",
            profile.available_ram_gb
        )
    } else if is_downloaded {
        format!(
            "Модели нужно ~{} ГБ памяти, свободно ~{} ГБ — может работать с задержками",
            best.recommended_ram_gb, profile.available_ram_gb
        )
    } else {
        format!(
            "Подходит для вашего устройства: свободно ~{} ГБ памяти, модели нужно ~{} ГБ",
            profile.available_ram_gb, best.recommended_ram_gb
        )
    };

    Some(ModelRecommendation {
        model_id: best.id.clone(),
        model_name: best.name.clone(),
        reason,
        is_downloaded,
        fits_ram,
        estimated_realtime_factor: realtime_factor(best, profile),
    })
}

/// Pick the highest-quality model matching `fits`, optionally scoped to a
/// downloaded / not-downloaded state. Quality ordering: `recommended_ram_gb`
/// ascending (smaller is lighter), so `max_by` returns the largest that fits.
fn download_pick<'a, F>(
    candidates: &'a [&'a AIModel],
    fits: F,
    downloaded: bool,
) -> Option<&'a AIModel>
where
    F: Fn(&AIModel) -> bool,
{
    candidates
        .iter()
        .copied()
        .filter(|m| m.is_downloaded == downloaded)
        .filter(|m| fits(m))
        .max_by_key(|m| m.recommended_ram_gb)
}

/// Best-effort real-time factor estimate, from the model's `config` `rft_cpu`
/// field, falling back to a size-based heuristic.
fn realtime_factor(model: &AIModel, profile: &DeviceProfile) -> f32 {
    let parsed: Option<serde_json::Value> = serde_json::from_str(&model.config).ok();
    if let Some(v) = parsed
        .as_ref()
        .and_then(|c| c.get("rft_cpu"))
        .and_then(|v| v.as_f64())
    {
        return v as f32;
    }
    // Rough heuristic by disk size, relative to a mid-range laptop CPU.
    let gb = model.size_bytes as f32 / 1_000_000_000.0;
    (gb * 0.8).max(0.1) / (profile.cpu_count as f32 / 4.0).max(0.25)
}

fn detect_gpu() -> bool {
    #[cfg(target_os = "macos")]
    {
        // Metal is always available on macOS.
        return true;
    }
    #[cfg(not(target_os = "macos"))]
    {
        if let Ok(out) = std::process::Command::new("nvidia-smi").arg("-L").output() {
            if out.status.success() {
                return true;
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn model(id: &str, rec_ram: i32, downloaded: bool, rft: Option<f32>) -> AIModel {
        let config = match rft {
            Some(v) => format!("{{\"rft_cpu\": {}}}", v),
            None => "{}".to_string(),
        };
        AIModel {
            id: id.to_string(),
            name: id.to_string(),
            model_type: "transcription".to_string(),
            source: "local".to_string(),
            model_id: Some(id.to_string()),
            api_endpoint: None,
            api_key_encrypted: None,
            local_path: None,
            huggingface_repo: None,
            huggingface_revision: None,
            tokenizer_path: None,
            config_path: None,
            size_bytes: 142_000_000,
            quantization: None,
            languages: "[\"zh\",\"en\"]".to_string(),
            capabilities: "[]".to_string(),
            config,
            min_ram_gb: rec_ram - 1,
            recommended_ram_gb: rec_ram,
            supports_gpu: true,
            supports_cpu: true,
            max_context_length: 0,
            sample_rate: 16000,
            chunk_duration_seconds: 30.0,
            overlap_duration_seconds: 2.0,
            is_active: true,
            is_downloaded: downloaded,
            download_progress: 0.0,
            last_used_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }

    fn profile(avail_ram: u32, cpus: usize) -> DeviceProfile {
        DeviceProfile {
            total_ram_gb: 16,
            available_ram_gb: avail_ram,
            cpu_count: cpus,
            gpu_accelerated: false,
            os: "Windows".to_string(),
        }
    }

    #[test]
    fn picks_downloaded_model_that_fits() {
        let models = [
            model("whisper-base", 2, true, Some(0.3)),
            model("whisper-small", 4, true, Some(0.6)),
        ];
        let rec = recommend_transcription_model(&profile(8, 4), &models[..]).unwrap();
        // Both fit 8 GB; pick the higher-quality (larger recommended RAM).
        assert_eq!(rec.model_id, "whisper-small");
        assert!(rec.is_downloaded);
        assert!(rec.fits_ram);
    }

    #[test]
    fn falls_back_to_lighter_model_when_ram_is_tight() {
        let models = [
            model("whisper-base", 2, true, Some(0.3)),
            model("whisper-medium", 8, true, Some(1.2)),
        ];
        let rec = recommend_transcription_model(&profile(4, 4), &models[..]).unwrap();
        assert_eq!(rec.model_id, "whisper-base");
        assert!(rec.fits_ram);
    }

    #[test]
    fn recommends_download_target_when_nothing_downloaded() {
        let models = [
            model("whisper-tiny", 1, false, Some(0.15)),
            model("whisper-large", 12, false, Some(2.5)),
        ];
        let rec = recommend_transcription_model(&profile(8, 4), &models[..]).unwrap();
        assert!(!rec.is_downloaded);
        // large needs 12 GB > 8 free, so tiny (1 GB) is the downloadable fit,
        // and it does fit the available RAM.
        assert_eq!(rec.model_id, "whisper-tiny");
        assert!(rec.fits_ram);
    }

    #[test]
    fn ignores_non_transcription_models() {
        let mut analysis = model("llama", 4, true, None);
        analysis.model_type = "analysis".to_string();
        assert!(recommend_transcription_model(&profile(16, 4), &[analysis]).is_none());
    }

    #[test]
    fn realtime_factor_from_config() {
        let m = model("whisper-base", 2, true, Some(0.3));
        assert!((realtime_factor(&m, &profile(8, 4)) - 0.3).abs() < f32::EPSILON);
    }
}
