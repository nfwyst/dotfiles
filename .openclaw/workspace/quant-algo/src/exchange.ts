/**
 * 交易所管理模块 - 使用Binance Futures Testnet API
 * 
 * 注意: 
 * - 公共数据（价格/K线）从主网获取
 * - 交易操作使用 Testnet API
 * 
 * 集成熔断器保护：API 故障时自动熔断，防止级联故障
 */

import crypto from 'crypto';
import logger from './logger';
import { exchangeCircuitBreaker } from './safety/circuitBreakers';
import {
  tracingManager,
  getTraceContextForLogging,
} from './monitoring/tracing';

// Testnet 用于交易操作
const DEMO_API_BASE = 'https://testnet.binancefuture.com';
// 主网用于公共数据
const PUBLIC_API_BASE = 'https://fapi.binance.com';

export class ExchangeManager {
  private apiKey: string;
  private apiSecret: string;
  private symbol: string;
  private leverage: number;

  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || '';
    this.apiSecret = process.env.BINANCE_API_SECRET || '';
    this.symbol = 'ETHUSDT';
    this.leverage = 100;
  }

  /**
   * 发送签名请求（带熔断保护）
   */
  private async request(path: string, params: any = {}, method = 'GET') {
    const result = await exchangeCircuitBreaker.execute(async () => {
      return await this._doRequest(path, params, method);
    });
    
    if (!result.success) {
      throw new Error(result.error || '交易所 API 熔断中');
    }
    
    return result.value;
  }

  /**
   * 实际执行签名请求
   */
  private async _doRequest(path: string, params: any = {}, method = 'GET') {
    const span = tracingManager.isEnabled()
      ? tracingManager.startSpan('exchange.api_request', {
          attributes: {
            'http.method': method,
            'http.url': `${DEMO_API_BASE}${path}`,
            'exchange.endpoint': path,
            'exchange.signed': true,
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
      
      const url = `${DEMO_API_BASE}${path}?${query}&signature=${signature}`;
      
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
    } catch (error: any) {
      span?.recordException(error);
      span?.setStatus({ code: 2, message: error.message });
      span?.end();
      throw error;
    }
  }

  /**
   * 公共API请求（带熔断保护）
   */
  private async requestPublic(path: string, params: any = {}) {
    const result = await exchangeCircuitBreaker.execute(async () => {
      return await this._doRequestPublic(path, params);
    });
    
    if (!result.success) {
      throw new Error(result.error || '交易所 API 熔断中');
    }
    
    return result.value;
  }

  /**
   * 实际执行公共API请求（使用主网获取真实市场数据）
   */
  private async _doRequestPublic(path: string, params: any = {}) {
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
    } catch (error: any) {
      span?.recordException(error);
      span?.setStatus({ code: 2, message: error.message });
      span?.end();
      throw error;
    }
  }
  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      // 测试获取余额
      const account = await this.request('/fapi/v2/account');
      const balance = parseFloat(account.availableBalance || 0);
      
      logger.info('✅ Binance Demo Trading 连接成功');
      logger.info(`   可用 USDT: ${balance.toFixed(2)}`);
      
      return true;
    } catch (error: any) {
      logger.error('❌ Binance 连接失败:', error.message);
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
      logger.info(`✅ 杠杆已设置为 ${leverage}x`);
    } catch (error: any) {
      logger.error('设置杠杆失败:', error.message);
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
      
      return data.map((k: any[]) => [
        k[0],           // timestamp
        parseFloat(k[1]), // open
        parseFloat(k[2]), // high
        parseFloat(k[3]), // low
        parseFloat(k[4]), // close
        parseFloat(k[5]), // volume
      ]);
    } catch (error: any) {
      logger.error('获取K线数据失败:', error.message);
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
    } catch (error: any) {
      logger.error('获取价格失败:', error.message);
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
    } catch (error: any) {
      logger.error('获取订单簿失败:', error.message);
      throw error;
    }
  }
  /**
   * 获取账户余额
   */
  async getBalance(): Promise<{ total: number; free: number; used: number }> {
    try {
      const account = await this.request('/fapi/v2/account');
      
      return {
        total: parseFloat(account.totalWalletBalance || 0),
        free: parseFloat(account.availableBalance || 0),
        used: parseFloat(account.totalPositionInitialMargin || 0),
      };
    } catch (error: any) {
      logger.error('获取余额失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取当前持仓
   */
  async getPosition(): Promise<any> {
    try {
      const positions = await this.request('/fapi/v2/positionRisk');
      
      const position = positions.find((p: any) => 
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
    } catch (error: any) {
      logger.error('获取持仓失败:', error.message);
      throw error;
    }
  }

  /**
   * 创建市价单
   */
  async createMarketOrder(side: 'BUY' | 'SELL', quantity: number): Promise<any> {
    try {
      const order = await this.request('/fapi/v1/order', {
        symbol: this.symbol,
        side,
        type: 'MARKET',
        quantity: quantity.toFixed(3),
      }, 'POST');
      
      logger.info(`🚀 市价单执行: ${side} ${quantity} ETH @ #${order.orderId}`);
      
      return {
        id: order.orderId.toString(),
        status: order.status === 'FILLED' ? 'closed' : 'open',
        price: parseFloat(order.avgPrice || order.price),
        quantity: parseFloat(order.executedQty),
      };
    } catch (error: any) {
      logger.error('创建订单失败:', error.message);
      throw error;
    }
  }

  /**
   * 设置止损止盈订单
   */
  async setStopLossTakeProfit(
    stopLossPrice: number,
    takeProfitPrice: number,
    quantity: number
  ): Promise<any> {
    try {
      const timestamp = Date.now().toString();
      
      // 设置止损单
      const slQuery = `symbol=${this.symbol}&side=SELL&type=STOP_MARKET&stopPrice=${stopLossPrice.toFixed(2)}&closePosition=true&timestamp=${timestamp}`;
      const slSig = crypto.createHmac('sha256', this.apiSecret).update(slQuery).digest('hex');
      
      const slRes = await fetch(`${DEMO_API_BASE}/fapi/v1/order?${slQuery}&signature=${slSig}`, {
        method: 'POST',
        headers: { 'X-MBX-APIKEY': this.apiKey }
      });
      const slOrder = await slRes.json();
      
      // 设置止盈单
      const tpQuery = `symbol=${this.symbol}&side=SELL&type=TAKE_PROFIT_MARKET&stopPrice=${takeProfitPrice.toFixed(2)}&closePosition=true&timestamp=${timestamp}`;
      const tpSig = crypto.createHmac('sha256', this.apiSecret).update(tpQuery).digest('hex');
      
      const tpRes = await fetch(`${DEMO_API_BASE}/fapi/v1/order?${tpQuery}&signature=${tpSig}`, {
        method: 'POST',
        headers: { 'X-MBX-APIKEY': this.apiKey }
      });
      const tpOrder = await tpRes.json();
      
      logger.info(`🛡️ 止损止盈已设置: SL=$${stopLossPrice.toFixed(2)} TP=$${takeProfitPrice.toFixed(2)}`);
      
      return { stopLoss: slOrder, takeProfit: tpOrder };
    } catch (error: any) {
      logger.error(`设置止损止盈失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 开多仓
   */
  async openLong(quantity: number, stopLoss?: number, takeProfit?: number): Promise<any> {
    const order = await this.createMarketOrder('BUY', quantity);
    logger.info(`🟢 开多仓: ${quantity} ETH @ $${order.price}`);
    
    // 自动设置止损止盈
    if (stopLoss && takeProfit) {
      await this.setStopLossTakeProfit(stopLoss, takeProfit, quantity);
    }
    
    return order;
  }

  /**
   * 开空仓
   */
  async openShort(quantity: number, stopLoss?: number, takeProfit?: number): Promise<any> {
    const order = await this.createMarketOrder('SELL', quantity);
    logger.info(`🔴 开空仓: ${quantity} ETH @ $${order.price}`);
    
    if (stopLoss && takeProfit) {
      // 空仓的止损止盈方向相反
      await this.setStopLossTakeProfit(stopLoss, takeProfit, quantity);
    }
    
    return order;
  }

  /**
   * 平仓
   */
  async closePosition(side: 'long' | 'short', quantity: number): Promise<any> {
    const closeSide = side === 'long' ? 'SELL' : 'BUY';
    const order = await this.createMarketOrder(closeSide, quantity);
    logger.info(`📤 平仓: ${side} ${quantity} ETH @ $${order.price}`);
    return order;
  }

  /**
   * 获取交易对信息
   */
  async getSymbolInfo(): Promise<any> {
    try {
      const info = await this.requestPublic('/fapi/v1/exchangeInfo');
      return info.symbols.find((s: any) => s.symbol === this.symbol);
    } catch (error: any) {
      logger.error('获取交易对信息失败:', error.message);
      throw error;
    }
  }
}

export default ExchangeManager;
