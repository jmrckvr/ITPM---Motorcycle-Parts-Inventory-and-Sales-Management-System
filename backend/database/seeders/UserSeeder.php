<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => 'admin@motoparts.test'],
            [
                'name' => 'Alex Dela Cruz',
                'password' => bcrypt('password123'),
                'role' => User::ROLE_ADMIN,
            ],
        );

        User::query()->updateOrCreate(
            ['email' => 'staff@motoparts.test'],
            [
                'name' => 'Maria Santos',
                'password' => bcrypt('password123'),
                'role' => User::ROLE_STAFF,
            ],
        );
    }
}
