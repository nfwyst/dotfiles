import logger from './logger';

export interface SMCZone {
  type: 'order_block' | 'breaker_block' | 'fvg';
  startPrice: number;
  endPrice: number;
  startTime: number;
  endTime: number;
  isBullish: boolean;
  strength: number;  // 0-100
  tested: boolean;
}

export interface LiquiditySweep {
  type: 'high' | 'low';
  price: number;
  time: number;
  volume: number;
  reclaimed: boolean;
}

/**
 * SMC (Smart Money Concepts) 分析器
 * 
 * 识别：
 * 1. 订单块 (Order Blocks) - 机构订单聚集区域
 * 2. 突破块 (Breaker Blocks) - 突破后反转的订单块
 * 3. 公允价值缺口 (Fair Value Gaps)
 * 4. 流动性猎杀 (Liquidity Sweeps)
 */
export class SMCAnalyzer {
  private zones: SMCZone[] = [];
  private sweeps: LiquiditySweep[] = [];
  private maxZones: number = 50;
  
  /**
   * 分析K线数据，识别 SMC 结构
   */
  analyze(ohlcv: number[][]): void {
    this.detectOrderBlocks(ohlcv);
    this.detectFairValueGaps(ohlcv);
    this.detectLiquiditySweeps(ohlcv);
    
    // 清理过期数据
    this.cleanupOldZones();
  }
  
  /**
   * 识别订单块 (Order Blocks)
   * 
   * 看涨订单块：强烈的看涨K线之前的最后一根看跌K线
   * 看跌订单块：强烈的看跌K线之前的最后一根看涨K线
   */
  private detectOrderBlocks(ohlcv: number[][]): void {
    if (ohlcv.length < 3) return;
    
    for (let i = 2; i < ohlcv.length; i++) {
      const current = ohlcv[i];
      const prev = ohlcv[i - 1];
      const prev2 = ohlcv[i - 2];
      
      const currentOpen = current[1];
      const currentClose = current[4];
      const currentHigh = current[2];
      const currentLow = current[3];
      const currentVolume = current[5];
      
      const prevOpen = prev[1];
      const prevClose = prev[4];
      const prevHigh = prev[2];
      const prevLow = prev[3];
      
      // 判断K线方向
      const isCurrentBullish = currentClose > currentOpen;
      const isPrevBullish = prevClose > prevOpen;
      const isPrev2Bullish = prev2[4] > prev2[1];
      
      // 强烈K线判断 (实体大于前一根的1.5倍)
      const currentBody = Math.abs(currentClose - currentOpen);
      const prevBody = Math.abs(prevClose - prevOpen);
      const isStrongMove = currentBody > prevBody * 1.5 && currentVolume > prev[5] * 1.2;
      
      // 看涨订单块：强烈看涨K线，前一根是下跌的
      if (isStrongMove && isCurrentBullish && !isPrevBullish) {
        const strength = this.calculateZoneStrength(currentVolume, currentBody, prevBody);
        
        this.addZone({
          type: 'order_block',
          startPrice: prevLow,
          endPrice: prevHigh,
          startTime: prev[0],
          endTime: current[0],
          isBullish: true,
          strength,
          tested: false,
        });
      }
      
      // 看跌订单块：强烈看跌K线，前一根是上涨的
      if (isStrongMove && !isCurrentBullish && isPrevBullish) {
        const strength = this.calculateZoneStrength(currentVolume, currentBody, prevBody);
        
        this.addZone({
          type: 'order_block',
          startPrice: prevLow,
          endPrice: prevHigh,
          startTime: prev[0],
          endTime: current[0],
          isBullish: false,
          strength,
          tested: false,
        });
      }
    }
  }
  
