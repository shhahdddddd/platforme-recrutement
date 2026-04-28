<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Services\KeycloakService;
use Illuminate\Support\Facades\Log;

class SyncUserToKeycloak extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'keycloak:sync-user {email} {password}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync an existing user to Keycloak';

    /**
     * Execute the console command.
     */
    public function handle(KeycloakService $keycloakService)
    {
        $email = $this->argument('email');
        $password = $this->argument('password');

        $user = User::where('email', $email)->first();

        if (!$user) {
            $this->error("User not found: $email");
            return 1;
        }

        $this->info("Syncing user: {$user->email} (ID: {$user->id}, Role: {$user->role})");

        $userData = [
            'email' => $user->email,
            'password' => $password,
            'role' => $user->role,
        ];

        $keycloakUserId = $keycloakService->createKeycloakUser($userData);

        if ($keycloakUserId) {
            $this->info("✓ User synced to Keycloak successfully (Keycloak ID: $keycloakUserId)");
            
            // Also ensure the account is fully enabled
            $this->info("Ensuring account is fully enabled...");
            try {
                $keycloakService->ensureUserFullySetup($keycloakUserId);
                $this->info("✓ Account fully enabled");
            } catch (\Exception $e) {
                $this->warn("⚠ Could not verify account status: " . $e->getMessage());
            }
            
            return 0;
        } else {
            $this->error("✗ Failed to sync user to Keycloak. Check logs for details.");
            return 1;
        }
    }
    
}
