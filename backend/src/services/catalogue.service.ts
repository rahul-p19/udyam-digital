import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Product } from "../types/product.js";

const cataloguePath = fileURLToPath(
  new URL("../../data/product_catalogue.json", import.meta.url),
);

let catalogue: Product[] | undefined;

async function loadCatalogue(): Promise<Product[]> {
  if (!catalogue) {
    const contents = await readFile(cataloguePath, "utf8");
    catalogue = JSON.parse(contents) as Product[];
  }

  return catalogue;
}

export async function getProducts(): Promise<Product[]> {
  return loadCatalogue();
}

export async function getProduct(productId: string): Promise<Product | undefined> {
  const products = await loadCatalogue();
  return products.find((product) => product.productId === productId);
}
