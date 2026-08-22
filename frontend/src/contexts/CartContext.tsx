import React, { createContext, useContext, useState } from "react";
import { ComponentItem } from "../types";

export interface CartItem {
  component: ComponentItem;
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (component: ComponentItem, qty?: number) => void;
  removeFromCart: (componentId: string) => void;
  updateCartQuantity: (componentId: string, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (component: ComponentItem, qty = 1) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.component.id === component.id,
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = Math.min(
          component.available_stock,
          updated[existingIndex].quantity + qty,
        );
        updated[existingIndex].quantity = newQty;
        return updated;
      }
      return [
        ...prev,
        { component, quantity: Math.min(component.available_stock, qty) },
      ];
    });
  };

  const removeFromCart = (componentId: string) => {
    setCart((prev) => prev.filter((item) => item.component.id !== componentId));
  };

  const updateCartQuantity = (componentId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(componentId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.component.id === componentId) {
          const maxQty = item.component.available_stock;
          return { ...item, quantity: Math.min(maxQty, qty) };
        }
        return item;
      }),
    );
  };

  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        totalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
