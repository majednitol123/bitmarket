export interface PortfolioDataProvider {
  getWalletBalance(blockchain: string, address: string): Promise<any[]>;
  getWalletTransactions(
    blockchain: string,
    address: string,
    page?: number,
    limit?: number
  ): Promise<{ result: any[]; meta?: any }>;
}
