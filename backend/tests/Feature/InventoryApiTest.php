<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_product(): void
    {
        $admin = User::factory()->create([
            'email' => 'admin@motoparts.test',
            'role' => User::ROLE_ADMIN,
        ]);

        $category = Category::factory()->create();

        $response = $this->withToken($admin->createToken('test')->plainTextToken)
            ->postJson('/api/products', [
                'category_id' => $category->id,
                'sku' => 'BRK-001',
                'name' => 'Brake pads',
                'description' => 'Front brake pads',
                'price' => 450.00,
                'quantity' => 12,
                'reorder_level' => 4,
            ]);

        $response->assertCreated();
        $response->assertJsonPath('data.name', 'Brake pads');
        $response->assertJsonPath('data.category.name', $category->name);
    }

    public function test_user_can_create_sale_from_inventory(): void
    {
        $cashier = User::factory()->create([
            'email' => 'cashier@motoparts.test',
            'role' => User::ROLE_STAFF,
        ]);

        $category = Category::factory()->create();
        $product = Product::factory()->create([
            'category_id' => $category->id,
            'sku' => 'OIL-220',
            'name' => 'Engine oil',
            'price' => 250.00,
            'quantity' => 10,
        ]);

        $response = $this->withToken($cashier->createToken('test')->plainTextToken)
            ->postJson('/api/sales', [
                'items' => [
                    ['product_id' => $product->id, 'quantity' => 2],
                ],
            ]);

        $response->assertOk();
        $response->assertJsonPath('data.total_amount', '500.00');
        $response->assertJsonPath('data.items.0.product.name', 'Engine oil');

        $this->assertDatabaseHas('products', ['id' => $product->id, 'quantity' => 8]);
    }
}
