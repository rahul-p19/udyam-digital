import type { Request, Response } from "express";
import { getProduct, getProducts } from "../services/catalogue.service.js";

export async function listProducts(_req: Request, res: Response): Promise<void> {
  const products = await getProducts();
  res.json({ products });
}

export async function findProduct(req: Request, res: Response): Promise<void> {
  const product = await getProduct(req.params.productId);

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json({ product });
}
