<?php

namespace App\Policies;

use App\Models\Campaign;
use App\Models\User;

class CampaignPolicy
{
    /** A campaign belongs to exactly one user; only its owner may touch it. */
    private function owns(User $user, Campaign $campaign): bool
    {
        return $campaign->user_id === $user->id;
    }

    public function view(User $user, Campaign $campaign): bool
    {
        return $this->owns($user, $campaign);
    }

    public function update(User $user, Campaign $campaign): bool
    {
        return $this->owns($user, $campaign);
    }

    public function delete(User $user, Campaign $campaign): bool
    {
        return $this->owns($user, $campaign);
    }
}
