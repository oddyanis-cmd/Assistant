from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""

    whatsapp_phone_number_id: str = ""
    whatsapp_access_token: str = ""
    whatsapp_verify_token: str = "changeme"
    whatsapp_owner_phone: str = ""

    meta_page_id: str = ""
    meta_page_access_token: str = ""
    meta_instagram_account_id: str = ""

    meta_ads_account_id: str = ""
    meta_ads_access_token: str = ""

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/gmail/callback"

    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""
    linkedin_redirect_uri: str = "http://localhost:8000/auth/linkedin/callback"

    database_url: str = "sqlite:///./assistant.db"
    app_base_url: str = "http://localhost:8000"

    # Digital waiver form
    waiver_recipient_email: str = "Reception@Katara.club"
    waiver_storage_dir: str = "./waiver_storage"
    # Optional SMTP fallback (used when Gmail OAuth is not connected)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
