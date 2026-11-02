import { Router } from "express";
import {
  findProduct,
  listProducts,
} from "../controllers/catalogue.controller.js";

const catalogueRouter = Router();

catalogueRouter.get("/", listProducts);
catalogueRouter.get("/:productId", findProduct);

export default catalogueRouter;
