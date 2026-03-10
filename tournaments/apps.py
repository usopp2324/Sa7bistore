from django.apps import AppConfig


class TournamentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tournaments'
    verbose_name = 'Tournaments'
    def ready(self):
        # import signal handlers
        try:
            from . import signals  # noqa: F401
        except Exception:
            pass
