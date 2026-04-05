/**
 * 5. 仓位管理模块 v2.0
 * 
 * 职责:
 * - 开仓/平仓执行
 * - API调用封装
 * - 仓位状态追踪
 * 
 * 注意: 风险管理由 MonitorNotifierModule 负责
 */

import { ExchangeManager } from '../exchange';

export interface OrderResult {
  success: boolean;
  orderId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
  quantity: number;
  price?: number;
  avgPrice?: number;
  status: 'FILLED' | 'PARTIALLY_FILLED' | 'PENDING' | 'FAILED';
  timestamp: number;
  error?: string;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  contracts: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  margin: number;
  leverage: number;
  unrealizedPnl: number;
  realizedPnl: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: number;
}

export interface AccountBalance {
  asset: string;
  total: number;
  free: number;
  used: number;
  unrealizedPnl: number;
  marginRatio: number;
  availableBalance: number;
}

export class PositionManagerModule {
  private exchange: ExchangeManager;
  private symbol: string;
  private leverage: number;

  constructor(exchange: ExchangeManager, symbol: string = 'ETHUSDT', leverage: number = 100) {
    this.exchange = exchange;
    this.symbol = symbol;
    this.leverage = leverage;
  }

  /**
   * 初始化 - 设置杠杆
   */
  async initialize(): Promise<boolean> {
    try {
      await this.exchange.setLeverage(this.leverage);
      console.log(`✅ 仓位管理初始化完成，杠杆: ${this.leverage}x`);
      return true;
    } catch (e: any) {
      console.error(`❌ 仓位管理初始化失败: ${e.message}`);
      return false;
    }
  }

