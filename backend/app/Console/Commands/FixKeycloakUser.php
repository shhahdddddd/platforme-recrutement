<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Services\KeycloakService;

class FixKeycloakUser extends Command
{
    protected $signature = 'keycloak:fix-user {email}';
    protected $description = 'Fix an existing Keycloak user to ensure they can log in (removes required actions)';

    public function handle(KeycloakService $keycloakService)
    {
        $email = $this->argument('email');

        $user = User::where('email', $email)->first();

        if (!$user) {
            $this->error("User not found in database: $email");
            return 1;
        }

        $this->info("Fixing Keycloak user account for: {$user->email}");
        
        $success = $keycloakService->fixUserByEmail($user->email);
        
        if ($success) {
            $this->info("✓ User account fixed! They should now be able to log in.");
            return 0;
        } else {
            $this->error("Failed to fix user. They may not exist in Keycloak.");
            $this->info("You may need to sync the user first using: php artisan keycloak:sync-user $email <password>");
            return 1;
        }
    }
}
