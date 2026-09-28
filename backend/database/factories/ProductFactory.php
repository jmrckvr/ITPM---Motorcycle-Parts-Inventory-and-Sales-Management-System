<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'category_id' => Category::factory(),
            'sku' => strtoupper(fake()->bothify('???-###')),
            'name' => fake()->words(2, true),
            'description' => fake()->sentence(),
            'price' => fake()->randomFloat(2, 50, 2000),
            'quantity' => fake()->numberBetween(1, 50),
            'reorder_level' => fake()->numberBetween(1, 10),
            'is_active' => true,
        ];
    }
}
