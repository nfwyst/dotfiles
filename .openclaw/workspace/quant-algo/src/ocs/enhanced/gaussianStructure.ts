/**
 * OCS enhanced Layer 1 Enhancement: 高斯结构框架
 * Gaussian Structure Framework
 * 
 * 功能: 使用高斯核函数对数据进行加权平滑
 * 原理: 近期数据权重更高，远期数据按高斯曲线递减
 * 优势: 更可靠的趋势检测，更少的假信号
 */

export interface GaussianSmoothed {
  value: number;           // 高斯平滑后的值
  weights: number[];       // 各点的权重
  sigma: number;           // 高斯核标准差
  windowSize: number;      // 窗口大小
}

export class GaussianStructure {
  private defaultSigma: number;
  private defaultWindowSize: number;

  constructor(sigma: number = 2.0, windowSize: number = 20) {
    this.defaultSigma = sigma;
    this.defaultWindowSize = windowSize;
  }

  /**
   * 高斯核函数
   * G(x) = exp(-x² / 2σ²)
   */
  private gaussianKernel(x: number, sigma: number): number {
    return Math.exp(-(x * x) / (2 * sigma * sigma));
  }

  /**
   * 计算高斯平滑
   * 
   * @param data 输入数据数组
   * @param windowSize 窗口大小
   * @param sigma 高斯核标准差
   */
  smooth(data: number[], windowSize?: number, sigma?: number): GaussianSmoothed {
    const size = windowSize || this.defaultWindowSize;
    const sig = sigma || this.defaultSigma;
    
    // 确保窗口不超过数据长度
    const actualWindow = Math.min(size, data.length);
    const halfWindow = Math.floor(actualWindow / 2);
    
    const weights: number[] = [];
    let weightSum = 0;
    
    // 计算高斯权重
    for (let i = 0; i < actualWindow; i++) {
      const x = i - halfWindow; // 中心化
      const weight = this.gaussianKernel(x, sig);
      weights.push(weight);
      weightSum += weight;
    }
    
    // 归一化权重
    const normalizedWeights = weights.map(w => w / weightSum);
    
    // 应用高斯平滑
    const smoothedValues: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      let smoothed = 0;
      let currentWeightSum = 0;
      
      for (let j = 0; j < actualWindow; j++) {
        const dataIndex = i - halfWindow + j;
        if (dataIndex >= 0 && dataIndex < data.length) {
          smoothed += data[dataIndex] * normalizedWeights[j];
          currentWeightSum += normalizedWeights[j];
        }
      }
      
      // 边界处理
      if (currentWeightSum > 0) {
        smoothedValues.push(smoothed / currentWeightSum * weightSum);
      } else {
        smoothedValues.push(data[i]);
      }
    }
    
    return {
      value: smoothedValues[smoothedValues.length - 1],
      weights: normalizedWeights,
      sigma: sig,
      windowSize: actualWindow,
    };
  }

  /**
   * 对OHLCV数据进行高斯平滑
   */
  smoothOHLCV(
    data: { open: number; high: number; low: number; close: number; volume: number }[],
    windowSize?: number,
    sigma?: number
  ) {
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    
    return {
      close: this.smooth(closes, windowSize, sigma),
      volume: this.smooth(volumes, windowSize, sigma),
      high: this.smooth(highs, windowSize, sigma),
      low: this.smooth(lows, windowSize, sigma),
      typical: this.smooth(
        data.map(d => (d.high + d.low + d.close) / 3),
        windowSize,
        sigma
      ),
    };
  }

  /**
   * 动态调整Sigma
   * 根据市场波动率自动调整平滑程度
   */
  adaptiveSmooth(data: number[], volatility: number): GaussianSmoothed {
    // 高波动率 -> 更大的sigma -> 更强的平滑
    // 低波动率 -> 更小的sigma -> 更敏感的响应
    const adaptiveSigma = this.defaultSigma * (1 + volatility * 2);
    return this.smooth(data, this.defaultWindowSize, adaptiveSigma);
  }
}

export default GaussianStructure;
