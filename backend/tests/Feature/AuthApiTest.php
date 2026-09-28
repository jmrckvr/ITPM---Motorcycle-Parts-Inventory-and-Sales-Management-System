<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_log_in_and_receive_token(): void
    {
        User::factory()->create([
            'name' => 'Admin User',
            'email' => 'admin@motoparts.test',
            'password' => 'password123',
            'role' => 'admin',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@motoparts.test',
            'password' => 'password123',
        ]);

        $response->assertOk();
        $response->assertJsonPath('user.email', 'admin@motoparts.test');
        $response->assertJsonPath('user.role', 'admin');
        $response->assertJsonStructure([
            'token',
            'user' => ['id', 'name', 'email', 'role'],
        ]);
    }
}
