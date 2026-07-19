<?php
use App\Models\User;
it('renders the settings screen with tabs and toggles', function () {
    $user = User::factory()->create();
    $r = $this->actingAs($user)->get('/settings');
    $r->assertOk();
    $r->assertSee('data-settings-form', false);
    $r->assertSee('data-setting="reduceMotion"', false);
    $r->assertSee('data-setting="master"', false);
});
