import { sendOrderConfirmation } from "../services/whatsapp.service.js";

const phone = process.argv[2];

if (!phone) {
  console.error("Usage: npm run whatsapp:test -- +919876543210");
  process.exit(1);
}

const result = await sendOrderConfirmation({
  orderId: "00000000-0000-0000-0000-000000000000",
  contactName: "Demo Customer",
  contactPhone: phone,
  totalMonthlyMin: 1499,
  totalMonthlyMax: 1999,
  estimatedActivationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10),
});

console.log(result);

if (result.status === "failed") {
  process.exitCode = 1;
}
