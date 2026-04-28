import os
from pathlib import Path
from dotenv import load_dotenv
BASE_DIR = Path(__file__).resolve().parent.parent
_backend_env = BASE_DIR.parent / 'backend' / '.env'
_ai_env = BASE_DIR / '.env'

if _backend_env.exists():
    load_dotenv(_backend_env)
elif _ai_env.exists():
    load_dotenv(_ai_env)

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-d9sj!b8!3z6ha53!rube6%d5!1#+o8jhdq3dn53c+#vzp*j@49')
DEBUG = True
ALLOWED_HOSTS = ['*']

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

# Database - Using the same PostgreSQL as Laravel
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_DATABASE', 'recrutement'),
        'USER': os.getenv('DB_USERNAME', 'postgres'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'shahd123'),
        'HOST': os.getenv('DB_HOST', '127.0.0.1'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CORS_ALLOW_ALL_ORIGINS = True

# Celery Configuration
CELERY_BROKER_URL = 'redis://127.0.0.1:6379/0'
CELERY_RESULT_BACKEND = 'django-db'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'

# Storage / MinIO Simulation (for now local, but structured for S3)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ]
}

# AI Settings
OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://localhost:11434/api/generate')
OLLAMA_EMBED_URL = os.getenv('OLLAMA_EMBED_URL', 'http://localhost:11434/api/embed')
BGE_M3_MODEL = 'BAAI/bge-m3'

# LLM Model Selection
OLLAMA_FAST_MODEL = os.getenv('OLLAMA_FAST_MODEL', 'phi3:latest')      # For classification, routing, grading
OLLAMA_SYNTH_MODEL = os.getenv('OLLAMA_SYNTH_MODEL', 'phi3:latest')    # For question synthesis

GROQ_API_KEY = os.getenv('GROQ_API_KEY', 'YOUR_GROQ_API_KEY_HERE')
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY', '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')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', 'AIzaSyAwBY_52jQNOjhU2pQVqu21gqie-TTvsiA')

GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')
OPENROUTER_MODEL = os.getenv('OPENROUTER_MODEL', 'openrouter/auto')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'models/gemini-2.5-flash')

# Connectivity
BACKEND_URL = os.getenv('BACKEND_URL', 'http://127.0.0.1:8001')
REDIS_HOST = os.getenv('REDIS_HOST', '127.0.0.1')

# ChromaDB Vector Store Configuration
CHROMA_PERSIST_DIR = os.getenv('CHROMA_PERSIST_DIR', str(BASE_DIR / 'chroma_data'))
OLLAMA_EMBED_MODEL = os.getenv('OLLAMA_EMBED_MODEL', 'nomic-embed-text')

# Encryption Configuration for Sensitive Data at Rest
# Generate a key with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', None)
# If ENCRYPTION_KEY is not set, encryption will derive from SECRET_KEY (not recommended for production)

# Channels (WebSocket) Configuration
ASGI_APPLICATION = 'core.asgi.application'

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [(REDIS_HOST, 6379)],
        },
    },
}
