<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SaleController;
use App\Http\Controllers\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::get('/dashboard/summary', fn () => ['status' => 'ok']);

    Route::apiResource('products', ProductController::class);
    Route::apiResource('categories', CategoryController::class);
    Route::get('/inventory', [InventoryController::class, 'index']);
    Route::get('/stock-movements', [InventoryController::class, 'stockMovements']);
    Route::post('/stock-movements', [InventoryController::class, 'stockIn']);
    Route::get('/sales', [SaleController::class, 'index']);
    Route::post('/sales', [SaleController::class, 'store']);
    Route::get('/sales/{sale}', [SaleController::class, 'show']);
    Route::get('/reports/sales', [ReportController::class, 'sales']);
    Route::get('/reports/inventory', [ReportController::class, 'inventory']);
});

Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::get('/admin/health', fn () => ['status' => 'admin']);
    Route::apiResource('users', UserController::class);
});
