from .settings_base import *

# Production-specific adjustments
DEBUG = False

# Require SECRET_KEY in production
if not SECRET_KEY:
    raise ValueError('SECRET_KEY environment variable is required for production')

# Ensure stricter cookie/security defaults
SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'True').lower() == 'true'
SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'True').lower() == 'true'
CSRF_COOKIE_SECURE = os.getenv('CSRF_COOKIE_SECURE', 'True').lower() == 'true'
