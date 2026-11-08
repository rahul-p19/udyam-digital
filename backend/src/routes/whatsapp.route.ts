import { Router } from "express";
import { receiveWebhook } from "../controllers/whatsapp.controller.js";

const whatsappRouter = Router();

whatsappRouter.post("/webhook", receiveWebhook);

export default whatsappRouter;
