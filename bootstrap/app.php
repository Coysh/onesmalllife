<?php

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withSchedule(function (Schedule $schedule): void {
        // Mints today's daily seed and (once a week) this week's weekly seed —
        // see App\Console\Commands\GenerateChallengeSeeds for why running this
        // daily is enough to cover both periods.
        $schedule->command('challenges:generate')->dailyAt('00:00');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Render JSON errors (e.g. 422 validation) for api/* paths and for any
        // request that expects JSON — the in-game save endpoint posts JSON.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
