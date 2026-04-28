<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        //
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        VerifyEmail::createUrlUsing(function ($notifiable) {
            $relativeSignedPath = URL::temporarySignedRoute(
                'verification.verify',
                Carbon::now()->addMinutes(Config::get('auth.verification.expire', 60)),
                [
                    'id' => $notifiable->getKey(),
                    'hash' => sha1($notifiable->getEmailForVerification()),
                ],
                false
            );

            return rtrim((string) config('app.url'), '/') . $relativeSignedPath;
        });

        // Suppress deprecation warnings in terminal (noise from PHP 8.5 vs Laravel 11)
        error_reporting(E_ALL & ~E_DEPRECATED);

        if (str_starts_with((string) config('app.url'), 'https')) {
            URL::forceScheme('https');
        }
    }
}
