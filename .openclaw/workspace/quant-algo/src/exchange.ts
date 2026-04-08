/**
 * 交易所管理模块 - Binance Futures API
 * 
 * 支持 Testnet（模拟盘）和 Mainnet（实盘）两种模式，
 * 通过 config.exchange.sandbox 控制。
 * 
 * 注意: 
 * - 公共数据（价格/K线）始终从主网获取
 * - 交易操作根据 sandbox 配置选择 Testnet 或 Mainnet
 * 
 * 集成熔断器保护：API 故障时自动熔断，防止级联故障
 * 实现 ExecutionAdapter 接口，可直接用于统一执行层
 */

import crypto from 'crypto';
import logger from './logger';
import { config } from './config';
import { exchangeCircuitBreaker } from './safety/circuitBreakers';
import { tracingManager } from './monitoring/tracing';
import { ExecutionAdapter, OrderResult, TradingMode } from './feeds/types';
import { Position } from './events/types';

// 交易 API 端点
const TESTNET_API_BASE = 'https://testnet.binancefuture.com';
const MAINNET_API_BASE = 'https://fapi.binance.com';

// 主网用于公共数据（价格/K线等），始终使用主网获取真实市场数据
const PUBLIC_API_BASE = 'https://fapi.binance.com';

export class ExchangeManager implements ExecutionAdapter {
  private apiKey: string;
  private apiSecret: string;
  private symbol: string;
  private leverage: number;
  private apiBase: string;

  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || '';
    this.apiSecret = process.env.BINANCE_API_SECRET || '';
    this.symbol = 'ETHUSDT';
    this.leverage = config.leverage;
    this.apiBase = config.exchange.sandbox ? TESTNET_API_BASE : MAINNET_API_BASE;
  }

  // ==================== ExecutionAdapter 接口实现 ====================

  get mode(): TradingMode {
    return config.exchange.sandbox ? 'paper' : 'live';
  }

  get isSandbox(): boolean {
    return config.exchange.sandbox;
  }

  async placeMarketOrder(
    side: 'buy' | 'sell',
    size: number,
    symbol: string,
  ): Promise<OrderResult> {
    try {
      const binanceSide = side.toUpperCase() as 'BUY' | 'SELL';
      const order = await this.createMarketOrder(binanceSide, size);
      return {
        success: true,
        orderId: order.id,
        filledPrice: order.price,
        filledSize: order.quantity,
        fee: 0,
        message: `Order ${order.id} filled`,
        timestamp: Date.now(),
      };
    } catch (err: unknown) {
      logger.error(`[ExchangeManager] Market order failed: ${(err instanceof Error ? err.message : String(err))}`);
      return { success: false, message: (err instanceof Error ? err.message : String(err)), timestamp: Date.now() };
    }
  }

  async placeLimitOrder(
    _side: 'buy' | 'sell',
    _size: number,
    _price: number,
    _symbol: string,
  ): Promise<OrderResult> {
    return {
      success: false,
      message: 'Limit orders not yet supported via ExchangeManager',
      timestamp: Date.now(),
    };
  }

  async cancelOrder(_orderId: string): Promise<boolean> {
    // Stub for now — ExchangeManager doesn't track individual order IDs
    logger.warn('[ExchangeManager] cancelOrder is a stub, returning true');
    return true;
  }

  async getBalance(): Promise<number> {
    const balance = await this._getBalance();
    return balance.free;
  }

  /**
   * 获取完整余额信息（供内部模块使用，返回 total/free/used）
   */
  async getFullBalance(): Promise<{ total: number; free: number; used: number }> {
    return this._getBalance();
  }

  async getPosition(symbol?: string): Promise<Position | null> {
    const pos = await this._getPosition();
    if (!pos) return null;
    return {
      side: pos.side as 'long' | 'short',
      size: pos.contracts,
      entryPrice: pos.entryPrice,
      leverage: pos.leverage,
      unrealizedPnl: pos.unrealizedPnl,
      markPrice: pos.markPrice,
      liquidationPrice: pos.liquidationPrice,
    };
  }

  async close(): Promise<void> {
    logger.info('[ExchangeManager] Adapter closed');
  }

  // ==================== 内部请求方法 ====================

  /**
   * 发送签名请求（带熔断保护）
   */
  public async request<T = unknown>(path: string, params: Record<string, string | number | boolean> = {}, method = 'GET'): Promise<T> {
    const result = await exchangeCircuitBreaker.execute(async () => {
      return await this._doRequest(path, params, method);
    });
    
    if (!result.success) {
      throw new Error(result.error || '交易所 API 熔断中');
    }
    
    return result.value as T;
  }

  /**
   * 实际执行签名请求
   */
  private async _doRequest(path: string, params: Record<string, string | number | boolean> = {}, method = 'GET'): Promise<unknown> {
    const span = tracingManager.isEnabled()
      ? tracingManager.startSpan('exchange.api_request', {
          attributes: {
            'http.method': method,
            'http.url': `${this.apiBase}${path}`,
            'exchange.endpoint': path,
            'exchange.signed': true,
            'exchange.sandbox': this.isSandbox,
          },
        })
      : null;

    try {
      const timestamp = Date.now();
      let query = `timestamp=${timestamp}`;
      
      if (Object.keys(params).length > 0) {
        query += '&' + new URLSearchParams(params).toString();
      }
      
      const signature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(query)
        .digest('hex');
      
      const url = `${this.apiBase}${path}?${query}&signature=${signature}`;
      
      const startTime = Date.now();
      const res = await fetch(url, {
        method,
        headers: { 'X-MBX-APIKEY': this.apiKey },
      });
      const duration = Date.now() - startTime;
      
      span?.setAttributes({
        'http.status_code': res.status,
        'http.duration_ms': duration,
      });
      
      if (!res.ok) {
        const error = await res.text();
        span?.recordException(error);
        span?.setStatus({ code: 2, message: `API Error ${res.status}: ${error}` });
        throw new Error(`API Error ${res.status}: ${error}`);
      }
      
      const result = await res.json();
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

  /**
   * 公共API请求（带熔断保护）
   */
  private async requestPublic<T = unknown>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
    const result = await exchangeCircuitBreaker.execute(async () => {
      return await this._doRequestPublic(path, params);
    });
    
    if (!result.success) {
      throw new Error(result.error || '交易所 API 熔断中');
    }
    
    return result.value as T;
  }

  /**
   * 实际执行公共API请求（始终使用主网获取真实市场数据）
   */
  private async _doRequestPublic(path: string, params: Record<string, string | number | boolean> = {}): Promise<unknown> {
    const span = tracingManager.isEnabled()
      ? tracingManager.startSpan('exchange.public_request', {
          attributes: {
            'http.method': 'GET',
            'http.url': `${PUBLIC_API_BASE}${path}`,
            'exchange.endpoint': path,
            'exchange.signed': false,
          },
        })
      : null;

    try {
      const query = new URLSearchParams(params).toString();
      const url = `${PUBLIC_API_BASE}${path}${query ? '?' + query : ''}`;
      
      const startTime = Date.now();
      const res = await fetch(url);
      const duration = Date.now() - startTime;
      
      span?.setAttributes({
        'http.status_code': res.status,
        'http.duration_ms': duration,
      });
      
      if (!res.ok) {
        const error = await res.text();
        span?.recordException(error);
        span?.setStatus({ code: 2, message: `API Error ${res.status}: ${error}` });
        throw new Error(`API Error ${res.status}: ${error}`);
      }
      
      const result = await res.json();
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

  // ==================== 交易所操作 ====================

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      // 测试获取余额
      const account = await this.request('/fapi/v2/account');
      const balance = parseFloat(account.availableBalance || 0);
      
      logger.info(`Binance ${config.exchange.sandbox ? 'Testnet' : 'MAINNET ⚠️'} 连接成功`);
      logger.info(`   API Base: ${this.apiBase}`);
      logger.info(`   可用 USDT: ${balance.toFixed(2)}`);
      
      return true;
    } catch (error: unknown) {
      logger.error('Binance 连接失败:', (error instanceof Error ? error.message : String(error)));
      return false;
    }
  }

  /**
   * 设置杠杆
   */
  async setLeverage(leverage: number): Promise<void> {
    try {
      await this.request('/fapi/v1/leverage', {
        symbol: this.symbol,
        leverage: leverage.toString(),
      }, 'POST');
      
      this.leverage = leverage;
      logger.info(`杠杆已设置为 ${leverage}x`);
    } catch (error: unknown) {
      logger.error('设置杠杆失败:', (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  /**
   * 获取K线数据
   */
  async fetchOHLCV(timeframe: string, limit: number = 100): Promise<number[][]> {
    try {
      const data = await this.requestPublic('/fapi/v1/klines', {
        symbol: this.symbol,
        interval: timeframe,
        limit: limit.toString(),
      });
      
      return data.map((k: (string | number)[]) => [
        k[0],           // timestamp
        parseFloat(k[1]), // open
        parseFloat(k[2]), // high
        parseFloat(k[3]), // low
        parseFloat(k[4]), // close
        parseFloat(k[5]), // volume
      ]);
    } catch (error: unknown) {
      logger.error('获取K线数据失败:', (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  /**
   * 获取最新价格
   */
  async getCurrentPrice(): Promise<number> {
    try {
      const ticker = await this.requestPublic('/fapi/v1/ticker/price', {
        symbol: this.symbol,
      });
      
      return parseFloat(ticker.price);
    } catch (error: unknown) {
      logger.error('获取价格失败:', (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  /**
   * 获取订单簿数据
   */
  async fetchOrderBook(limit: number = 20): Promise<{ bids: [number, number][]; asks: [number, number][] }> {
    try {
      const data = await this.requestPublic('/fapi/v1/depth', {
        symbol: this.symbol,
        limit: limit.toString(),
      }) as { bids: string[][]; asks: string[][] };
      
      return {
        bids: data.bids.map((b) => [parseFloat(b[0] || '0'), parseFloat(b[1] || '0')] as [number, number]),
        asks: data.asks.map((a) => [parseFloat(a[0] || '0'), parseFloat(a[1] || '0')] as [number, number]),
      };
    } catch (error: unknown) {
      logger.error('获取订单簿失败:', (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  /**
   * 获取账户余额
   */
  async _getBalance(): Promise<{ total: number; free: number; used: number }> {
    try {
      const account = await this.request('/fapi/v2/account');
      
      return {
        total: parseFloat(account.totalWalletBalance || 0),
        free: parseFloat(account.availableBalance || 0),
        used: parseFloat(account.totalPositionInitialMargin || 0),
      };
    } catch (error: unknown) {
      logger.error('获取余额失败:', (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  /**
   * 获取当前持仓（内部方法，返回原始格式）
   */
  async _getPosition(): Promise<{ symbol: string; side: string; contracts: number; entryPrice: number; markPrice: number; liquidationPrice: number; unrealizedPnl: number; leverage: number } | null> {
    try {
      const positions = await this.request('/fapi/v2/positionRisk');
      
      const position = positions.find((p: Record<string, string>) => 
        p.symbol === this.symbol && parseFloat(p.positionAmt) !== 0
      );
      
      if (!position) return null;
      
      return {
        symbol: position.symbol,
        side: parseFloat(position.positionAmt) > 0 ? 'long' : 'short',
        contracts: Math.abs(parseFloat(position.positionAmt)),
        entryPrice: parseFloat(position.entryPrice),
        markPrice: parseFloat(position.markPrice),
        liquidationPrice: parseFloat(position.liquidationPrice),
        unrealizedPnl: parseFloat(position.unRealizedProfit),
        leverage: parseInt(position.leverage),
      };
    } catch (error: unknown) {
      logger.error('获取持仓失败:', (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  /**
   * 创建市价单
   */
  async createMarketOrder(side: 'BUY' | 'SELL', quantity: number): Promise<{ id: string; status: string; price: number; quantity: number }> {
    try {
      const order = await this.request('/fapi/v1/order', {
        symbol: this.symbol,
        side,
        type: 'MARKET',
        quantity: quantity.toFixed(3),
      }, 'POST');
      
      logger.info(`市价单执行: ${side} ${quantity} ETH @ #${order.orderId}`);
      
      return {
        id: order.orderId.toString(),
        status: order.status === 'FILLED' ? 'closed' : 'open',
        price: parseFloat(order.avgPrice || order.price),
        quantity: parseFloat(order.executedQty),
      };
    } catch (error: unknown) {
      logger.error('创建订单失败:', (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }

  /**
   * 设置止损止盈订单
   * BUG 8 FIX: Determine side from position direction (passed as parameter).
   *            Use this.request() instead of raw fetch() to go through circuit breaker.
   *            Check API response for errors.
   * BUG 23 FIX: Use Date.now() for each order separately instead of shared timestamp.
   */
  async setStopLossTakeProfit(
    stopLossPrice: number,
    takeProfitPrice: number,
    quantity: number,
    positionSide: 'long' | 'short' = 'long'  // BUG 8 FIX: Accept position direction
  ): Promise<{ stopLoss: unknown; takeProfit: unknown } | null> {
    try {
      // BUG 8 FIX: Determine side from position direction
      // For a long position, SL/TP close by selling. For short, by buying.
      const closeSide = positionSide === 'long' ? 'SELL' : 'BUY';

      // BUG 23 FIX: Use separate timestamps for each order
      // BUG 8 FIX: Use this.request() instead of raw fetch() to go through circuit breaker
      const slOrder = await this.request('/fapi/v1/order', {
        symbol: this.symbol,
        side: closeSide,
        type: 'STOP_MARKET',
        stopPrice: stopLossPrice.toFixed(2),
        closePosition: 'true',
      }, 'POST');
      
      // BUG 8 FIX: Check for API errors
      if (slOrder.code && slOrder.code !== 200) {
        logger.error(`止损单设置失败: ${slOrder.msg || JSON.stringify(slOrder)}`);
      }

      // BUG 23 FIX: Separate timestamp (this.request() generates its own timestamp)
      const tpOrder = await this.request('/fapi/v1/order', {
        symbol: this.symbol,
        side: closeSide,
        type: 'TAKE_PROFIT_MARKET',
        stopPrice: takeProfitPrice.toFixed(2),
        closePosition: 'true',
      }, 'POST');
      
      // BUG 8 FIX: Check for API errors
      if (tpOrder.code && tpOrder.code !== 200) {
        logger.error(`止盈单设置失败: ${tpOrder.msg || JSON.stringify(tpOrder)}`);
      }
      
      logger.info(`止损止盈已设置: SL=$${stopLossPrice.toFixed(2)} TP=$${takeProfitPrice.toFixed(2)} (${closeSide})`);
      
      return { stopLoss: slOrder, takeProfit: tpOrder };
    } catch (error: unknown) {
      logger.error(`设置止损止盈失败: ${(error instanceof Error ? error.message : String(error))}`);
      return null;
    }
  }

  /**
   * 开多仓
   */
  async openLong(quantity: number, stopLoss?: number, takeProfit?: number): Promise<{ id: string; status: string; price: number; quantity: number }> {
    const order = await this.createMarketOrder('BUY', quantity);
    logger.info(`开多仓: ${quantity} ETH @ $${order.price}`);
    
    // 自动设置止损止盈
    if (stopLoss && takeProfit) {
      await this.setStopLossTakeProfit(stopLoss, takeProfit, quantity, 'long');
    }
    
    return order;
  }

  /**
   * 开空仓
   */
  async openShort(quantity: number, stopLoss?: number, takeProfit?: number): Promise<{ id: string; status: string; price: number; quantity: number }> {
    const order = await this.createMarketOrder('SELL', quantity);
    logger.info(`开空仓: ${quantity} ETH @ $${order.price}`);
    
    if (stopLoss && takeProfit) {
      // BUG 8 FIX: Pass 'short' as position direction
      await this.setStopLossTakeProfit(stopLoss, takeProfit, quantity, 'short');
    }
    
    return order;
  }

  /**
   * 平仓
   */
  async closePosition(side: 'long' | 'short', quantity: number): Promise<{ id: string; status: string; price: number; quantity: number }> {
    const closeSide = side === 'long' ? 'SELL' : 'BUY';
    const order = await this.createMarketOrder(closeSide, quantity);
    logger.info(`平仓: ${side} ${quantity} ETH @ $${order.price}`);
    return order;
  }

  /**
   * 获取交易对信息
   */
  async getSymbolInfo(): Promise<unknown> {
    try {
      const info = await this.requestPublic('/fapi/v1/exchangeInfo');
      return info.symbols.find((s: Record<string, string>) => s.symbol === this.symbol);
    } catch (error: unknown) {
      logger.error('获取交易对信息失败:', (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  }
}

export default ExchangeManager;
