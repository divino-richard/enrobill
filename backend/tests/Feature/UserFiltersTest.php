<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserFiltersTest extends TestCase
{
    use RefreshDatabase;

    public function test_filters_apply_before_pagination_and_combine_with_role_and_search(): void
    {
        $this->travelTo(now()->startOfDay());
        $admin = User::factory()->create(['role' => Role::Admin]);
        $match = User::factory()->unverified()->create(['role' => Role::Student, 'name' => 'Filter match', 'created_at' => now()->subDays(3)]);
        User::factory()->create(['role' => Role::Student, 'name' => 'Filter verified']);
        User::factory()->unverified()->create(['role' => Role::Student, 'name' => 'Filter old', 'created_at' => now()->subDays(40)]);
        User::factory()->unverified()->create(['role' => Role::Teacher, 'name' => 'Filter teacher']);

        $this->actingAs($admin)->getJson('/api/users?role=student&search=Filter&verified=unverified&joined=7&per_page=1')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $match->id);
        $this->actingAs($admin)->getJson('/api/users?role=student&verified=verified')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.emailVerified', true);
        $this->actingAs($admin)->getJson('/api/users?role=student&verified=all&joined=all')
            ->assertOk()->assertJsonPath('meta.total', 3);
    }
}
