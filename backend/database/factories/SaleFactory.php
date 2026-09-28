<?php

namespace Database\Factories;

use App\Models\Sale;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Sale>
 */
class SaleFactory extends Factory
{
    protected $model = Sale::class;

    public function definition(): array
    {
        return [
            'cashier_id' => User::factory(),
            'transaction_number' => 'TX-' . fake()->unique()->numerify('#######'),
            'total_amount' => fake()->randomFloat(2, 100, 5000),
            'status' => 'completed',
            'sold_at' => now(),
        ];
    }
}
