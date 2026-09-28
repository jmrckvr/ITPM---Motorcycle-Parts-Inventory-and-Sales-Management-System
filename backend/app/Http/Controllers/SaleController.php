<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SaleController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Sale::with(['cashier', 'items.product'])->latest('sold_at')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);

        $saleItems = [];
        $totalAmount = 0;

        DB::transaction(function () use (&$saleItems, &$totalAmount, $validated, $request) {
            foreach ($validated['items'] as $itemData) {
                $product = Product::lockForUpdate()->findOrFail($itemData['product_id']);

                if ($product->quantity < $itemData['quantity']) {
                    abort(422, "Insufficient stock for {$product->name}.");
                }

                $unitPrice = $product->price;
                $lineTotal = $unitPrice * $itemData['quantity'];

                $saleItems[] = [
                    'product_id' => $product->id,
                    'quantity' => $itemData['quantity'],
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                ];

                $totalAmount += $lineTotal;
                $product->quantity -= $itemData['quantity'];
                $product->save();

                StockMovement::create([
                    'product_id' => $product->id,
                    'user_id' => $request->user()->id,
                    'type' => 'sale',
                    'quantity' => $itemData['quantity'],
                    'quantity_after' => $product->quantity,
                    'reference' => 'SALE',
                    'notes' => 'Sale transaction',
                    'created_at' => now(),
                ]);
            }
        });

        $sale = Sale::create([
            'cashier_id' => $request->user()->id,
            'transaction_number' => 'TX-' . strtoupper(Str::random(8)),
            'total_amount' => $totalAmount,
            'status' => 'completed',
            'sold_at' => now(),
        ]);

        foreach ($saleItems as $item) {
            $sale->items()->create($item);
        }

        $sale->load(['cashier', 'items.product']);

        return response()->json([
            'message' => 'Sale processed successfully.',
            'data' => $sale,
        ]);
    }

    public function show(Sale $sale)
    {
        return response()->json([
            'data' => $sale->load(['cashier', 'items.product']),
        ]);
    }
}
