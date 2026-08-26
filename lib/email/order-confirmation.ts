/**
 * Order email templates — ready for integration with any email provider
 * (Resend, SendGrid, Postmark, AWS SES, etc.).
 *
 * Currently generates HTML strings. To send emails, import the template
 * function and pass the result to your email provider's send() method.
 *
 * Usage:
 *   import { orderConfirmationHtml } from "@/lib/email/order-confirmation";
 *   const html = orderConfirmationHtml({ orderNumber, items, total, ... });
 *   await resend.send({ to: email, subject: "...", html });
 */

import { BRAND } from "@/lib/config/site";
import { formatMoney } from "@/utils/money";

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  items: Array<{
    name: string;
    variantName: string;
    quantity: number;
    unitPrice: number;
  }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryRegion: string;
  deliveryCity: string;
  deliveryAddress: string;
}

function row(label: string, value: string, bold = false): string {
  return `<div style="display:flex;justify-content:space-between;padding:4px 0;${bold ? "font-weight:700;font-size:18px;margin-top:8px;" : ""}">
    <span>${label}</span>
    <span>${value}</span>
  </div>`;
}

export function orderConfirmationHtml(data: OrderEmailData): string {
  const items = data.items
    .map(
      (item) => `
    <div class="item">
      <div class="item-name">${item.name} — ${item.variantName}</div>
      <div class="item-detail">${item.quantity}× ${formatMoney(item.unitPrice)} = ${formatMoney(item.unitPrice * item.quantity)}</div>
    </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body>
  <div class="container">
    <div class="header">
      <h1>${BRAND.name}</h1>
      <p>Order Confirmation</p>
    </div>
    <div class="body">
      <h2>Thank you, ${data.customerName}!</h2>
      <p>Your order <strong>${data.orderNumber}</strong> has been received and is being prepared.</p>

      <div style="margin-top:24px">
        ${items}
      </div>

      <div class="totals">
        ${row("Subtotal", formatMoney(data.subtotal))}
        ${row("Delivery", data.deliveryFee === 0 ? "Free" : formatMoney(data.deliveryFee))}
        ${row("Total", formatMoney(data.total), true)}
      </div>

      <div style="margin-top:24px;padding:16px;background:#f9f7f3;border-radius:12px;">
        <p style="margin:0;font-size:13px;color:#666;">
          <strong>Delivery to:</strong><br/>
          ${data.deliveryAddress}<br/>
          ${data.deliveryCity}, ${data.deliveryRegion}
        </p>
      </div>
    </div>
    <div class="footer">
      Questions? Reply to this email or message us on WhatsApp.<br/>
      &copy; ${new Date().getFullYear()} ${BRAND.name} &middot; Made in Ghana &middot; Built by Komla
    </div>
  </div>
</body>
</html>`;
}

export function orderConfirmationSubject(orderNumber: string): string {
  return `${BRAND.name} — Order ${orderNumber} confirmed`;
}
