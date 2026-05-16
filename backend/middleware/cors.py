"""CORS configuration"""
from config import settings

CORS_CONFIG = {
    "allow_origins": settings.ALLOWED_ORIGINS,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
