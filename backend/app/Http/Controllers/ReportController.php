<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Sale;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function sales(Request $request)
    {
        $sales = Sale::with('cashier')
            ->when($request->query('from'), fn ($query, $from) => $query->whereDate('sold_at', '>=', $from))
            ->when($request->query('to'), fn ($query, $to) => $query->whereDate('sold_at', '<=', $to))
            ->orderBy('sold_at', 'desc')
            ->get();

        return response()->json([
            'data' => $sales,
            'summary' => [
                'total_sales' => $sales->sum('total_amount'),
                'transaction_count' => $sales->count(),
            ],
        ]);
    }

    public function inventory()
    {
        return response()->json([
            'data' => Product::with('category')
                ->selectRaw('*, quantity as stock_on_hand, CASE WHEN quantity <= reorder_level THEN 1 ELSE 0 END as low_stock')
                ->orderBy('quantity')
                ->get(),
        ]);
    }
}
