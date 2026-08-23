"use client";

import { useEffect } from "react";

import { useCart } from "@/components/cart/cart-provider";

/** The order exists server-side; the local cart is now history. */
export function ClearCartOnMount() {
  const { clear, hydrated } = useCart();

  useEffect(() => {
    if (hydrated) clear();
  }, [hydrated, clear]);

  return null;
}
