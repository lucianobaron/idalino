// Tipos compartilhados entre frontend e API

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  emoji: string;
  priceCents: number;
  quantity: number;
}

export interface CheckoutInput {
  name: string;
  email: string;
  phone?: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  notes?: string;
  items: CartItem[];
}
