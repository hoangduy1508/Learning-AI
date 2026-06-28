import { z } from "zod";

import { FileToolError } from "../filesystem/service.js";

export const orderStatusToolInputSchema = z.object({
  orderId: z.string().trim().regex(/^ord_[a-z0-9]+$/u, "orderId must look like ord_123")
});

export type OrderStatusToolInput = z.infer<typeof orderStatusToolInputSchema>;

export interface OrderStatusToolResult {
  orderId: string;
  status: "processing" | "shipped" | "delivered" | "cancelled";
  ownerUserId: string;
  updatedAt: string;
  items: Array<{ sku: string; name: string; quantity: number }>;
  source: "fake-order-store";
}

interface FakeOrderRecord extends OrderStatusToolResult {
  ownerUserId: string;
}

const fakeOrders: Record<string, FakeOrderRecord> = {
  ord_1001: {
    orderId: "ord_1001",
    status: "shipped",
    ownerUserId: "user_demo",
    updatedAt: "2026-06-26T10:30:00.000Z",
    items: [{ sku: "sku_keyboard", name: "Mechanical Keyboard", quantity: 1 }],
    source: "fake-order-store"
  },
  ord_2002: {
    orderId: "ord_2002",
    status: "processing",
    ownerUserId: "user_demo",
    updatedAt: "2026-06-27T08:15:00.000Z",
    items: [{ sku: "sku_mouse", name: "Wireless Mouse", quantity: 2 }],
    source: "fake-order-store"
  },
  ord_9009: {
    orderId: "ord_9009",
    status: "delivered",
    ownerUserId: "user_other",
    updatedAt: "2026-06-20T14:45:00.000Z",
    items: [{ sku: "sku_monitor", name: "4K Monitor", quantity: 1 }],
    source: "fake-order-store"
  }
};

export function getFakeOrderStatus(input: unknown, currentUserId: string): OrderStatusToolResult {
  const parsed = orderStatusToolInputSchema.parse(input);
  const order = fakeOrders[parsed.orderId];

  if (!order) {
    throw new FileToolError("Order not found", 404);
  }

  if (order.ownerUserId !== currentUserId) {
    throw new FileToolError("Order does not belong to the current user", 403);
  }

  return order;
}
