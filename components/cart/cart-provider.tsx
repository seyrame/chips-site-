"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { CONFIG } from "@/lib/config/site";
import type { ReactNode } from "react";

import type { CartItem } from "@/types";

const STORAGE_KEY = "tt-cart-v1";
const MAX_LINES = 50;

interface CartContextValue {
  items: CartItem[];
  hydrated: boolean;
  count: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity: number) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function readStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive shape check — never trust storage contents.
    return parsed.filter(
      (i): i is CartItem =>
        typeof i === "object" &&
        i !== null &&
        typeof (i as CartItem).variantId === "string" &&
        typeof (i as CartItem).quantity === "number" &&
        (i as CartItem).quantity > 0 &&
        typeof (i as CartItem).unitPrice === "number" &&
        Number.isFinite((i as CartItem).unitPrice) &&
        (i as CartItem).unitPrice >= 0 &&
        typeof (i as CartItem).maxQuantity === "number" &&
        (i as CartItem).maxQuantity > 0
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // One-time rehydration from localStorage after mount. Server render
  // always sees an empty cart; this deliberate second pass avoids an
  // SSR/client markup mismatch, so the synchronous setStates are intended.
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time rehydrate */
    setItems(readStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full or unavailable — cart works in-memory for this session.
    }
  }, [items, hydrated]);

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity">, quantity: number) => {
      setItems((current) => {
        const existing = current.find((i) => i.variantId === item.variantId);
        if (existing) {
          return current.map((i) =>
            i.variantId === item.variantId
              ? { ...i, quantity: Math.max(1, Math.min(i.quantity + quantity, i.maxQuantity, CONFIG.maxLineQuantity)) }
              : i
          );
        }
        if (current.length >= MAX_LINES) return current;
        return [
          ...current,
          { ...item, quantity: Math.max(1, Math.min(quantity, item.maxQuantity, CONFIG.maxLineQuantity)) },
        ];
      });
    },
    []
  );

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    setItems((current) =>
      current.map((i) =>
        i.variantId === variantId
          ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxQuantity, CONFIG.maxLineQuantity)) }
          : i
      )
    );
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((current) => current.filter((i) => i.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    return {
      items,
      hydrated,
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
      addItem,
      updateQuantity,
      removeItem,
      clear,
    };
  }, [items, hydrated, addItem, updateQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
