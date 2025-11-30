<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Cart;
use App\Models\Bread;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    /**
     * Create order from cart (customer only)
     */
    public function createOrder(Request $request)
    {
        $user = $request->user;

        // Validate request
        $request->validate([
            'payment_method' => 'required|in:cash_on_delivery,credit_card,debit_card,paypal,gcash,maya',
            'shipping_method' => 'required|in:pickup,standard,express,same_day',
            'shipping_address' => 'required|string',
            'address_id' => 'nullable|exists:addresses,id',
            'cart_item_ids' => 'nullable|array',
            'cart_item_ids.*' => 'exists:carts,id',
        ]);

        // Get selected cart items or all cart items if none specified
        $query = Cart::where('user_id', $user->id)->with('bread');
        
        if ($request->has('cart_item_ids') && is_array($request->cart_item_ids) && !empty($request->cart_item_ids)) {
            // Only process selected cart items
            $query->whereIn('id', $request->cart_item_ids);
        }
        
        $cartItems = $query->get();

        if ($cartItems->isEmpty()) {
            return response()->json(['message' => 'No items selected for checkout'], 400);
        }

        // Validate stock availability
        foreach ($cartItems as $cartItem) {
            if (($cartItem->bread->stock_quantity ?? 0) < $cartItem->quantity) {
                return response()->json([
                    'message' => 'Insufficient stock for ' . $cartItem->bread->name . '. Available: ' . ($cartItem->bread->stock_quantity ?? 0)
                ], 400);
            }
        }

        DB::beginTransaction();

        try {
            // Calculate total
            $totalAmount = $cartItems->sum(function ($item) {
                return $item->quantity * $item->bread->price;
            });

            // Get shipping address
            $shippingAddress = $request->shipping_address;
            if ($request->address_id) {
                $address = \App\Models\Address::where('id', $request->address_id)
                    ->where('user_id', $user->id)
                    ->first();
                if ($address) {
                    // Use the simplified address field directly
                    $shippingAddress = $address->address;
                }
            }

            // Determine payment status based on payment method
            $paymentStatus = $request->payment_method === 'cash_on_delivery' ? 'pending' : 'paid';

            // Create order
            $order = Order::create([
                'user_id' => $user->id,
                'total_amount' => $totalAmount,
                'status' => 'pending',
                'payment_method' => $request->payment_method,
                'payment_status' => $paymentStatus,
                'shipping_method' => $request->shipping_method,
                'shipping_address' => $shippingAddress,
            ]);

            // Create order items and update stock
            foreach ($cartItems as $cartItem) {
                $subtotal = $cartItem->quantity * $cartItem->bread->price;

                OrderItem::create([
                    'order_id' => $order->id,
                    'bread_id' => $cartItem->bread_id,
                    'quantity' => $cartItem->quantity,
                    'price' => $cartItem->bread->price,
                    'subtotal' => $subtotal,
                ]);

                // Update bread stock
                $newStock = ($cartItem->bread->stock_quantity ?? 0) - $cartItem->quantity;
                $cartItem->bread->update(['stock_quantity' => max(0, $newStock)]);
            }

            // Remove only the cart items that were included in the order
            $cartItemIds = $cartItems->pluck('id')->toArray();
            Cart::whereIn('id', $cartItemIds)->delete();

            DB::commit();

            $order->load('items.bread');

            return response()->json([
                'message' => 'Order created successfully',
                'order' => [
                    'id' => $order->id,
                    'user_id' => $order->user_id,
                    'total_amount' => $order->total_amount,
                    'status' => $order->status,
                    'items' => $order->items->map(function ($item) {
                        return [
                            'id' => $item->id,
                            'bread_id' => $item->bread_id,
                            'quantity' => $item->quantity,
                            'price' => $item->price,
                            'subtotal' => $item->subtotal,
                            'bread' => [
                                'id' => $item->bread->id,
                                'name' => $item->bread->name,
                                'image_path' => $item->bread->image_path,
                            ],
                        ];
                    }),
                    'payment_method' => $order->payment_method,
                    'payment_status' => $order->payment_status,
                    'shipping_method' => $order->shipping_method,
                    'shipping_address' => $order->shipping_address,
                    'created_at' => $order->created_at,
                ]
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Order creation failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['message' => 'Failed to create order: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get user's orders (customer only)
     */
    public function getOrders(Request $request)
    {
        $user = $request->user;

        $orders = Order::where('user_id', $user->id)
            ->with('items.bread')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($order) {
                return [
                    'id' => $order->id,
                    'total_amount' => $order->total_amount,
                    'status' => $order->status,
                    'item_count' => $order->items->count(),
                    'items' => $order->items->map(function ($item) {
                        return [
                            'id' => $item->id,
                            'bread_id' => $item->bread_id,
                            'quantity' => $item->quantity,
                            'price' => $item->price,
                            'subtotal' => $item->subtotal,
                            'bread' => [
                                'id' => $item->bread->id,
                                'name' => $item->bread->name,
                                'image_path' => $item->bread->image_path,
                            ],
                        ];
                    }),
                    'created_at' => $order->created_at,
                    'updated_at' => $order->updated_at,
                ];
            });

        return response()->json($orders);
    }

    /**
     * Get order details (customer only)
     */
    public function getOrder($id)
    {
        $user = request()->user;

        $order = Order::where('id', $id)
            ->where('user_id', $user->id)
            ->with('items.bread')
            ->first();

        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return response()->json([
            'id' => $order->id,
            'user_id' => $order->user_id,
            'total_amount' => $order->total_amount,
            'status' => $order->status,
            'items' => $order->items->map(function ($item) {
                return [
                    'id' => $item->id,
                    'bread_id' => $item->bread_id,
                    'quantity' => $item->quantity,
                    'price' => $item->price,
                    'subtotal' => $item->subtotal,
                    'bread' => [
                        'id' => $item->bread->id,
                        'name' => $item->bread->name,
                        'description' => $item->bread->description,
                        'image_path' => $item->bread->image_path,
                    ],
                ];
            }),
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'shipping_method' => $order->shipping_method,
            'shipping_address' => $order->shipping_address,
            'created_at' => $order->created_at,
            'updated_at' => $order->updated_at,
        ]);
    }

    /**
     * Format address object to string
     */
    private function formatAddress($address)
    {
        $parts = [
            $address->recipient_name,
            $address->address_line1,
            $address->address_line2,
            $address->city,
            $address->province,
            $address->postal_code,
            $address->country,
        ];
        
        return implode(', ', array_filter($parts));
    }

    /**
     * Cancel order (customer only, if pending)
     */
    public function cancelOrder(Request $request, $id)
    {
        $user = $request->user;

        $order = Order::where('id', $id)
            ->where('user_id', $user->id)
            ->with('items.bread')
            ->first();

        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        if ($order->status !== 'pending') {
            return response()->json([
                'message' => 'Only pending orders can be cancelled'
            ], 400);
        }

        DB::beginTransaction();

        try {
            // Restore stock
            foreach ($order->items as $item) {
                $bread = $item->bread;
                $newStock = ($bread->stock_quantity ?? 0) + $item->quantity;
                $bread->update(['stock_quantity' => $newStock]);
            }

            // Update order status
            $order->update(['status' => 'cancelled']);

            DB::commit();

            return response()->json([
                'message' => 'Order cancelled successfully',
                'order' => [
                    'id' => $order->id,
                    'status' => $order->status,
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Order cancellation failed', [
                'order_id' => $order->id,
                'error' => $e->getMessage()
            ]);
            return response()->json(['message' => 'Failed to cancel order'], 500);
        }
    }
}
