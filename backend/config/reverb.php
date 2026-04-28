<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Reverb Server
    |--------------------------------------------------------------------------
    |
    | This option defines the default Reverb server that will be used to
    | handle incoming WebSocket connections. You may change this default
    | as required, but you're not obligated to do so.
    |
    */

    'default' => env('REVERB_SERVER', 'reverb'),

    /*
    |--------------------------------------------------------------------------
    | Reverb Servers
    |--------------------------------------------------------------------------
    |
    | Here you may define the Reverb servers for your application. Each server
    | is given a unique key that may be used to identify the server in the
    | Reverb console. You may also specify the host, port, and hostname.
    |
    | For local development, the default server will be "localhost" on port
    | 8080. You can modify these settings as needed for your environment.
    |
    */

    'servers' => [

        'reverb' => [
            'host' => env('REVERB_HOST', '0.0.0.0'),
            'port' => env('REVERB_PORT', 8080),
            'hostname' => env('REVERB_HOSTNAME', 'localhost'),
            'options' => [
                'tls' => env('REVERB_USE_TLS', false) ? [
                    'local_cert' => env('REVERB_SSL_CERT', base_path('../admin/ssl/cert.pem')),
                    'local_pk' => env('REVERB_SSL_KEY', base_path('../admin/ssl/key.pem')),
                    'verify_peer' => false,
                    'allow_self_signed' => true,
                ] : [],
            ],
            'max_request_size' => 10_000,
            'scaling' => [
                'enabled' => env('REVERB_SCALING_ENABLED', false),
                'channel' => env('REVERB_SCALING_CHANNEL', 'reverb'),
                'server' => [
                    'url' => env('REDIS_URL'),
                    'host' => env('REDIS_HOST', '127.0.0.1'),
                    'port' => env('REDIS_PORT', '6379'),
                    'username' => env('REDIS_USERNAME'),
                    'password' => env('REDIS_PASSWORD'),
                    'database' => env('REDIS_DB', '0'),
                ],
            ],
            'pulse_ingest_interval' => 15,
            'telescope_ingest_interval' => 15,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Reverb Applications
    |--------------------------------------------------------------------------
    |
    | Here you may define the Reverb applications that may be used to handle
    | incoming WebSocket connections. Each application should have a unique
    | key, app ID, and secret. You may use the same app ID and secret for
    | multiple applications as long as the keys are unique.
    |
    */

    'apps' => [

        'provider' => 'config',

        'apps' => [
            [
                'key' => env('REVERB_APP_KEY'),
                'secret' => env('REVERB_APP_SECRET'),
                'app_id' => env('REVERB_APP_ID'),
                'options' => [
                    'host' => env('REVERB_HOST'),
                    'port' => env('REVERB_PORT', 8080),
                    'scheme' => env('REVERB_SCHEME', env('REVERB_USE_TLS', false) ? 'https' : 'http'),
                    'useTLS' => env('REVERB_USE_TLS', false),
                ],
                'allowed_origins' => ['*'],
                'ping_interval' => env('REVERB_PING_INTERVAL', 60),
                'activity_timeout' => env('REVERB_ACTIVITY_TIMEOUT', 30),
                'max_message_size' => env('REVERB_MAX_MESSAGE_SIZE', 10_000),
            ],
        ],

    ],

];