  /**
   * 识别公允价值缺口 (Fair Value Gaps)
   * 
   * 当一根K线的实体与前一根K线的实体不重叠时形成
   */
  private detectFairValueGaps(ohlcv: number[][]): void {
    if (ohlcv.length < 2) return;
    
    for (let i = 1; i < ohlcv.length; i++) {
      const current = ohlcv[i];
      const prev = ohlcv[i - 1];
      
      const currentOpen = current[1];
      const currentClose = current[4];
      const currentLow = current[3];
      const currentHigh = current[2];
      
      const prevOpen = prev[1];
      const prevClose = prev[4];
      const prevLow = prev[3];
      const prevHigh = prev[2];
      
      const currentBodyTop = Math.max(currentOpen, currentClose);
      const currentBodyBottom = Math.min(currentOpen, currentClose);
      const prevBodyTop = Math.max(prevOpen, prevClose);
      const prevBodyBottom = Math.min(prevOpen, prevClose);
      
      // 看涨 FVG：当前K线底部高于前一根顶部
      if (currentBodyBottom > prevBodyTop) {
        const gap = currentBodyBottom - prevBodyTop;
        const gapPercent = gap / prevClose;
        
        // 只记录大于 0.1% 的缺口
        if (gapPercent > 0.001) {
          this.addZone({
            type: 'fvg',
            startPrice: prevBodyTop,
            endPrice: currentBodyBottom,
            startTime: prev[0],
            endTime: current[0],
            isBullish: true,
            strength: Math.min(100, gapPercent * 10000),
            tested: false,
          });
        }
      }
      
      // 看跌 FVG：当前K线顶部低于前一根底部
      if (currentBodyTop < prevBodyBottom) {
        const gap = prevBodyBottom - currentBodyTop;
        const gapPercent = gap / prevClose;
        
        if (gapPercent > 0.001) {
          this.addZone({
            type: 'fvg',
            startPrice: currentBodyTop,
            endPrice: prevBodyBottom,
            startTime: prev[0],
            endTime: current[0],
            isBullish: false,
            strength: Math.min(100, gapPercent * 10000),
            tested: false,
          });
        }
      }
    }
  }
  
  /**
   * 识别流动性猎杀 (Liquidity Sweeps)
   * 
   * 价格短暂突破关键高低点后迅速反转
   */
  private detectLiquiditySweeps(ohlcv: number[][]): void {
    if (ohlcv.length < 20) return;
    
    // 找出近期高低点
    const lookback = 10;
    const recentHighs: number[] = [];
    const recentLows: number[] = [];
    
    for (let i = ohlcv.length - lookback; i < ohlcv.length - 1; i++) {
      const candle = ohlcv[i];
      recentHighs.push(candle[2]);
      recentLows.push(candle[3]);
    }
    
    const recentHigh = Math.max(...recentHighs);
    const recentLow = Math.min(...recentLows);
    
    const lastCandle = ohlcv[ohlcv.length - 1];
    const lastHigh = lastCandle[2];
    const lastLow = lastCandle[3];
    const lastClose = lastCandle[4];
    const lastVolume = lastCandle[5];
    
    // 高点猎杀：突破前高后迅速回落
    if (lastHigh > recentHigh * 1.002 && lastClose < recentHigh) {
      this.sweeps.push({
        type: 'high',
        price: lastHigh,
        time: lastCandle[0],
        volume: lastVolume,
        reclaimed: false,
      });
      
      logger.debug(`检测到高点流动性猎杀 @ $${lastHigh.toFixed(2)}`);
    }
    
    // 低点猎杀：跌破前低后迅速回升
    if (lastLow < recentLow * 0.998 && lastClose > recentLow) {
      this.sweeps.push({
        type: 'low',
        price: lastLow,
        time: lastCandle[0],
        volume: lastVolume,
        reclaimed: false,
      });
      
      logger.debug(`检测到低流动性猎杀 @ $${lastLow.toFixed(2)}`);
    }
  }
  
  /**
   * 计算订单块强度
   */
  private calculateZoneStrength(volume: number, body: number, prevBody: number): number {
    const volumeScore = Math.min(50, volume / 1000);
    const bodyScore = Math.min(30, (body / prevBody - 1) * 30);
    return Math.min(100, volumeScore + bodyScore + 20);
  }
  
