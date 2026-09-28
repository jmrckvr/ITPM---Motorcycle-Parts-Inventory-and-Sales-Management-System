<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockMovement>
 */
class StockMovementFactory extends Factory
{
    protected $model = StockMovement::class;

    public function definition(): array
    {
        $product = Product::factory()->create();

        return [
            'product_id' => $product->id,
            'user_id' => User::factory(),
            'type' => fake()->randomElement(['stock_in', 'stock_out', 'sale']),
            'quantity' => fake()->numberBetween(1, 20),
            'quantity_after' => $product->quantity,
            'reference' => fake()->bothify('REF-####'),
            'notes' => fake()->sentence(),
            'created_at' => now(),
        ];
    }
}
