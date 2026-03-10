"""Environment-aware settings loader.

This file selects which concrete settings module to load:
- myproject.settings_development when running on Windows (developer machines),
- myproject.settings_production otherwise.

You may override detection by setting the environment variable
`DJANGO_SETTINGS_MODULE` or `DJANGO_ENV` to include `development` or
`production` (case-insensitive).
"""

import os
import platform

# Explicit override via DJANGO_SETTINGS_MODULE or DJANGO_ENV
override = os.getenv('DJANGO_SETTINGS_MODULE') or os.getenv('DJANGO_ENV')
if override:
    env = override.lower()
    if 'development' in env:
        from .settings_development import *
    elif 'production' in env:
        from .settings_production import *
    else:
        # If an explicit but unrecognized value is provided, prefer production.
        from .settings_production import *
else:
    # Default heuristic: Windows -> development, otherwise production
    if platform.system().lower().startswith('win'):
        from .settings_development import *
    else:
        from .settings_production import *
