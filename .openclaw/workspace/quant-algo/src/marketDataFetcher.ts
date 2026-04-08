/**
 * 市场数据获取模块
 * 从 Binance 主网获取公共市场数据（无需 API Key）
 * 
 * 注意：公共市场数据始终使用主网端点，与 sandbox 模式无关
 */

import {
  tracingManager,
  getTraceContextForLogging,
} from './monitoring/tracing';
import { OHLCV } from './events/types';

const BINANCE_API = 'https://fapi.binance.com';  // Always use mainnet for public market data

export interface MarketData {
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  timestamp: number;
}


export class MarketDataFetcher {
  private symbol: string = 'ETHUSDT';
  private retryCount: number = 3;

  // 公共接口：无需 API Key
  async fetchCurrentPrice(): Promise<number> {
    const span = tracingManager.isEnabled()
      ? tracingManager.startSpan('market_data.fetch_price', {
          attributes: {
            'market_data.symbol': this.symbol,
            'market_data.type': 'current_price',
          },
        })
      : null;

    try {
      const result = await this.fetchWithRetry(async () => {
        const res = await fetch(`${BINANCE_API}/fapi/v1/ticker/price?symbol=${this.symbol}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { price: string };
        return parseFloat(data.price);
      });
      
      span?.setAttributes({ 'market_data.price': result });
      span?.setStatus({ code: 0 });
      span?.end();
      return result;
    } catch (error: unknown) {
      span?.recordException(error);
      span?.setStatus({ code: 2, message: (error instanceof Error ? error.message : String(error)) });
      span?.end();
      throw error;
    }
  }
  // 公共接口：无需 API Key
  async fetch24hStats(): Promise<Partial<MarketData>> {
    const span = tracingManager.isEnabled()
      ? tracingManager.startSpan('market_data.fetch_24h_stats', {
          attributes: {
            'market_data.symbol': this.symbol,
            'market_data.type': '24h_stats',
          },
        })
      : null;

    try {
      const result = await this.fetchWithRetry(async () => {
        const res = await fetch(`${BINANCE_API}/fapi/v1/ticker/24hr?symbol=${this.symbol}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as {
          lastPrice: string;
          priceChange: string;
          priceChangePercent: string;
          highPrice: string;
          lowPrice: string;
          volume: string;
          quoteVolume: string;
          closeTime: number;
        };
        
        return {
          price: parseFloat(data.lastPrice),
          priceChange24h: parseFloat(data.priceChange),
          priceChangePercent24h: parseFloat(data.priceChangePercent),
          high24h: parseFloat(data.highPrice),
          low24h: parseFloat(data.lowPrice),
          volume24h: parseFloat(data.volume),
          quoteVolume24h: parseFloat(data.quoteVolume),
          timestamp: data.closeTime,
        };
      });
      
      span?.setAttributes({
        'market_data.price': result.price || 0,
        'market_data.volume': result.volume24h || 0,
      });
      span?.setStatus({ code: 0 });
      span?.end();
      return result;
    } catch (error: unknown) {
      span?.recordException(error);
      span?.setStatus({ code: 2, message: (error instanceof Error ? error.message : String(error)) });
      span?.end();
      throw error;
    }
  }

  // 公共接口：无需 API Key
  async fetchKlines(interval: string = '5m', limit: number = 100): Promise<OHLCV[]> {
    const span = tracingManager.isEnabled()
      ? tracingManager.startSpan('market_data.fetch_klines', {
          attributes: {
            'market_data.symbol': this.symbol,
            'market_data.interval': interval,
            'market_data.limit': limit,
          },
        })
      : null;

    try {
      const result = await this.fetchWithRetry(async () => {
        const res = await fetch(
          `${BINANCE_API}/fapi/v1/klines?symbol=${this.symbol}&interval=${interval}&limit=${limit}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as Array<[
          number, // timestamp
          string, // open
          string, // high
          string, // low
          string, // close
          string, // volume
        ]>;
        
        return data.map((k) => ({
          timestamp: k[0],
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }));
      });
      
      span?.setAttributes({ 'market_data.candles_count': result.length });
      span?.setStatus({ code: 0 });
      span?.end();
      return result;
    } catch (error: unknown) {
      span?.recordException(error);
      span?.setStatus({ code: 2, message: (error instanceof Error ? error.message : String(error)) });
      span?.end();
      throw error;
    }
  }

  // 获取完整市场数据（全部公共接口）
  async fetchFullMarketData(): Promise<MarketData> {
    const span = tracingManager.isEnabled()
      ? tracingManager.startSpan('market_data.fetch_full', {
          attributes: {
            'market_data.symbol': this.symbol,
          },
        })
      : null;

    try {
      const stats = await this.fetch24hStats();
      
      const result = {
        price: stats.price || 0,
        priceChange24h: stats.priceChange24h || 0,
        priceChangePercent24h: stats.priceChangePercent24h || 0,
        high24h: stats.high24h || 0,
        low24h: stats.low24h || 0,
        volume24h: stats.volume24h || 0,
        quoteVolume24h: stats.quoteVolume24h || 0,
        timestamp: stats.timestamp || Date.now(),
      };
      
      span?.setAttributes({ 'market_data.price': result.price });
      span?.setStatus({ code: 0 });
      span?.end();
      return result;
    } catch (error: unknown) {
      console.error(`获取市场数据失败: ${(error instanceof Error ? error.message : String(error))}`);
      span?.recordException(error);
      span?.setStatus({ code: 2, message: (error instanceof Error ? error.message : String(error)) });
      span?.end();
      throw error;
    }
  }

  private async fetchWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    
    for (let i = 0; i < this.retryCount; i++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error;
        console.warn(`请求失败 (尝试 ${i + 1}/${this.retryCount}): ${(error instanceof Error ? error.message : String(error))}`);
        
        if (i < this.retryCount - 1) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        }
      }
    }
    
    throw lastError;
  }
}

export default MarketDataFetcher;
