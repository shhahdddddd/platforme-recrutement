<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Services\KeycloakService;

class FixAllKeycloakUsers extends Command
{
    protected $signature = 'keycloak:fix-all-companies';
    protected $description = 'Fix all existing COMPANY users in Keycloak to ensure they can log in';

    public function handle(KeycloakService $keycloakService)
    {
        $users = User::where('role', 'COMPANY')->get();

        if ($users->isEmpty()) {
            $this->info("No COMPANY users found.");
            return 0;
        }

        $this->info("Found " . $users->count() . " COMPANY user(s) to fix.");
        $this->newLine();

        $fixed = 0;
        $failed = 0;

        foreach ($users as $user) {
            $this->info("Fixing: {$user->email}...");
            
            $success = $keycloakService->fixUserByEmail($user->email);
            
            if ($success) {
                $this->info("  ✓ Fixed successfully");
                $fixed++;
            } else {
                $this->warn("  ✗ Failed (user may not exist in Keycloak)");
                $failed++;
            }
            $this->newLine();
        }

        $this->info("Summary:");
        $this->info("  Fixed: {$fixed}");
        $this->info("  Failed: {$failed}");
        
        if ($failed > 0) {
            $this->warn("Some users failed. They may need to be synced to Keycloak first using: php artisan keycloak:sync-user <email> <password>");
        }

        return 0;
    }
}
