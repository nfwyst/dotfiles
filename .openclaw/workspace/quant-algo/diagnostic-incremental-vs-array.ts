/**
 * Diagnostic: Incremental vs Array-Based Output Comparison
 * 
 * For each OCS enhanced sub-processor, this script:
 * 1. Loads real ETHUSDT OHLCV data
 * 2. Runs the OLD array-based method (growing window, like the original enhance() did)
 * 3. Runs the NEW incremental method (feedBar / updateBar)
 * 4. Compares outputs at specific bar indices
 */

import * as fs from 'fs';
import * as path from 'path';

import TRIXSystem from './src/ocs/enhanced/trixSystem';
import { DerivativeFilter } from './src/ocs/enhanced/derivativeFilter';
import CVDAnalyzer from './src/ocs/enhanced/cvdDivergence';
import GaussianStructure from './src/ocs/enhanced/gaussianStructure';
import { ElasticVolumeMA } from './src/ocs/enhanced/elasticVolumeMA';

// ─── Load Data ───────────────────────────────────────────────────────────────

const cacheDir = path.join(process.cwd(), 'backtest-cache');
const dataFile = fs.readdirSync(cacheDir)
  .filter((f: string) => f.includes('ETHUSDT') && f.includes('2025-04-07'))
  .sort()
  .pop();

if (!dataFile) {
  console.error('No ETHUSDT data file found in backtest-cache/');
  process.exit(1);
}

console.log('Loading data from: ' + dataFile);
const rawData: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[] =
  JSON.parse(fs.readFileSync(path.join(cacheDir, dataFile), 'utf-8'));

console.log('Loaded ' + rawData.length + ' candles\n');

const MAX_BARS = Math.min(2000, rawData.length);
const ohlcv = rawData.slice(0, MAX_BARS);
const closes = ohlcv.map((d: any) => d.close);
const volumes = ohlcv.map((d: any) => d.volume);

const CHECK_POINTS = [50, 100, 200, 500, 750, 1000, 1500, 1999].filter((i: number) => i < MAX_BARS);

