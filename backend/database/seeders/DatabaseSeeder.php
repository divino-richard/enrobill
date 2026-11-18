<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new \RuntimeException('Demo users may only be seeded in local or testing environments.');
        }

        // Demo accounts for local development and testing only.
        $users = [
            ['name' => 'Admin User', 'email' => 'admin@northlink.edu.ph', 'role' => Role::Admin],
            ['name' => 'Cashier User', 'email' => 'cashier@northlink.edu.ph', 'role' => Role::Cashier],
        ];

        foreach ($users as $user) {
            User::updateOrCreate(
                ['email' => $user['email']],
                [
                    'name' => $user['name'],
                    'role' => $user['role'],
                    'password' => Hash::make('Password@143'),
                    // Seeded accounts are pre-verified so they can sign in.
                    'email_verified_at' => now(),
                ],
            );
        }
    }
}
