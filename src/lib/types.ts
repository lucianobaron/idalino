// Tipos compartilhados entre frontend e API

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  emoji: string;
  priceCents: number;
  quantity: number;
  /**
   * Foto da torta resolvida no momento da adição (mesma regra da vitrine:
   * `imageUrl` real, senão foto ilustrativa por ordem de exibição) — snapshot
   * para o thumb do carrinho (§3.7 / TECNICO §2). Itens antigos no
   * localStorage, sem este campo, caem no emoji.
   */
  imageUrl?: string;
}

export interface CheckoutInput {
  name: string;
  email: string;
  phone?: string;
  deliveryType?: "DELIVERY" | "PICKUP";
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  items: CartItem[];
}
