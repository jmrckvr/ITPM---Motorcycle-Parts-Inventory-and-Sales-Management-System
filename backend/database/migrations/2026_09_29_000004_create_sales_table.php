<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cashier_id')->constrained('users')->onDelete('cascade');
            $table->string('transaction_number')->unique();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->enum('status', ['completed', 'cancelled'])->default('completed');
            $table->timestamp('sold_at')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
