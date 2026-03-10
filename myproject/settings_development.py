from .settings_base import *
import os

# Development-specific settings
DEBUG = True

# Provide a default dev secret key to make local runs simpler
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')

# Allow localhost access by default
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '') and [h.strip() for h in os.getenv('ALLOWED_HOSTS').split(',')] or ['localhost', '127.0.0.1']

# Use more permissive security settings in development
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
