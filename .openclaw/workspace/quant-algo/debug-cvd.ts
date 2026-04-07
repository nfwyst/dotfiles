import * as fs from 'fs';
import * as path from 'path';
import CVDAnalyzer from './src/ocs/enhanced/cvdDivergence';

const cacheDir = path.join(process.cwd(), 'backtest-cache');
const dataFile = fs.readdirSync(cacheDir)
  .filter((f: string) => f.includes('ETHUSDT') && f.includes('2025-04-07'))
  .sort()
  .pop();

const rawData = JSON.parse(fs.readFileSync(path.join(cacheDir, dataFile!), 'utf-8'));
const ohlcv = rawData.slice(0, 2000);
const closes = ohlcv.map((d: any) => d.close);

// Incremental path
const cvdInc = new CVDAnalyzer(20, 60);
cvdInc.reset();
const incResults: any[] = [];
for (let i = 0; i < ohlcv.length; i++) {
  incResults.push(cvdInc.updateBar(ohlcv[i]));
}

// Simulate what enhance() does at bar 750
for (const idx of [200, 500, 750, 1000, 1500, 1999]) {
  const windowStart = Math.max(0, idx - 500);
  const window = ohlcv.slice(windowStart, idx + 1);
  const windowCloses = closes.slice(windowStart, idx + 1);

  const cvdWindow = new CVDAnalyzer(20, 60);
  const windowCvdData = cvdWindow.calculateCVD(window);
  const windowLocalIdx = idx - windowStart;

  const arrayDiv = cvdWindow.detectDivergence(windowCloses, windowCvdData, windowLocalIdx);
  const incR = incResults[idx];

  // Array path: recentCVD = last 21 cvd values from window's cumulative CVD
  const recentCVDarray = windowCvdData.slice(windowLocalIdx - 20, windowLocalIdx + 1).map(d => d.cvd);
  const arrayCvdMin = Math.min(...recentCVDarray);
  const arrayCvdMax = Math.max(...recentCVDarray);
  const arrayCvdCurrent = recentCVDarray[recentCVDarray.length - 1];

  // Fresh CVD over just the last 21 bars (like incremental buffer)
  const last21data = ohlcv.slice(idx - 20, idx + 1);
  const cvdFresh = new CVDAnalyzer(20, 60);
  const freshCvdData = cvdFresh.calculateCVD(last21data);
  const freshRecentCVD = freshCvdData.map(d => d.cvd);
  const freshCvdMin = Math.min(...freshRecentCVD);
  const freshCvdMax = Math.max(...freshRecentCVD);
  const freshCvdCurrent = freshRecentCVD[freshRecentCVD.length - 1];

  const currentPrice = windowCloses[windowLocalIdx];
  const priceSlice = windowCloses.slice(windowLocalIdx - 20, windowLocalIdx + 1);
  const priceMin = Math.min(...priceSlice);
  const priceMax = Math.max(...priceSlice);

  console.log(`\n=== Bar ${idx} ===`);
  console.log(`  Array div: ${arrayDiv.type} (str=${arrayDiv.strength.toFixed(1)})`);
  console.log(`  Inc div:   ${incR.divergence.type} (str=${incR.divergence.strength.toFixed(1)})`);
  console.log(`  Price: cur=${currentPrice.toFixed(2)}, min=${priceMin.toFixed(2)}, max=${priceMax.toFixed(2)}`);
  console.log(`  Array CVD window (last 21): min=${arrayCvdMin.toFixed(2)}, max=${arrayCvdMax.toFixed(2)}, cur=${arrayCvdCurrent.toFixed(2)}`);
  console.log(`  Fresh CVD (21-bar reset):   min=${freshCvdMin.toFixed(2)}, max=${freshCvdMax.toFixed(2)}, cur=${freshCvdCurrent.toFixed(2)}`);
  console.log(`  Array: near_min=${currentPrice <= priceMin * 1.01}, cvd>min*1.1=${arrayCvdCurrent > arrayCvdMin * 1.1}`);
  console.log(`  Fresh: near_min=${currentPrice <= priceMin * 1.01}, cvd>min*1.1=${freshCvdCurrent > freshCvdMin * 1.1}`);
  console.log(`  Array: near_max=${currentPrice >= priceMax * 0.99}, cvd<max*0.9=${arrayCvdCurrent < arrayCvdMax * 0.9}`);
  console.log(`  Fresh: near_max=${currentPrice >= priceMax * 0.99}, cvd<max*0.9=${freshCvdCurrent < freshCvdMax * 0.9}`);
  
  // The critical difference: array path uses CVD accumulated from window start
  // Fresh/incremental uses CVD accumulated from the 20-bar lookback start
  // When CVD values have a large offset, the 10% thresholds (1.1 / 0.9 multipliers) behave differently
  const arrayRange = arrayCvdMax - arrayCvdMin;
  const freshRange = freshCvdMax - freshCvdMin;
  console.log(`  Array CVD range: ${arrayRange.toFixed(2)}`);
  console.log(`  Fresh CVD range: ${freshRange.toFixed(2)}`);
  console.log(`  Ranges equal? ${Math.abs(arrayRange - freshRange) < 0.01}`);
}
