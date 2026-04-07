import CVDAnalyzer from './src/ocs/enhanced/cvdDivergence';
import * as fs from 'fs';
import * as path from 'path';

const cacheDir = path.join(process.cwd(), 'backtest-cache');
const dataFile = fs.readdirSync(cacheDir)
  .filter((f: string) => f.includes('ETHUSDT') && f.includes('2025-04-07'))
  .sort()
  .pop();

const rawData = JSON.parse(fs.readFileSync(path.join(cacheDir, dataFile!), 'utf-8'));
const ohlcv = rawData.slice(0, 2000);
const closes = ohlcv.map((d: any) => d.close);

// Simulate what enhance() does at bar 750: window of 500 bars
const idx = 750;
const windowStart = Math.max(0, idx - 500);
const window = ohlcv.slice(windowStart, idx + 1);
const windowCloses = closes.slice(windowStart, idx + 1);

const cvdAnalyzer = new CVDAnalyzer(20, 60);
const cvdData = cvdAnalyzer.calculateCVD(window);

// enhance() calls: detectDivergence(closes, cvdData, closes.length - 1)
// where closes = windowCloses, and currentIndex = windowCloses.length - 1 = 500
const currentIndex = windowCloses.length - 1;
console.log(`currentIndex = ${currentIndex}`);
console.log(`lookbackPeriod = 20`);

const lookback = Math.min(20, currentIndex);
const recentCVD = cvdData.slice(currentIndex - lookback, currentIndex + 1).map(d => d.cvd);
console.log(`recentCVD length = ${recentCVD.length}`);
console.log(`recentCVD indices: 0..${recentCVD.length - 1}`);
console.log(`Accessing recentCVD[${currentIndex}] = ${recentCVD[currentIndex]}`);
console.log(`Accessing recentCVD[${recentCVD.length - 1}] = ${recentCVD[recentCVD.length - 1]}`);

// So recentCVD[currentIndex] = recentCVD[500] = undefined
// undefined > number = false
// undefined < number = false
// So both bullish and bearish conditions always fail
console.log(`\nundefined > -1000000 * 1.1 = ${undefined as any > -1000000 * 1.1}`);
console.log(`undefined < -500000 * 0.9 = ${undefined as any < -500000 * 0.9}`);
