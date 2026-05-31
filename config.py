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

    # Admin protection for the management pages (/waiver/admin, /status, /pdf).
    # The member-facing form stays public. Set admin_password to require login.
    admin_user: str = "admin"
    admin_password: str = ""

    # Google Workspace — store signed PDFs in Google Drive + email via Gmail.
    # Provide the service-account key either as a file path or inline JSON
    # (inline is handy for Cloud Run / secret managers).
    google_service_account_file: str = ""   # path to the service-account JSON key
    google_service_account_json: str = ""   # OR the JSON key contents inline
    google_drive_folder_id: str = ""        # target folder (use a Shared Drive folder)
    google_delegated_sender: str = ""       # Workspace user to send Gmail as (domain-wide delegation)
    google_save_to_drive: bool = True
    google_send_email: bool = True

    # Microsoft 365 (Graph API) — email + save signed PDFs into your 365
    ms365_tenant_id: str = ""
    ms365_client_id: str = ""
    ms365_client_secret: str = ""
    ms365_sender: str = "Reception@Katara.club"   # mailbox/OneDrive to send & save from
    ms365_send_email: bool = True                  # email reception via Graph
    ms365_save_to_drive: bool = True               # archive copy into 365
    ms365_save_folder: str = "Katara Club Waivers" # OneDrive/SharePoint folder
    ms365_sharepoint_site: str = ""                # e.g. "contoso.sharepoint.com/sites/Reception" (blank = OneDrive)

    # Optional SMTP fallback (used only if Graph is not configured)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