function report(label: string, arrayVal: number, incVal: number): string {
  const diff = Math.abs(arrayVal - incVal);
  const match = diff < 1e-10 ? 'MATCH' : diff < 1e-6 ? 'CLOSE' : 'DIFFER';
  return '  ' + label + ': array=' + arrayVal.toFixed(8) + ' inc=' + incVal.toFixed(8) + ' diff=' + diff.toExponential(3) + ' [' + match + ']';
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. TRIX SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
console.log('===============================================================');
console.log('1. TRIX SYSTEM');
console.log('===============================================================');

{
  const trixArray = new TRIXSystem(14, 9);

  const trixInc = new TRIXSystem(14, 9);
  trixInc.reset();

  const incResults: any[] = [];
  for (let i = 0; i < MAX_BARS; i++) {
    incResults.push(trixInc.updateBar(closes[i]));
  }

  let firstDivergenceBar = -1;
  let totalDiffs = 0;

  for (const idx of CHECK_POINTS) {
    const allCloses = closes.slice(0, idx + 1);
    const arrayResult = trixArray.calculate(allCloses);
    const arrayLast = arrayResult[arrayResult.length - 1];
    const incLast = incResults[idx];

    console.log('\n  Bar ' + idx + ':');
    console.log(report('trix', arrayLast.trix, incLast.trix));
    console.log(report('signal', arrayLast.signal, incLast.signal));
    console.log(report('histogram', arrayLast.histogram, incLast.histogram));
    console.log('  crossOver: array=' + arrayLast.crossOver + ' inc=' + incLast.crossOver);
    console.log('  crossUnder: array=' + arrayLast.crossUnder + ' inc=' + incLast.crossUnder);

    if (Math.abs(arrayLast.trix - incLast.trix) > 1e-10 && firstDivergenceBar === -1) {
      firstDivergenceBar = idx;
    }
    if (Math.abs(arrayLast.trix - incLast.trix) > 1e-10) totalDiffs++;
  }

  console.log('\n  Signal comparison:');
  for (const idx of CHECK_POINTS) {
    const allCloses = closes.slice(0, idx + 1);
    const arraySig = trixArray.generateSignal(allCloses);

    const prevData = idx > 0 ? incResults[idx - 1] : null;
    const currData = incResults[idx];
    const incSig = prevData
      ? trixInc.generateSignalFromData(currData, prevData)
      : { action: 'hold', confidence: 30 };

    const match = arraySig.action === incSig.action ? 'MATCH' : 'DIFFER';
    console.log('  Bar ' + idx + ': array=' + arraySig.action + '(' + arraySig.confidence + ') inc=' + incSig.action + '(' + incSig.confidence + ') [' + match + ']');
  }

  console.log('\n  TRIX SUMMARY: first divergence at bar ' + firstDivergenceBar + ', total differing checkpoints: ' + totalDiffs + '/' + CHECK_POINTS.length);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. DERIVATIVE FILTER
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n===============================================================');
console.log('2. DERIVATIVE FILTER');
console.log('===============================================================');

{
  const derivInc = new DerivativeFilter(10, 5, 2.0);
  derivInc.reset();
  const incResults: any[] = [];
  for (let i = 0; i < MAX_BARS; i++) {
    incResults.push(derivInc.updateBar(closes[i]));
  }

  let firstDivergenceBar = -1;
  let totalDiffs = 0;
  let totalTrendDiffs = 0;
  let totalSignificantDiffs = 0;

  for (const idx of CHECK_POINTS) {
    const derivArray = new DerivativeFilter(10, 5, 2.0);
    const allCloses = closes.slice(0, idx + 1);
    const arrayResult = derivArray.calculate(allCloses);
    const arrayLast = arrayResult[arrayResult.length - 1];
    const incLast = incResults[idx];

    console.log('\n  Bar ' + idx + ':');
    console.log(report('velocity', arrayLast.velocity, incLast.velocity));
    console.log(report('velocityMA', arrayLast.velocityMA, incLast.velocityMA));
    console.log(report('acceleration', arrayLast.acceleration, incLast.acceleration));
    console.log(report('accelerationMA', arrayLast.accelerationMA, incLast.accelerationMA));
    console.log('  trendState: array=' + arrayLast.trendState + ' inc=' + incLast.trendState + ' [' + (arrayLast.trendState === incLast.trendState ? 'MATCH' : 'DIFFER') + ']');
    console.log('  isSignificantMove: array=' + arrayLast.isSignificantMove + ' inc=' + incLast.isSignificantMove + ' [' + (arrayLast.isSignificantMove === incLast.isSignificantMove ? 'MATCH' : 'DIFFER') + ']');
    console.log('  strength: array=' + arrayLast.strength.toFixed(4) + ' inc=' + incLast.strength.toFixed(4));

    if (Math.abs(arrayLast.velocity - incLast.velocity) > 1e-6 && firstDivergenceBar === -1) {
      firstDivergenceBar = idx;
    }
    if (Math.abs(arrayLast.velocity - incLast.velocity) > 1e-6) totalDiffs++;
    if (arrayLast.trendState !== incLast.trendState) totalTrendDiffs++;
    if (arrayLast.isSignificantMove !== incLast.isSignificantMove) totalSignificantDiffs++;
  }

  console.log('\n  Trading advice comparison:');
  for (const idx of CHECK_POINTS) {
    const derivArray2 = new DerivativeFilter(10, 5, 2.0);
    const allCloses = closes.slice(0, idx + 1);
    const arrayAdvice = derivArray2.getTradingAdvice(allCloses);
    const incAdvice2 = (new DerivativeFilter(10, 5, 2.0)).getTradingAdviceFromData(incResults[idx]);

    const match = arrayAdvice.action === incAdvice2.action ? 'MATCH' : 'DIFFER';
    console.log('  Bar ' + idx + ': array=' + arrayAdvice.action + '(' + arrayAdvice.confidence.toFixed(1) + ') inc=' + incAdvice2.action + '(' + incAdvice2.confidence.toFixed(1) + ') [' + match + ']');
  }

  console.log('\n  DERIVATIVE SUMMARY: velocity diffs: ' + totalDiffs + '/' + CHECK_POINTS.length +
    ', trend state diffs: ' + totalTrendDiffs + '/' + CHECK_POINTS.length +
    ', significantMove diffs: ' + totalSignificantDiffs + '/' + CHECK_POINTS.length);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CVD ANALYZER
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n===============================================================');
console.log('3. CVD ANALYZER');
console.log('===============================================================');

{
  const cvdInc = new CVDAnalyzer(20, 60);
  cvdInc.reset();
  const incResults: any[] = [];
  for (let i = 0; i < MAX_BARS; i++) {
    incResults.push(cvdInc.updateBar(ohlcv[i]));
  }

  let totalDivTypeDiffs = 0;
  let totalCvdValueDiffs = 0;

  for (const idx of CHECK_POINTS) {
    const cvdArray = new CVDAnalyzer(20, 60);
    const allData = ohlcv.slice(0, idx + 1);
    const allCloses = closes.slice(0, idx + 1);
    const cvdData = cvdArray.calculateCVD(allData);
    const arrayDivergence = cvdArray.detectDivergence(allCloses, cvdData, idx);

    const incR = incResults[idx];
    const incCvd = incR.cvdData.cvd;
    const arrayCvd = cvdData[idx].cvd;

    console.log('\n  Bar ' + idx + ':');
    console.log(report('CVD cumulative', arrayCvd, incCvd));
    console.log('  divergence type: array=' + arrayDivergence.type + ' inc=' + incR.divergence.type + ' [' + (arrayDivergence.type === incR.divergence.type ? 'MATCH' : 'DIFFER') + ']');
    if (arrayDivergence.type !== 'none' || incR.divergence.type !== 'none') {
      console.log('  divergence strength: array=' + arrayDivergence.strength.toFixed(2) + ' inc=' + incR.divergence.strength.toFixed(2));
    }

    if (Math.abs(arrayCvd - incCvd) > 1e-6) totalCvdValueDiffs++;
    if (arrayDivergence.type !== incR.divergence.type) totalDivTypeDiffs++;
  }

  // Now test what the REAL backtest does: enhance() passes a WINDOW (last 500 bars)
  console.log('\n  --- Simulating enhance() CVD behavior (windowed) ---');
  for (const idx of [500, 750, 1000, 1500, 1999].filter((i: number) => i < MAX_BARS)) {
    const windowStart = Math.max(0, idx - 500);
    const window = ohlcv.slice(windowStart, idx + 1);
    const windowCloses = closes.slice(windowStart, idx + 1);
    
    // This is what enhance() does: fresh CVDAnalyzer, calculateCVD on window, detectDivergence
    const cvdWindow = new CVDAnalyzer(20, 60);
    const windowCvdData = cvdWindow.calculateCVD(window);
    const windowLocalIdx = idx - windowStart; // index within the window
    const windowDiv = cvdWindow.detectDivergence(windowCloses, windowCvdData, windowLocalIdx);
    
    const incR = incResults[idx];
    
    // The window CVD starts at 0 for bar windowStart
    const windowCvd = windowCvdData[windowLocalIdx].cvd;
    const incCvd = incR.cvdData.cvd;
    
    console.log('\n  Bar ' + idx + ' (window=[' + windowStart + '..' + idx + ']):');
    console.log('    Window CVD (resets at window start): ' + windowCvd.toFixed(2));
    console.log('    Incremental CVD (cumulative from 0): ' + incCvd.toFixed(2));
    console.log('    CVD SCALE RATIO: ' + (incCvd / windowCvd).toFixed(4));
    console.log('    Window divergence: ' + windowDiv.type + ' (str=' + windowDiv.strength.toFixed(1) + ')');
    console.log('    Inc divergence:    ' + incR.divergence.type + ' (str=' + incR.divergence.strength.toFixed(1) + ')');
  }

  console.log('\n  CVD SUMMARY: CVD value diffs: ' + totalCvdValueDiffs + '/' + CHECK_POINTS.length + ', divergence type diffs: ' + totalDivTypeDiffs + '/' + CHECK_POINTS.length);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. GAUSSIAN STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n===============================================================');
console.log('4. GAUSSIAN STRUCTURE');
console.log('===============================================================');

{
  const gaussian = new GaussianStructure(2.0, 20);

  let firstDivergenceBar = -1;
  let totalDiffs = 0;

  const bufCap = 20;
  const buf: number[] = new Array(bufCap).fill(0);
  let bufHead = 0;
  let bufCount = 0;

  const incValues: number[] = [];
  for (let i = 0; i < MAX_BARS; i++) {
    if (bufCount < bufCap) bufCount++;
    buf[bufHead] = closes[i];
    bufHead = (bufHead + 1) % bufCap;

    const gaussData: number[] = new Array(bufCount);
    const start = (bufHead - bufCount + bufCap * 2) % bufCap;
    for (let k = 0; k < bufCount; k++) {
      gaussData[k] = buf[(start + k) % bufCap];
    }
    incValues.push(gaussian.smoothLast(gaussData));
  }

  for (const idx of CHECK_POINTS) {
    // Test 1: smooth(allCloses).value vs smoothLast(last20)
    const allCloses = closes.slice(0, idx + 1);
    const arrayResult = gaussian.smooth(allCloses);
    const arrayVal = arrayResult.value;
    const incVal = incValues[idx];

    // Test 2: what enhance() actually does - smooth on a 500-bar window
    const windowStart = Math.max(0, idx - 500);
    const windowCloses = closes.slice(windowStart, idx + 1);
    const windowResult = gaussian.smooth(windowCloses);
    const windowVal = windowResult.value;

    console.log('\n  Bar ' + idx + ':');
    console.log(report('smooth(all).value', arrayVal, incVal));
    console.log(report('smooth(window).value', windowVal, incVal));

    if (Math.abs(windowVal - incVal) > 1e-6 && firstDivergenceBar === -1) {
      firstDivergenceBar = idx;
    }
    if (Math.abs(windowVal - incVal) > 1e-6) totalDiffs++;
  }

  console.log('\n  GAUSSIAN SUMMARY: first divergence vs window at bar ' + firstDivergenceBar + ', diffs: ' + totalDiffs + '/' + CHECK_POINTS.length);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ELASTIC VOLUME MA
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n===============================================================');
console.log('5. ELASTIC VOLUME MA');
console.log('===============================================================');

{
  const dominantCycle = 20;

  const evmaInc = new ElasticVolumeMA(50);
  evmaInc.reset();
  evmaInc.updateDominantCycle(dominantCycle);
  const incResults: any[] = [];
  for (let i = 0; i < MAX_BARS; i++) {
    incResults.push(evmaInc.updateBar(closes[i], volumes[i]));
  }

  let firstDivergenceBar = -1;
  let totalDiffs = 0;

  for (const idx of CHECK_POINTS) {
    const evmaArray = new ElasticVolumeMA(50);
    evmaArray.updateDominantCycle(dominantCycle);
    const allCloses = closes.slice(0, idx + 1);
    const allVolumes = volumes.slice(0, idx + 1);
    const arrayResult = evmaArray.calculateLatest(allCloses, allVolumes, dominantCycle);
    const incR = incResults[idx];

    console.log('\n  Bar ' + idx + ':');
    console.log(report('value (EVMA)', arrayResult.value, incR.value));
    console.log(report('normalized', arrayResult.normalized, incR.normalized));
    console.log(report('elasticity', arrayResult.elasticity, incR.elasticity));
    console.log('  trend: array=' + arrayResult.trend + ' inc=' + incR.trend + ' [' + (arrayResult.trend === incR.trend ? 'MATCH' : 'DIFFER') + ']');

    if (Math.abs(arrayResult.normalized - incR.normalized) > 1e-6 && firstDivergenceBar === -1) {
      firstDivergenceBar = idx;
    }
    if (Math.abs(arrayResult.normalized - incR.normalized) > 1e-6) totalDiffs++;
  }

  console.log('\n  EVMA SUMMARY: first divergence at bar ' + firstDivergenceBar + ', diffs: ' + totalDiffs + '/' + CHECK_POINTS.length);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. COMBINED: enhance() vs warmup+feedBar+getEnhancedOutput
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n===============================================================');
console.log('6. COMBINED: enhance() vs warmup+feedBar+getEnhancedOutput');
console.log('===============================================================');

{
  const { OCSEnhanced } = await import('./src/ocs/enhanced/index');

  const ocsInc = new OCSEnhanced();
  const warmupEnd = 200;
  ocsInc.warmup(ohlcv.slice(0, warmupEnd));

  const incOutputs: any[] = new Array(MAX_BARS).fill(null);
  for (let i = warmupEnd; i < MAX_BARS; i++) {
    ocsInc.feedBar(ohlcv[i]);
    if (CHECK_POINTS.includes(i)) {
      incOutputs[i] = ocsInc.getEnhancedOutput({ signal: 'hold', confidence: 50 });
    }
  }

  let combinedActionDiffs = 0;

  for (const idx of CHECK_POINTS) {
    if (idx < warmupEnd) continue;

    const ocsArray = new OCSEnhanced();
    const windowStart = Math.max(0, idx - 500);
    const window = ohlcv.slice(windowStart, idx + 1);
    const l2Mock = { dominantCycle: { period: 20 } };
    const l3Mock = { signal: 'hold', confidence: 50 };
    const arrayOutput = ocsArray.enhance(window, l2Mock, l3Mock);
    const incOutput = incOutputs[idx];

    if (!incOutput) continue;

    const actionMatch = arrayOutput.combinedSignal.action === incOutput.combinedSignal.action;
    if (!actionMatch) combinedActionDiffs++;

    console.log('\n  Bar ' + idx + ' (window=[' + windowStart + '..' + idx + ']):');
    console.log('    gaussian: array=' + arrayOutput.layer1Enhanced.gaussianSmoothed.toFixed(4) + ' inc=' + incOutput.layer1Enhanced.gaussianSmoothed.toFixed(4));
    console.log('    elasticVMA: array=' + arrayOutput.layer2Enhanced.elasticVMA.toFixed(6) + ' inc=' + incOutput.layer2Enhanced.elasticVMA.toFixed(6));
    console.log('    cvdDiv: array=' + (arrayOutput.layer2Enhanced.cvdDivergence?.type || 'none') + ' inc=' + (incOutput.layer2Enhanced.cvdDivergence?.type || 'none'));
    console.log('    trix: array=' + arrayOutput.layer3Enhanced.trixSignal + '(' + arrayOutput.layer3Enhanced.trixConfidence + ') inc=' + incOutput.layer3Enhanced.trixSignal + '(' + incOutput.layer3Enhanced.trixConfidence + ')');
    console.log('    derivative: array=' + arrayOutput.layer4Enhanced.derivativeAdvice + '(' + arrayOutput.layer4Enhanced.derivativeConfidence.toFixed(1) + ') inc=' + incOutput.layer4Enhanced.derivativeAdvice + '(' + incOutput.layer4Enhanced.derivativeConfidence.toFixed(1) + ')');
    console.log('    combined: array=' + arrayOutput.combinedSignal.action + '(' + arrayOutput.combinedSignal.confidence.toFixed(1) + ') inc=' + incOutput.combinedSignal.action + '(' + incOutput.combinedSignal.confidence.toFixed(1) + ')');
    console.log('    ACTION MATCH: ' + (actionMatch ? 'YES' : '*** NO ***'));
  }

  console.log('\n  COMBINED SUMMARY: action mismatches: ' + combinedActionDiffs + '/' + CHECK_POINTS.filter((i: number) => i >= warmupEnd).length);
}

console.log('\n\nDiagnostic complete.');
