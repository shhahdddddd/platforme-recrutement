import os
from celery import Celery

# Set default Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('ai_microservice', 
             broker='redis://127.0.0.1:6379/0',
             backend='redis://127.0.0.1:6379/0')

# Load config from settings with CELERY_ prefix
app.config_from_object('django.conf:settings', namespace='CELERY')

# Discover tasks in apps
app.autodiscover_tasks()
