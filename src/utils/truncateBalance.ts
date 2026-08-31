export const truncateBalance = (balance: string | number, decimals = 6) => {
  const balanceStr = balance.toString();
  const [wholePart, decimalPart] = balanceStr.split(".");

  if (!decimalPart) return wholePart;

  const truncatedDecimal = decimalPart.slice(0, decimals);

  return wholePart + "." + truncatedDecimal;
};

