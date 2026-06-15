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
        // One account per role for development/testing. Password: "password".
        $users = [
            ['name' => 'Admin User', 'email' => 'admin@northlink.edu.ph', 'role' => Role::Admin],
            ['name' => 'Cashier User', 'email' => 'cashier@northlink.edu.ph', 'role' => Role::Cashier],
            ['name' => 'Student User', 'email' => 'student@northlink.edu.ph', 'role' => Role::Student],
            ['name' => 'Applicant User', 'email' => 'applicant@northlink.edu.ph', 'role' => Role::Applicant],
        ];

        foreach ($users as $user) {
            User::updateOrCreate(
                ['email' => $user['email']],
                [
                    'name' => $user['name'],
                    'role' => $user['role'],
                    'password' => Hash::make('password'),
                ],
            );
        }
    }
}
