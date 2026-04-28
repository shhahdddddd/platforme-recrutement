import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables
_backend_env = BASE_DIR.parent / 'backend' / '.env'
_ai_env = BASE_DIR / '.env'

if _backend_env.exists():
    load_dotenv(_backend_env)
elif _ai_env.exists():
    load_dotenv(_ai_env)

# SECURITY
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-placeholder')
DEBUG = True
ALLOWED_HOSTS = ['*']

# APPLICATIONS
INSTALLED_APPS = [
    'daphne',
    'channels',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    'rest_framework',
    'corsheaders',
    'api',
    'django_celery_results',
]

# MIDDLEWARE
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# DATABASE
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_DATABASE', 'recrutement'),
        'USER': os.getenv('DB_USERNAME', 'postgres'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', '127.0.0.1'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}

# AUTH VALIDATORS
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# INTERNATIONALIZATION
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# STATIC
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS
CORS_ALLOW_ALL_ORIGINS = True

# CELERY
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://127.0.0.1:6379/0')
CELERY_RESULT_BACKEND = 'django-db'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'

# MEDIA
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# DRF
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ]
}

# AI SETTINGS
OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://localhost:11434/api/generate')
OLLAMA_EMBED_URL = os.getenv('OLLAMA_EMBED_URL', 'http://localhost:11434/api/embed')
BGE_M3_MODEL = 'BAAI/bge-m3'

# MODELS
OLLAMA_FAST_MODEL = os.getenv('OLLAMA_FAST_MODEL', 'phi3:latest')
OLLAMA_SYNTH_MODEL = os.getenv('OLLAMA_SYNTH_MODEL', 'phi3:latest')

# 🔐 API KEYS (SAFE)
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')
OPENROUTER_MODEL = os.getenv('OPENROUTER_MODEL', 'openrouter/auto')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'models/gemini-2.5-flash')

# CONNECTIVITY
BACKEND_URL = os.getenv('BACKEND_URL', 'http://127.0.0.1:8001')
REDIS_HOST = os.getenv('REDIS_HOST', '127.0.0.1')

# CHROMA DB
CHROMA_PERSIST_DIR = os.getenv('CHROMA_PERSIST_DIR', str(BASE_DIR / 'chroma_data'))
OLLAMA_EMBED_MODEL = os.getenv('OLLAMA_EMBED_MODEL', 'nomic-embed-text')

# ENCRYPTION
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY')

# CHANNELS
ASGI_APPLICATION = 'core.asgi.application'

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [(REDIS_HOST, 6379)],
        },
    },
}