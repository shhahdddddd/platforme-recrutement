<?php

return [
   

    'server_url' => env('KEYCLOAK_SERVER_URL', 'http://localhost:8080'),

    'realm' => env('KEYCLOAK_REALM', 'recrutement'),

    'client_id' => env('KEYCLOAK_CLIENT_ID', 'recrutement-api'),

    'client_secret' => env('KEYCLOAK_CLIENT_SECRET', ''),
    'load_public_key_from_server' => env('KEYCLOAK_LOAD_PUBLIC_KEY_FROM_SERVER', true),
    'realm_public_key' => env('KEYCLOAK_REALM_PUBLIC_KEY', null),

    // Token validation algorithm
    'token_algorithm' => env('KEYCLOAK_TOKEN_ALGORITHM', 'RS256'),

    // The attribute to use as the local user identifier (sub, email, preferred_username)
    'user_provider_credential' => env('KEYCLOAK_USER_PROVIDER_CREDENTIAL', 'sub'),

    // The attribute to use as the local user's email
    'token_principal_attribute' => env('KEYCLOAK_TOKEN_PRINCIPAL_ATTRIBUTE', 'email'),

    // Create local user if not exists
    'create_user_if_not_exists' => env('KEYCLOAK_CREATE_USER_IF_NOT_EXISTS', true),

    /*
    |--------------------------------------------------------------------------
    | Admin Configuration
    |--------------------------------------------------------------------------
    |
    | Keycloak admin client for management operations.
    |
    */

    'admin_client_id' => env('KEYCLOAK_ADMIN_CLIENT_ID', 'admin-cli'),

    'admin_username' => env('KEYCLOAK_ADMIN_USERNAME', 'admin'),

    'admin_password' => env('KEYCLOAK_ADMIN_PASSWORD', ''),

    'admin_realm' => env('KEYCLOAK_ADMIN_REALM', 'master'),

    /*
    |--------------------------------------------------------------------------
    | Role Mapping
    |--------------------------------------------------------------------------
    |
    | Map Keycloak roles to application roles.
    |
    */

    'role_mapping' => [
        // Keycloak role => App role (ALL canonical English names)
        'candidate'    => 'candidate',
        'company'      => 'company_admin',
        'company_admin' => 'company_admin',
        'recruiter'    => 'recruiter',   // Canonical English
        'recruteur'    => 'recruiter',   // Legacy FR alias → maps to canonical
        'admin'        => 'superadmin',
        'superadmin'   => 'superadmin',
    ],

    /*
    |--------------------------------------------------------------------------
    | Keycloak Guard Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for the Keycloak token guard.
    |
    */

    // The key in the token that contains the user's identifier
    'token_user_id_claim' => env('KEYCLOAK_TOKEN_USER_ID_CLAIM', 'sub'),

    // Allow resource owner password credentials grant
    'allow_password_grant' => env('KEYCLOAK_ALLOW_PASSWORD_GRANT', true),

    // Allow client credentials grant
    'allow_client_credentials_grant' => env('KEYCLOAK_ALLOW_CLIENT_CREDENTIALS_GRANT', false),
];