  /**
   * 添加新区间（去重）
   */
  private addZone(zone: SMCZone): void {
    // 检查是否已存在类似区间
    const exists = this.zones.some(z => 
      z.type === zone.type &&
      Math.abs(z.startPrice - zone.startPrice) / z.startPrice < 0.001 &&
      Math.abs(z.endPrice - zone.endPrice) / z.endPrice < 0.001
    );
    
    if (!exists) {
      this.zones.push(zone);
      
      if (zone.type === 'order_block') {
        logger.debug(`发现${zone.isBullish ? '看涨' : '看跌'}订单块 @ $${zone.startPrice.toFixed(2)}-$${zone.endPrice.toFixed(2)} (强度: ${zone.strength})`);
      }
    }
  }
  
  /**
   * 清理过期区间
   */
  private cleanupOldZones(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    const now = Date.now();
    
    this.zones = this.zones.filter(z => now - z.endTime < maxAge);
    
    if (this.zones.length > this.maxZones) {
      this.zones = this.zones.slice(-this.maxZones);
    }
  }
  
  /**
   * 检查价格是否在关键区间内
   */
  isInKeyZone(price: number, type?: 'order_block' | 'fvg'): boolean {
    return this.zones.some(z => 
      (!type || z.type === type) &&
      price >= Math.min(z.startPrice, z.endPrice) &&
      price <= Math.max(z.startPrice, z.endPrice) &&
      z.strength >= 50
    );
  }
  
  /**
   * 获取最近的看涨订单块
   */
  getNearestBullishOB(price: number): SMCZone | null {
    const bullishOBs = this.zones.filter(z => 
      z.type === 'order_block' && 
      z.isBullish && 
      z.startPrice < price
    );
    
    if (bullishOBs.length === 0) return null;
    
    return bullishOBs.reduce((nearest, z) => 
      Math.abs(z.startPrice - price) < Math.abs(nearest.startPrice - price) ? z : nearest
    );
  }
  
  /**
   * 获取最近的看跌订单块
   */
  getNearestBearishOB(price: number): SMCZone | null {
    const bearishOBs = this.zones.filter(z => 
      z.type === 'order_block' && 
      !z.isBullish && 
      z.startPrice > price
    );
    
    if (bearishOBs.length === 0) return null;
    
    return bearishOBs.reduce((nearest, z) => 
      Math.abs(z.startPrice - price) < Math.abs(nearest.startPrice - price) ? z : nearest
    );
  }
  
  /**
   * 检查是否有流动性猎杀信号
   */
  hasLiquiditySweep(type: 'high' | 'low', since: number): boolean {
    return this.sweeps.some(s => 
      s.type === type &&
      s.time > since &&
      !s.reclaimed
    );
  }
  
  /**
   * 获取最近的猎杀
   */
  getRecentSweeps(since: number): LiquiditySweep[] {
    return this.sweeps.filter(s => s.time > since);
  }
  
  /**
   * 标记区间已测试
   */
  markZoneTested(price: number): void {
    this.zones.forEach(z => {
      if (price >= Math.min(z.startPrice, z.endPrice) &&
          price <= Math.max(z.startPrice, z.endPrice)) {
        z.tested = true;
      }
    });
  }
  
  /**
   * 获取统计信息
   */
  getStats(): { zones: number; bullishOBs: number; bearishOBs: number; fvgs: number; sweeps: number } {
    return {
      zones: this.zones.length,
      bullishOBs: this.zones.filter(z => z.type === 'order_block' && z.isBullish).length,
      bearishOBs: this.zones.filter(z => z.type === 'order_block' && !z.isBullish).length,
      fvgs: this.zones.filter(z => z.type === 'fvg').length,
      sweeps: this.sweeps.length,
    };
  }
}

export default SMCAnalyzer;
