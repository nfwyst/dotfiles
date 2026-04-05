import logger from './logger';
import { config } from './config';

export interface OrderBookLevel {
  price: number;
  volume: number;
  side: 'bid' | 'ask';
}

export interface OrderBookImbalance {
  ratio: number;  // 买盘/卖盘比例
  delta: number;  // 买盘-卖盘
  wallStrength: number;  // 0-100
}

export interface LargeTrade {
  price: number;
  size: number;
  side: 'buy' | 'sell';
  time: number;
  isAggressive: boolean;  // 主动吃单
}

export interface MarketContext {
  fundingRate: number;      // 资金费率
  markPrice: number;        // 标记价格
  indexPrice: number;       // 指数价格
  openInterest: number;     // 持仓量
  volume24h: number;        // 24小时成交量
  priceChange24h: number;   // 24小时涨跌幅
}

/**
 * 市场微观结构分析器
 * 
 * 监控：
 * 1. 订单簿不平衡 (Order Book Imbalance)
 * 2. 大单成交 (Large Trades)
 * 3. Delta (净成交量)
 * 4. 资金费率 (Funding Rate)
 * 5. 买卖墙检测
 */
export class MarketMicrostructure {
  private recentTrades: LargeTrade[] = [];
  private lastFundingRate: number = 0;
  private cumulativeDelta: number = 0;
  private maxTrades: number = 100;
  
  /**
   * 分析订单簿不平衡
   */
  analyzeOrderBook(orderBook: { bids: [number, number][]; asks: [number, number][] }): OrderBookImbalance {
    const depth = config.marketMicrostructure.orderBookDepth;
    
    // 计算买卖盘总量
    const bidVolume = orderBook.bids
      .slice(0, depth)
      .reduce((sum, [price, vol]) => sum + vol * price, 0);
    
    const askVolume = orderBook.asks
      .slice(0, depth)
      .reduce((sum, [price, vol]) => sum + vol * price, 0);
    
    // 计算比例和Delta
    const totalVolume = bidVolume + askVolume;
    const ratio = totalVolume > 0 ? bidVolume / askVolume : 1;
    const delta = bidVolume - askVolume;
    
    // 检测买卖墙
    const bidWallStrength = this.detectWall(orderBook.bids, 'bid');
    const askWallStrength = this.detectWall(orderBook.asks, 'ask');
    const wallStrength = Math.max(bidWallStrength, askWallStrength);
    
    return {
      ratio,
      delta,
      wallStrength,
    };
  }
  
  /**
   * 检测买卖墙
   */
  private detectWall(levels: [number, number][], side: 'bid' | 'ask'): number {
    if (levels.length < 3) return 0;
    
    const avgVolume = levels.slice(0, 5).reduce((sum, [, vol]) => sum + vol, 0) / 5;
    const maxVolume = Math.max(...levels.slice(0, 10).map(([, vol]) => vol));
    
    // 如果某一档成交量是平均的 3 倍以上，认为是墙
    if (maxVolume > avgVolume * 3) {
      return Math.min(100, (maxVolume / avgVolume - 3) * 20 + 50);
    }
    
    return 0;
  }
  
  /**
   * 记录大单成交
   */
  recordLargeTrade(price: number, size: number, side: 'buy' | 'sell', isAggressive: boolean): void {
    const threshold = config.marketMicrostructure.largeTradeThreshold;
    const value = price * size;
    
    if (value < threshold) return;
    
    const trade: LargeTrade = {
      price,
      size,
      side,
      time: Date.now(),
      isAggressive,
    };
    
    this.recentTrades.push(trade);
    
    // 更新累积 Delta
    if (side === 'buy') {
      this.cumulativeDelta += value;
    } else {
      this.cumulativeDelta -= value;
    }
    
    // 清理旧数据
    if (this.recentTrades.length > this.maxTrades) {
      this.recentTrades.shift();
    }
    
    logger.debug(`大单成交: ${side.toUpperCase()} ${size.toFixed(4)} @ $${price.toFixed(2)} (价值: $${value.toFixed(0)})`);
  }
  
