<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Product::with('category')->latest()->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'category_id' => ['required', 'exists:categories,id'],
            'sku' => ['required', 'string', 'max:100', Rule::unique('products', 'sku')],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'quantity' => ['required', 'integer', 'min:0'],
            'reorder_level' => ['required', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $validated['is_active'] = $validated['is_active'] ?? true;

        $product = Product::create($validated);

        return response()->json([
            'message' => 'Product created successfully.',
            'data' => $product->load('category'),
        ], 201);
    }

    public function show(Product $product)
    {
        return response()->json([
            'data' => $product->load('category'),
        ]);
    }

    public function update(Request $request, Product $product)
    {
        $validated = $request->validate([
            'category_id' => ['sometimes', 'exists:categories,id'],
            'sku' => ['sometimes', 'string', 'max:100', Rule::unique('products', 'sku')->ignore($product->id)],
            'name' => ['sometimes', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'quantity' => ['sometimes', 'integer', 'min:0'],
            'reorder_level' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $product->update($validated);

        return response()->json([
            'message' => 'Product updated successfully.',
            'data' => $product->fresh()->load('category'),
        ]);
    }

    public function destroy(Product $product)
    {
        $product->delete();

        return response()->json([
            'message' => 'Product deleted successfully.',
        ]);
    }
}
