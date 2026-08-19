// Constantes de negócio

export const DELIVERY_FEE_CENTS = (() => {
  const raw = process.env.DELIVERY_FEE_CENTS;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 1500; // R$ 15,00
})();

export const APP_NAME = "Idalino";
export const APP_TAGLINE = "Tortas artesanais feitas com amor";