  /**
   * 分析大单方向
   */
  analyzeLargeTradePressure(lookbackMinutes: number = 15): { 
    buyPressure: number; 
    sellPressure: number; 
    netPressure: number;
    signal: 'bullish' | 'bearish' | 'neutral';
  } {
    const cutoff = Date.now() - lookbackMinutes * 60 * 1000;
    const recent = this.recentTrades.filter(t => t.time > cutoff);
    
    if (recent.length === 0) {
      return { buyPressure: 0, sellPressure: 0, netPressure: 0, signal: 'neutral' };
    }
    
    const buys = recent.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.price * t.size, 0);
    const sells = recent.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.price * t.size, 0);
    
    const total = buys + sells;
    const buyPressure = total > 0 ? buys / total : 0;
    const sellPressure = total > 0 ? sells / total : 0;
    const netPressure = buyPressure - sellPressure;
    
    let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (netPressure > 0.2) signal = 'bullish';
    else if (netPressure < -0.2) signal = 'bearish';
    
    return { buyPressure, sellPressure, netPressure, signal };
  }
  
  /**
   * 更新资金费率
   */
  updateFundingRate(rate: number): void {
    const threshold = config.marketMicrostructure.fundingRateThreshold;
    
    if (Math.abs(rate) > threshold && Math.abs(rate) > Math.abs(this.lastFundingRate)) {
      if (rate > 0) {
        logger.warn(`⚠️ 资金费率过高: ${(rate * 100).toFixed(4)}%，多头可能承压`);
      } else {
        logger.warn(`⚠️ 资金费率过低: ${(rate * 100).toFixed(4)}%，空头可能承压`);
      }
    }
    
    this.lastFundingRate = rate;
  }
  
  /**
   * 获取累积 Delta 信号
   */
  getDeltaSignal(): { delta: number; signal: 'bullish' | 'bearish' | 'neutral' } {
    const threshold = config.marketMicrostructure.deltaThreshold;
    
    if (this.cumulativeDelta > threshold) {
      return { delta: this.cumulativeDelta, signal: 'bullish' };
    } else if (this.cumulativeDelta < -threshold) {
      return { delta: this.cumulativeDelta, signal: 'bearish' };
    }
    
    return { delta: this.cumulativeDelta, signal: 'neutral' };
  }
  
  /**
   * 检测异常模式
   */
  detectAnomalies(): string[] {
    const anomalies: string[] = [];
    
    // 检测大单密集成交
    const cutoff = Date.now() - 60 * 1000; // 1分钟
    const recentCount = this.recentTrades.filter(t => t.time > cutoff).length;
    
    if (recentCount >= 5) {
      anomalies.push('大单密集成交');
    }
    
    // 检测 Delta 异常
    const { signal } = this.getDeltaSignal();
    if (signal !== 'neutral') {
      anomalies.push(`累积Delta极端: ${this.cumulativeDelta > 0 ? '+' : ''}${(this.cumulativeDelta / 1000000).toFixed(1)}M`);
    }
    
    return anomalies;
  }
  
  /**
   * 生成综合市场信号
   */
  generateSignal(orderBook?: OrderBookImbalance): {
    score: number;  // -100 到 +100
    confidence: number;
    reasons: string[];
  } {
    let score = 0;
    let factors = 0;
    const reasons: string[] = [];
    
    // 1. 订单簿不平衡
    if (orderBook) {
      if (orderBook.ratio > 1.5) {
        score += 20;
        factors++;
        reasons.push('买盘强劲');
      } else if (orderBook.ratio < 0.67) {
        score -= 20;
        factors++;
        reasons.push('卖盘强劲');
      }
    }
    
    // 2. 大单压力
    const pressure = this.analyzeLargeTradePressure();
    if (pressure.signal === 'bullish') {
      score += 25;
      factors++;
      reasons.push(`大单净买入: ${(pressure.netPressure * 100).toFixed(0)}%`);
    } else if (pressure.signal === 'bearish') {
      score -= 25;
      factors++;
      reasons.push(`大单净卖出: ${(Math.abs(pressure.netPressure) * 100).toFixed(0)}%`);
    }
    
    // 3. Delta 信号
    const deltaSignal = this.getDeltaSignal();
    if (deltaSignal.signal === 'bullish') {
      score += 20;
      factors++;
      reasons.push('累积Delta看多');
    } else if (deltaSignal.signal === 'bearish') {
      score -= 20;
      factors++;
      reasons.push('累积Delta看空');
    }
    
    // 4. 资金费率
    if (this.lastFundingRate > 0.001) {
      score -= 15;
      factors++;
      reasons.push('资金费率偏高(做空更有利)');
    } else if (this.lastFundingRate < -0.001) {
      score += 15;
      factors++;
      reasons.push('资金费率偏低(做多更有利)');
    }
    
    const confidence = factors > 0 ? factors / 4 : 0;
    
    return { score, confidence, reasons };
  }
  
  /**
   * 重置数据
   */
  reset(): void {
    this.recentTrades = [];
    this.cumulativeDelta = 0;
  }
  
  /**
   * 获取统计
   */
  getStats(): {
    recentTrades: number;
    cumulativeDelta: number;
    fundingRate: number;
  } {
    return {
      recentTrades: this.recentTrades.length,
      cumulativeDelta: this.cumulativeDelta,
      fundingRate: this.lastFundingRate,
    };
  }
}

export default MarketMicrostructure;
