import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export const categorySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});
export const productSchema = z.object({
  category_id: z.coerce.number().int().positive(),
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(150),
  brand: z.string().max(120).nullable().optional(),
  barcode: z.string().max(120).nullable().optional(),
  description: z.string().nullable().optional(),
  cost_price: z.coerce.number().min(0).default(0),
  price: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(0).optional().default(0),
  reorder_level: z.coerce.number().int().min(0),
  is_active: z.boolean().optional(),
});
export const userSchema = z.object({
  name: z.string().min(1).max(150),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "staff"]),
  is_active: z.boolean().optional(),
});
export const stockInSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  supplier_id: z.coerce.number().int().positive().nullable().optional(),
  quantity: z.coerce.number().int().min(1),
  reference: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
});
export const supplierSchema = z.object({
  name: z.string().min(1).max(150),
  contact_person: z.string().max(150).nullable().optional(),
  phone: z.string().max(60).nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  is_active: z.boolean().optional(),
});
export const stockAdjustmentSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1),
  reason: z.string().min(1).max(255),
});
export const notificationSchema = z.object({
  title: z.string().min(1).max(150),
  message: z.string().min(1).max(500),
  type: z.string().min(1).max(40).default("info"),
});
export const saleSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1),
      }),
    )
    .min(1),
    payment_amount: z.coerce.number().min(0),
    payment_method: z.enum(["cash", "gcash", "card"]).default("cash"),
});

export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new Error("Validation failed.");
    error.status = 422;
    error.details = result.error.flatten().fieldErrors;
    throw error;
  }
  return result.data;
}
