"""
Configuration for the Katara Club Face Check-In module.

All values can be overridden via environment variables or a local `.env` file.
This project is fully standalone — it shares nothing with any other app.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="KATARA_", extra="ignore")

    # ── Database ────────────────────────────────────────────────────────────
    database_url: str = "sqlite:///./katara_checkin.db"

    # ── Face recognition engine ─────────────────────────────────────────────
    # "auto"  -> use InsightFace (ArcFace) if installed, else error clearly.
    # "insightface" -> force InsightFace.
    face_engine: str = "auto"
    # InsightFace model pack. buffalo_l = highest accuracy (ArcFace r100).
    insightface_model: str = "buffalo_l"
    # Detection size (px). Larger = more accurate on small/far faces, slower.
    det_size: int = 640

    # ── Matching / decision thresholds (the "bullet-proof" knobs) ───────────
    # Cosine similarity in [-1, 1]. A candidate must score AT LEAST this to be
    # accepted. Higher = stricter = fewer false accepts (and more rejects).
    accept_threshold: float = 0.45
    # The best match must beat the runner-up by at least this margin. This
    # rejects "ambiguous" cases (e.g. look-alikes / siblings) instead of
    # guessing. Set to 0 to disable margin checking.
    decision_margin: float = 0.10
    # Minimum face detection confidence to even consider a frame.
    min_det_score: float = 0.55

    # ── Liveness / anti-spoofing ────────────────────────────────────────────
    # Require the multi-frame liveness check to pass before recognising.
    require_liveness: bool = True
    # Minimum inter-frame variation to treat a capture as "live" (heuristic).
    liveness_min_motion: float = 6.0

    # ── CRM integration ─────────────────────────────────────────────────────
    # When a client is recognised, POST the check-in to this URL (your CRM).
    # Leave blank to only record check-ins locally (test mode).
    crm_webhook_url: str = ""
    crm_api_key: str = ""
    crm_timeout_seconds: float = 8.0

    # ── App ─────────────────────────────────────────────────────────────────
    app_title: str = "Katara Club — Face Check-In"
    # Where uploaded enrollment thumbnails are kept (for the admin UI only).
    media_dir: str = "./media"


settings = Settings()