  /**
   * 获取账户余额
   */
  async getBalance(): Promise<AccountBalance | null> {
    try {
      const balance = await this.exchange.getBalance();
      return {
        asset: 'USDT',
        total: balance.total,
        free: balance.free,
        used: balance.used,
        unrealizedPnl: 0,
        marginRatio: 0,
        availableBalance: balance.free,
      };
    } catch (e: any) {
      console.error(`获取余额失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 获取当前持仓
   */
  async getCurrentPosition(): Promise<Position | null> {
    try {
      const pos = await this.exchange.getPosition();
      if (!pos || pos.contracts === 0) return null;

      return {
        id: `${pos.side}-${pos.entryPrice}-${Date.now()}`,
        symbol: pos.symbol,
        side: pos.side,
        contracts: Math.abs(pos.contracts),
        entryPrice: pos.entryPrice,
        markPrice: pos.markPrice || pos.entryPrice,
        liquidationPrice: pos.liquidationPrice || 0,
        margin: pos.initialMargin || 0,
        leverage: pos.leverage || this.leverage,
        unrealizedPnl: pos.unrealizedPnl || 0,
        realizedPnl: 0,
        openedAt: Date.now(),
      };
    } catch (e: any) {
      console.error(`获取持仓失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 开仓
   * 注意: 调用前需通过 MonitorNotifierModule.checkTradeRisk() 进行风险检查
   */
  async openPosition(
    side: 'long' | 'short',
    quantity: number,
    entryPrice: number,
    stopLoss: number,
    takeProfits: { tp1: number; tp2: number; tp3: number }
  ): Promise<OrderResult> {
    const startTime = Date.now();

    try {
      console.log(`🚀 开仓: ${side.toUpperCase()} ${quantity} ETH @ ${entryPrice}`);

      const order = await this.exchange.createMarketOrder(
        side === 'long' ? 'BUY' : 'SELL',
        quantity
      );

      const result: OrderResult = {
        success: !!order.id,
        orderId: order.id,
        symbol: this.symbol,
        side: side === 'long' ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity,
        price: entryPrice,
        avgPrice: order.price || entryPrice,
        status: order.status === 'closed' ? 'FILLED' : 'PENDING',
        timestamp: Date.now()
      };

      if (result.success) {
        console.log(`✅ 开仓成功 #${result.orderId}`);
        // Demo环境不支持TP/SL订单，记录到本地
        this.saveTPSLToLocal(side, quantity, stopLoss, takeProfits);
      } else {
        console.error(`❌ 开仓失败`);
      }

      return result;
    } catch (e: any) {
      console.error(`❌ 开仓异常: ${e.message}`);
      return {
        success: false,
        symbol: this.symbol,
        side: side === 'long' ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity,
        status: 'FAILED',
        timestamp: startTime,
        error: e.message
      };
    }
  }

  /**
   * 平仓
   */
  async closePosition(
    position: Position,
    reason: string = 'manual'
  ): Promise<OrderResult> {
    const startTime = Date.now();

    try {
      const side = position.side === 'long' ? 'SELL' : 'BUY';

      console.log(`📉 平仓: ${side} ${position.contracts} ETH | 原因: ${reason}`);

      const order = await this.exchange.createMarketOrder(
        side,
        position.contracts
      );

      const result: OrderResult = {
        success: !!order.id,
        orderId: order.id,
        symbol: this.symbol,
        side,
        type: 'MARKET',
        quantity: position.contracts,
        avgPrice: order.price,
        status: order.status === 'closed' ? 'FILLED' : 'PENDING',
        timestamp: Date.now()
      };

      if (result.success) {
        const pnl = position.unrealizedPnl;
        console.log(`✅ 平仓成功 #${result.orderId} | 盈亏: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`);
        this.clearTPSLFromLocal(position.id);
      }

      return result;
    } catch (e: any) {
      console.error(`❌ 平仓异常: ${e.message}`);
      return {
        success: false,
        symbol: this.symbol,
        side: position.side === 'long' ? 'SELL' : 'BUY',
        type: 'MARKET',
        quantity: position.contracts,
        status: 'FAILED',
        timestamp: startTime,
        error: e.message
      };
    }
  }

  /**
   * 部分平仓（TP1/TP2/TP3）
   */
  async closePartialPosition(
    position: Position,
    percentage: number,  // 0-1
    reason: string
  ): Promise<OrderResult> {
    const quantity = position.contracts * percentage;

    try {
      const side = position.side === 'long' ? 'SELL' : 'BUY';

      console.log(`📉 部分平仓 (${(percentage*100).toFixed(0)}%): ${side} ${quantity.toFixed(4)} ETH | ${reason}`);

      const order = await this.exchange.createMarketOrder(side, quantity);

      return {
        success: !!order.id,
        orderId: order.id,
        symbol: this.symbol,
        side,
        type: 'MARKET',
        quantity,
        avgPrice: order.price,
        status: order.status === 'closed' ? 'FILLED' : 'PENDING',
        timestamp: Date.now()
      };
    } catch (e: any) {
      console.error(`❌ 部分平仓失败: ${e.message}`);
      return {
        success: false,
        symbol: this.symbol,
        side: position.side === 'long' ? 'SELL' : 'BUY',
        type: 'MARKET',
        quantity,
        status: 'FAILED',
        timestamp: Date.now(),
        error: e.message
      };
    }
  }

  /**
   * 修改止损（Demo环境本地记录）
   */
  async updateStopLoss(positionId: string, newStopLoss: number): Promise<boolean> {
    try {
      const fs = require('fs');
      const filePath = `./positions/${positionId}-tpsl.json`;

      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        data.stopLoss = newStopLoss;
        data.updatedAt = Date.now();
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`📝 止损更新: ${positionId} -> ${newStopLoss}`);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // ========== 私有方法 ==========

  private saveTPSLToLocal(
    side: 'long' | 'short',
    quantity: number,
    stopLoss: number,
    takeProfits: { tp1: number; tp2: number; tp3: number }
  ) {
    try {
      const fs = require('fs');
      fs.mkdirSync('./positions', { recursive: true });

      const positionId = `${side}-${Date.now()}`;
      const data = {
        id: positionId,
        side,
        quantity,
        stopLoss,
        takeProfits,
        createdAt: Date.now(),
        tp1Executed: false,
        tp2Executed: false,
        tp3Executed: false
      };

      fs.writeFileSync(`./positions/${positionId}-tpsl.json`, JSON.stringify(data, null, 2));
    } catch (e) {}
  }

  private clearTPSLFromLocal(positionId: string) {
    try {
      const fs = require('fs');
      const filePath = `./positions/${positionId}-tpsl.json`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {}
  }

  getLocalTPSLRecords(): any[] {
    try {
      const fs = require('fs');
      const files = fs.readdirSync('./positions');
      const records = [];

      for (const file of files) {
        if (file.endsWith('-tpsl.json')) {
          records.push(JSON.parse(fs.readFileSync(`./positions/${file}`, 'utf8')));
        }
      }

      return records;
    } catch (e) {
      return [];
    }
  }

  calculatePnL(position: Position, currentPrice: number): number {
    const entryValue = position.contracts * position.entryPrice;
    const currentValue = position.contracts * currentPrice;
    return position.side === 'long'
      ? currentValue - entryValue
      : entryValue - currentValue;
  }

  calculatePnLPercent(position: Position, currentPrice: number): number {
    const pnl = this.calculatePnL(position, currentPrice);
    const entryValue = position.contracts * position.entryPrice;
    return (pnl / entryValue) * 100;
  }
}

export default PositionManagerModule;
