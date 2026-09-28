<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Product::with('category')->orderBy('quantity')->get(),
        ]);
    }

    public function stockMovements()
    {
        return response()->json([
            'data' => StockMovement::with(['product', 'user'])->latest('created_at')->get(),
        ]);
    }

    public function stockIn(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
        ]);

        $product = Product::findOrFail($validated['product_id']);
        $product->quantity += $validated['quantity'];
        $product->save();

        $movement = StockMovement::create([
            'product_id' => $product->id,
            'user_id' => $request->user()->id,
            'type' => 'stock_in',
            'quantity' => $validated['quantity'],
            'quantity_after' => $product->quantity,
            'reference' => $validated['reference'] ?? 'STOCK-IN',
            'notes' => $validated['notes'] ?? 'Inventory stock-in',
            'created_at' => now(),
        ]);

        return response()->json([
            'message' => 'Stock moved in successfully.',
            'data' => $movement->load(['product', 'user']),
        ], 201);
    }
}
