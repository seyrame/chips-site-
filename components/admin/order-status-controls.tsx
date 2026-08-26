"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  refundOrderAction,
  updateOrderStatusAction,
  type OrderActionState,
} from "@/app/actions/admin-orders";
import { ORDER_TRANSITIONS, STATUS_LABELS } from "@/lib/order-workflow";
import type { OrderStatus } from "@/types/database";

function StatusButton({
  next,
  danger,
}: {
  next: OrderStatus;
  danger: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="status"
      value={next}
      disabled={pending}
      className={
        danger
          ? "h-9 rounded-full border border-red-300 px-4 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
          : "h-9 rounded-full bg-forest px-4 text-xs font-semibold text-cream hover:bg-forest-soft disabled:opacity-60"
      }
    >
      {pending ? "…" : `Mark ${STATUS_LABELS[next]}`}
    </button>
  );
}

function RefundButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 rounded-full border border-toast/40 px-4 text-xs font-semibold text-toast-dark hover:bg-cream-dark disabled:opacity-60"
    >
      {pending ? "Refunding…" : "Refund in full"}
    </button>
  );
}

export function OrderFulfilmentControls({
  orderId,
  currentStatus,
  canRefund,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  canRefund: boolean;
}) {
  const [statusState, statusAction] = useActionState<OrderActionState, FormData>(
    updateOrderStatusAction,
    {}
  );
  const [cancelState, cancelAction] = useActionState<OrderActionState, FormData>(
    updateOrderStatusAction,
    {}
  );
  const [refundState, refundAction] = useActionState<OrderActionState, FormData>(
    refundOrderAction,
    {}
  );

  const transitions = ORDER_TRANSITIONS[currentStatus].filter((s) => s !== "CANCELLED");
  const canCancel = ORDER_TRANSITIONS[currentStatus].includes("CANCELLED");
  const terminal = transitions.length === 0 && !canCancel;

  return (
    <div className="grid gap-5">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
          Fulfilment workflow
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {terminal ? (
            <span className="text-sm text-charcoal/70">
              This order is {STATUS_LABELS[currentStatus].toLowerCase()} — no further
              changes.
            </span>
          ) : null}

          {transitions.length > 0 ? (
            <form action={statusAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="orderId" value={orderId} />
              {transitions.map((next) => (
                <StatusButton key={next} next={next} danger={false} />
              ))}
            </form>
          ) : null}

          {canCancel ? (
            <form
              action={cancelAction}
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                if (
                  !window.confirm(
                    "Cancel this order? Stock will be returned to inventory."
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="status" value="CANCELLED" />
              <StatusButton next="CANCELLED" danger />
            </form>
          ) : null}
        </div>
        {[statusState, cancelState].map((s, i) =>
          s.error ? (
            <p key={i} role="alert" className="mt-2 text-xs text-red-700">
              {s.error}
            </p>
          ) : s.message ? (
            <p key={i} role="status" className="mt-2 text-xs text-forest">
              ✓ {s.message}
            </p>
          ) : null
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
          Payments
        </h3>
        {canRefund ? (
          <form
            action={refundAction}
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              if (!window.confirm("Refund the FULL order amount via Paystack?")) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="orderId" value={orderId} />
            <RefundButton />
            {refundState.error ? (
              <span role="alert" className="max-w-md text-xs text-red-700">
                {refundState.error}
              </span>
            ) : null}
            {refundState.message ? (
              <span role="status" className="max-w-md text-xs text-forest">
                ✓ {refundState.message}
              </span>
            ) : null}
          </form>
        ) : (
          <p className="mt-2 text-sm text-charcoal/60">
            Refunds appear here once the order has a settled payment.
          </p>
        )}
      </div>
    </div>
  );
}
