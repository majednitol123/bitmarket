export function formatDollar(amount: number): string {
  const safeAmount = isNaN(amount) || amount === undefined ? 0 : amount;
  
  let decimals = 2;
  if (safeAmount > 0 && safeAmount < 0.01) {
    decimals = 6;
  } else if (safeAmount > 0 && safeAmount < 1) {
    decimals = 4;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals, 
  }).format(safeAmount);
}

export function formatDollarRaw(amount: number): string {
  const safeAmount = isNaN(amount) || amount === undefined ? 0 : amount;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  }).format(safeAmount);
}
