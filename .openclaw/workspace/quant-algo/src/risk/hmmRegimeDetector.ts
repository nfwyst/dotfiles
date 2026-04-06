/**
 * HMM Regime Detection for Crypto Markets
 *
 * 3-state Gaussian HMM trained on returns + volatility features.
 * Uses Baum-Welch (EM) for parameter estimation and Viterbi for decoding.
 *
 * References:
 * - "HMM-based regime detection for cryptocurrency trading" (2026)
 * - "PPO-HMM for adaptive crypto strategies" (2025)
 */

import { OHLCV } from '../events/types';

// ---------------------------------------------------------------------------
// Public enums & interfaces
// ---------------------------------------------------------------------------

export enum MarketRegime {
  LOW_VOL = 0,   // Calm / trending
  HIGH_VOL = 1,  // Volatile / uncertain
  CRISIS = 2,    // Crash / extreme risk
}

export interface RegimeConfig {
  /** Number of HMM states */
  numStates: number;
  /** Lookback for volatility calculation */
  volLookback: number;
  /** Minimum observations for training */
  minObservations: number;
  /** EM convergence tolerance */
  emTolerance: number;
  /** Maximum EM iterations */
  maxEmIterations: number;
  /** Rolling window for regime detection */
  rollingWindow: number;
  /** Retrain interval (number of new observations before retraining) */
  retrainInterval: number;
}

export interface RegimeResult {
  /** Current detected regime */
  regime: MarketRegime;
  /** Regime label */
  label: string;
  /** Probability of each regime */
  probabilities: number[];
  /** Recommended position scaling factor [0, 1] */
  positionScaling: number;
  /** Recommended parameter adjustments */
  parameterAdjustments: {
    /** Ehlers cycle fast limit adjustment */
    ehlersFastLimit: number;
    /** Risk multiplier */
    riskMultiplier: number;
    /** Signal confidence threshold adjustment */
    confidenceThreshold: number;
  };
  /** Whether the model has been trained */
  isTrained: boolean;
  /** Number of observations used */
  observationCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REGIME_LABELS: Record<MarketRegime, string> = {
  [MarketRegime.LOW_VOL]: 'LOW_VOL',
  [MarketRegime.HIGH_VOL]: 'HIGH_VOL',
  [MarketRegime.CRISIS]: 'CRISIS',
};

/** Annualisation factor for crypto (365 days * 288 five-minute bars per day). */
const ANNUALISATION_FACTOR = Math.sqrt(365 * 288);

/** Tiny constant to avoid log(0) / division-by-zero. */
const EPS = 1e-300;

/** Minimum variance floor to prevent degenerate Gaussians. */
const MIN_VARIANCE = 1e-10;

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: RegimeConfig = {
  numStates: 3,
  volLookback: 20,
  minObservations: 100,
  emTolerance: 1e-6,
  maxEmIterations: 100,
  rollingWindow: 365,
  retrainInterval: 50,
};

// ---------------------------------------------------------------------------
// HMMRegimeDetector
// ---------------------------------------------------------------------------

export class HMMRegimeDetector {
  private config: RegimeConfig;

  // HMM parameters ---------------------------------------------------------
  private pi: number[];            // Initial state distribution  (N)
  private A: number[][];           // Transition matrix           (N x N)
  private means: number[][];       // Emission means              (N x D)
  private variances: number[][];   // Emission variances (diag)   (N x D)

  // State-to-regime mapping (sorted by mean volatility) --------------------
  private stateMap: number[] = [];

  // Data -------------------------------------------------------------------
  private observations: number[][] = [];
  private rawOhlcv: OHLCV[] = [];
  private isTrained: boolean = false;
  private observationsSinceTraining: number = 0;

  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  constructor(config?: Partial<RegimeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    const N = this.config.numStates;

    // Uniform initial distribution
    this.pi = new Array(N).fill(1 / N);

    // Uniform transition matrix
    this.A = Array.from({ length: N }, () => new Array(N).fill(1 / N));

    // Zero means, unit variances (will be overwritten by K-means init)
    const D = 3; // feature dimensionality
    this.means = Array.from({ length: N }, () => new Array(D).fill(0));
    this.variances = Array.from({ length: N }, () => new Array(D).fill(1));

    // Identity mapping until training sorts states
    this.stateMap = Array.from({ length: N }, (_, i) => i);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Feed a single new OHLCV candle and obtain a regime detection result.
   * The model auto-trains once enough data has accumulated and auto-retrains
   * after every retrainInterval new observations.
   */
  update(candle: OHLCV): RegimeResult {
    this.rawOhlcv.push(candle);

    // Keep a rolling window of raw data to bound memory
    if (this.rawOhlcv.length > this.config.rollingWindow + this.config.volLookback + 2) {
      this.rawOhlcv = this.rawOhlcv.slice(
        this.rawOhlcv.length - this.config.rollingWindow - this.config.volLookback - 2,
      );
    }

    // Re-extract features from the full retained window
    this.observations = this.extractFeatures();

    this.observationsSinceTraining++;

    // Train / retrain when appropriate
    const needsInitialTraining =
      !this.isTrained && this.observations.length >= this.config.minObservations;
    const needsRetraining =
      this.isTrained && this.observationsSinceTraining >= this.config.retrainInterval;

    if (needsInitialTraining || needsRetraining) {
      this.train(this.observations);
      this.isTrained = true;
      this.observationsSinceTraining = 0;
    }

    return this.getCurrentRegime();
  }

  /**
   * Batch update with multiple candles (e.g. historical initialisation).
   * Returns the regime result after the last candle.
   */
  batchUpdate(candles: OHLCV[]): RegimeResult {
    if (candles.length === 0) {
      return this.getCurrentRegime();
    }

    // Append all candles at once
    this.rawOhlcv.push(...candles);

    // Trim to rolling window
    if (this.rawOhlcv.length > this.config.rollingWindow + this.config.volLookback + 2) {
      this.rawOhlcv = this.rawOhlcv.slice(
        this.rawOhlcv.length - this.config.rollingWindow - this.config.volLookback - 2,
      );
    }

    this.observations = this.extractFeatures();
    this.observationsSinceTraining += candles.length;

    // Train if we have enough data
    if (this.observations.length >= this.config.minObservations) {
      this.train(this.observations);
      this.isTrained = true;
      this.observationsSinceTraining = 0;
    }

    return this.getCurrentRegime();
  }

  /**
   * Return the current regime without ingesting new data.
   */
  getCurrentRegime(): RegimeResult {
    if (!this.isTrained || this.observations.length === 0) {
      return this.defaultResult();
    }

    // Run Viterbi on the full observation window to get the last state
    const stateSequence = this.viterbi(this.observations);
    const lastState = stateSequence[stateSequence.length - 1];
    const regime = this.mapStateToRegime(lastState);

    // Compute the filtered probability of each regime at the last time step
    const { alpha } = this.forward(this.observations);
    const T = this.observations.length;

    // alpha is already scaled so that sum_i alpha[t][i] = 1 at each t
    const lastAlpha = alpha[T - 1];
    const probabilities = this.regimeProbabilities(lastAlpha);

    const positionScaling = this.getPositionScaling(regime, probabilities);
    const parameterAdjustments = this.getParameterAdjustments(regime);

    return {
      regime,
      label: REGIME_LABELS[regime],
      probabilities,
      positionScaling,
      parameterAdjustments,
      isTrained: true,
      observationCount: this.observations.length,
    };
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  serialize(): string {
    return JSON.stringify({
      config: this.config,
      pi: this.pi,
      A: this.A,
      means: this.means,
      variances: this.variances,
      stateMap: this.stateMap,
      observations: this.observations,
      rawOhlcv: this.rawOhlcv,
      isTrained: this.isTrained,
      observationsSinceTraining: this.observationsSinceTraining,
    });
  }

  static deserialize(json: string): HMMRegimeDetector {
    const data = JSON.parse(json);
    const detector = new HMMRegimeDetector(data.config);
    detector.pi = data.pi;
    detector.A = data.A;
    detector.means = data.means;
    detector.variances = data.variances;
    detector.stateMap = data.stateMap;
    detector.observations = data.observations;
    detector.rawOhlcv = data.rawOhlcv;
    detector.isTrained = data.isTrained;
    detector.observationsSinceTraining = data.observationsSinceTraining;
    return detector;
  }

  // -----------------------------------------------------------------------
  // Feature extraction
  // -----------------------------------------------------------------------

  /**
   * Extract feature vectors from the stored OHLCV data.
   *
   * For each time step t (starting from volLookback + 1) we produce:
   *   [logReturn, realizedVol, volumeChange]
   *
   * - logReturn      = ln(close[t] / close[t-1])
   * - realizedVol    = std(logReturns over volLookback) * sqrt(365*288)
   * - volumeChange   = ln(volume[t] / mean(volume over volLookback))
   */
  private extractFeatures(): number[][] {
    const ohlcv = this.rawOhlcv;
    const L = this.config.volLookback;

    // Need at least L+2 candles to produce the first feature row
    // (L candles for the lookback window, 1 preceding candle for the first
    //  log return inside the window, and the current candle itself)
    if (ohlcv.length < L + 2) {
      return [];
    }

    // Pre-compute log returns for the entire series
    const logReturns: number[] = new Array(ohlcv.length);
    logReturns[0] = 0;
    for (let i = 1; i < ohlcv.length; i++) {
      const prev = ohlcv[i - 1].close;
      const cur = ohlcv[i].close;
      // Guard against zero / negative prices
      if (prev <= 0 || cur <= 0) {
        logReturns[i] = 0;
      } else {
        logReturns[i] = Math.log(cur / prev);
      }
    }

    const features: number[][] = [];

    for (let t = L + 1; t < ohlcv.length; t++) {
      // --- 1. Log return at t ---
      const logRet = logReturns[t];

      // --- 2. Realised volatility (rolling std of log returns * annualisation) ---
      let sumRet = 0;
      let sumRetSq = 0;
      for (let j = t - L; j < t; j++) {
        sumRet += logReturns[j];
        sumRetSq += logReturns[j] * logReturns[j];
      }
      const meanRet = sumRet / L;
      let variance = sumRetSq / L - meanRet * meanRet;
      if (variance < 0) variance = 0; // numerical guard
      const realizedVol = Math.sqrt(variance) * ANNUALISATION_FACTOR;

      // --- 3. Volume change: ln(volume[t] / mean(volume over lookback)) ---
      let volSum = 0;
      for (let j = t - L; j < t; j++) {
        volSum += ohlcv[j].volume;
      }
      const meanVol = volSum / L;
      const curVol = ohlcv[t].volume;
      let volumeChange: number;
      if (meanVol <= 0 || curVol <= 0) {
        volumeChange = 0;
      } else {
        volumeChange = Math.log(curVol / meanVol);
      }

      features.push([logRet, realizedVol, volumeChange]);
    }

    return features;
  }

  // -----------------------------------------------------------------------
  // Training: Baum-Welch (EM)
  // -----------------------------------------------------------------------

  /**
   * Train the HMM on the given observation matrix using Baum-Welch EM.
   *
   * Steps:
   *  1. K-means initialisation for means/variances + uniform pi/A.
   *  2. E-step: forward-backward to obtain gamma and xi.
   *  3. M-step: re-estimate pi, A, means, variances.
   *  4. Iterate until log-likelihood converges or max iterations reached.
   *  5. Sort states by mean volatility to build stateMap.
   */
  private train(observations: number[][]): void {
    const N = this.config.numStates;
    const T = observations.length;
    const D = observations[0].length;

    // 1. Initialise parameters with K-means
    this.initializeWithKMeans(observations, N);

    let prevLogLikelihood = -Infinity;

    for (let iter = 0; iter < this.config.maxEmIterations; iter++) {
      // ---- E-step ----
      const { alpha, scalingFactors } = this.forward(observations);
      const beta = this.backward(observations, scalingFactors);

      // gamma[t][i] = P(state_t = i | O)
      const gamma: number[][] = Array.from({ length: T }, () => new Array(N).fill(0));
      // xi[t][i][j] = P(state_t = i, state_{t+1} = j | O)
      const xi: number[][][] = Array.from({ length: T - 1 }, () =>
        Array.from({ length: N }, () => new Array(N).fill(0)),
      );

      // Compute gamma
      for (let t = 0; t < T; t++) {
        let norm = 0;
        for (let i = 0; i < N; i++) {
          gamma[t][i] = alpha[t][i] * beta[t][i];
          norm += gamma[t][i];
        }
        if (norm > 0) {
          for (let i = 0; i < N; i++) {
            gamma[t][i] /= norm;
          }
        }
      }

      // Compute xi
      for (let t = 0; t < T - 1; t++) {
        let norm = 0;
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            const emProb = this.gaussianPdf(
              observations[t + 1],
              this.means[j],
              this.variances[j],
            );
            xi[t][i][j] = alpha[t][i] * this.A[i][j] * emProb * beta[t + 1][j];
            norm += xi[t][i][j];
          }
        }
        if (norm > 0) {
          for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
              xi[t][i][j] /= norm;
            }
          }
        }
      }

      // ---- M-step ----

      // Update pi
      for (let i = 0; i < N; i++) {
        this.pi[i] = gamma[0][i];
      }

      // Update A
      for (let i = 0; i < N; i++) {
        let gammaSum = 0;
        for (let t = 0; t < T - 1; t++) {
          gammaSum += gamma[t][i];
        }
        for (let j = 0; j < N; j++) {
          let xiSum = 0;
          for (let t = 0; t < T - 1; t++) {
            xiSum += xi[t][i][j];
          }
          this.A[i][j] = gammaSum > 0 ? xiSum / gammaSum : 1 / N;
        }
      }

      // Update means
      for (let i = 0; i < N; i++) {
        let gammaSum = 0;
        for (let t = 0; t < T; t++) {
          gammaSum += gamma[t][i];
        }
        for (let d = 0; d < D; d++) {
          let weightedSum = 0;
          for (let t = 0; t < T; t++) {
            weightedSum += gamma[t][i] * observations[t][d];
          }
          this.means[i][d] = gammaSum > 0 ? weightedSum / gammaSum : 0;
        }
      }

      // Update variances
      for (let i = 0; i < N; i++) {
        let gammaSum = 0;
        for (let t = 0; t < T; t++) {
          gammaSum += gamma[t][i];
        }
        for (let d = 0; d < D; d++) {
          let weightedSqSum = 0;
          for (let t = 0; t < T; t++) {
            const diff = observations[t][d] - this.means[i][d];
            weightedSqSum += gamma[t][i] * diff * diff;
          }
          this.variances[i][d] = gammaSum > 0 ? weightedSqSum / gammaSum : 1;
          // Enforce variance floor
          if (this.variances[i][d] < MIN_VARIANCE) {
            this.variances[i][d] = MIN_VARIANCE;
          }
        }
      }

      // Compute log-likelihood from scaling factors
      let logLikelihood = 0;
      for (let t = 0; t < T; t++) {
        logLikelihood += Math.log(scalingFactors[t] + EPS);
      }

      // Check convergence
      if (Math.abs(logLikelihood - prevLogLikelihood) < this.config.emTolerance) {
        break;
      }
      prevLogLikelihood = logLikelihood;
    }

    // Build state-to-regime mapping: sort by mean volatility (feature index 1)
    this.buildStateMap();
  }

  // -----------------------------------------------------------------------
  // Forward algorithm (scaled)
  // -----------------------------------------------------------------------

  /**
   * Scaled forward algorithm.
   *
   * Returns alpha[t][i] and the per-step scaling factors c[t].
   * After scaling, sum_i alpha[t][i] = 1 for every t.
   * The log-likelihood equals sum_t log(c[t]).
   */
  private forward(obs: number[][]): { alpha: number[][]; scalingFactors: number[] } {
    const T = obs.length;
    const N = this.config.numStates;

    const alpha: number[][] = Array.from({ length: T }, () => new Array(N).fill(0));
    const scalingFactors: number[] = new Array(T).fill(0);

    // t = 0
    let c0 = 0;
    for (let i = 0; i < N; i++) {
      alpha[0][i] = this.pi[i] * this.gaussianPdf(obs[0], this.means[i], this.variances[i]);
      c0 += alpha[0][i];
    }
    c0 = c0 > 0 ? c0 : EPS;
    scalingFactors[0] = c0;
    for (let i = 0; i < N; i++) {
      alpha[0][i] /= c0;
    }

    // t = 1 ... T-1
    for (let t = 1; t < T; t++) {
      let ct = 0;
      for (let j = 0; j < N; j++) {
        let sum = 0;
        for (let i = 0; i < N; i++) {
          sum += alpha[t - 1][i] * this.A[i][j];
        }
        alpha[t][j] = sum * this.gaussianPdf(obs[t], this.means[j], this.variances[j]);
        ct += alpha[t][j];
      }
      ct = ct > 0 ? ct : EPS;
      scalingFactors[t] = ct;
      for (let j = 0; j < N; j++) {
        alpha[t][j] /= ct;
      }
    }

    return { alpha, scalingFactors };
  }

  // -----------------------------------------------------------------------
  // Backward algorithm (scaled)
  // -----------------------------------------------------------------------

  /**
   * Scaled backward algorithm, using the same scaling factors from forward.
   */
  private backward(obs: number[][], scalingFactors: number[]): number[][] {
    const T = obs.length;
    const N = this.config.numStates;

    const beta: number[][] = Array.from({ length: T }, () => new Array(N).fill(0));

    // t = T-1 (initialise)
    for (let i = 0; i < N; i++) {
      beta[T - 1][i] = 1;
    }

    // t = T-2 ... 0
    for (let t = T - 2; t >= 0; t--) {
      for (let i = 0; i < N; i++) {
        let sum = 0;
        for (let j = 0; j < N; j++) {
          sum +=
            this.A[i][j] *
            this.gaussianPdf(obs[t + 1], this.means[j], this.variances[j]) *
            beta[t + 1][j];
        }
        beta[t][i] = sum;
      }
      // Scale with the *next* time step's factor (same factor used for alpha[t+1])
      const ct1 = scalingFactors[t + 1] > 0 ? scalingFactors[t + 1] : EPS;
      for (let i = 0; i < N; i++) {
        beta[t][i] /= ct1;
      }
    }

    return beta;
  }

  // -----------------------------------------------------------------------
  // Viterbi algorithm
  // -----------------------------------------------------------------------

  /**
   * Viterbi decoding in log-space for numerical stability.
   * Returns the most likely state sequence.
   */
  private viterbi(obs: number[][]): number[] {
    const T = obs.length;
    const N = this.config.numStates;

    // delta[t][i] = best log-prob of path ending in state i at time t
    const delta: number[][] = Array.from({ length: T }, () => new Array(N).fill(-Infinity));
    // psi[t][i] = argmax predecessor state for backtracking
    const psi: number[][] = Array.from({ length: T }, () => new Array(N).fill(0));

    // Initialisation
    for (let i = 0; i < N; i++) {
      delta[0][i] =
        Math.log(this.pi[i] + EPS) +
        this.logGaussianPdf(obs[0], this.means[i], this.variances[i]);
    }

    // Recursion
    for (let t = 1; t < T; t++) {
      for (let j = 0; j < N; j++) {
        let bestVal = -Infinity;
        let bestIdx = 0;
        for (let i = 0; i < N; i++) {
          const val = delta[t - 1][i] + Math.log(this.A[i][j] + EPS);
          if (val > bestVal) {
            bestVal = val;
            bestIdx = i;
          }
        }
        delta[t][j] =
          bestVal + this.logGaussianPdf(obs[t], this.means[j], this.variances[j]);
        psi[t][j] = bestIdx;
      }
    }

    // Termination
    const states: number[] = new Array(T);
    let bestFinal = -Infinity;
    states[T - 1] = 0;
    for (let i = 0; i < N; i++) {
      if (delta[T - 1][i] > bestFinal) {
        bestFinal = delta[T - 1][i];
        states[T - 1] = i;
      }
    }

    // Backtracking
    for (let t = T - 2; t >= 0; t--) {
      states[t] = psi[t + 1][states[t + 1]];
    }

    return states;
  }

  // -----------------------------------------------------------------------
  // Gaussian PDF helpers
  // -----------------------------------------------------------------------

  /**
   * Multivariate Gaussian PDF under diagonal covariance.
   * p(x | mu, sigma^2) = prod_d  N(x_d; mu_d, sigma^2_d)
   */
  private gaussianPdf(x: number[], mean: number[], variance: number[]): number {
    const D = x.length;
    let logP = 0;
    for (let d = 0; d < D; d++) {
      const v = variance[d] > MIN_VARIANCE ? variance[d] : MIN_VARIANCE;
      const diff = x[d] - mean[d];
      logP += -0.5 * Math.log(2 * Math.PI * v) - (diff * diff) / (2 * v);
    }
    // Clamp to avoid underflow producing exactly 0
    return Math.exp(Math.max(logP, -700));
  }

  /**
   * Log of multivariate Gaussian PDF (diagonal covariance).
   */
  private logGaussianPdf(x: number[], mean: number[], variance: number[]): number {
    const D = x.length;
    let logP = 0;
    for (let d = 0; d < D; d++) {
      const v = variance[d] > MIN_VARIANCE ? variance[d] : MIN_VARIANCE;
      const diff = x[d] - mean[d];
      logP += -0.5 * Math.log(2 * Math.PI * v) - (diff * diff) / (2 * v);
    }
    return logP;
  }

  // -----------------------------------------------------------------------
  // K-means initialisation
  // -----------------------------------------------------------------------

  /**
   * Simple K-means clustering to seed the HMM emission means and variances.
   * Also resets pi to uniform and A to a mildly self-sticky matrix.
   *
   * Uses deterministic K-means++ seeding (farthest-point heuristic) for
   * reproducible convergence.
   */
  private initializeWithKMeans(obs: number[][], k: number): void {
    const T = obs.length;
    const D = obs[0].length;

    // ---------- Seed centroids deterministically with K-means++ ----------
    const centroids: number[][] = [];

    // First centroid: pick the observation closest to the global mean
    const globalMean = new Array(D).fill(0);
    for (let t = 0; t < T; t++) {
      for (let d = 0; d < D; d++) {
        globalMean[d] += obs[t][d];
      }
    }
    for (let d = 0; d < D; d++) {
      globalMean[d] /= T;
    }

    let bestIdx = 0;
    let bestDist = Infinity;
    for (let t = 0; t < T; t++) {
      const dist = this.squaredDistance(obs[t], globalMean);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = t;
      }
    }
    centroids.push([...obs[bestIdx]]);

    // Subsequent centroids: deterministic K-means++ (pick the farthest point)
    while (centroids.length < k) {
      let farthestIdx = 0;
      let farthestDist = -1;
      for (let t = 0; t < T; t++) {
        let minDist = Infinity;
        for (const c of centroids) {
          const d = this.squaredDistance(obs[t], c);
          if (d < minDist) minDist = d;
        }
        if (minDist > farthestDist) {
          farthestDist = minDist;
          farthestIdx = t;
        }
      }
      centroids.push([...obs[farthestIdx]]);
    }

    // ---------- K-means iterations ----------
    const assignments = new Array(T).fill(0);
    const MAX_KMEANS_ITER = 50;

    for (let iter = 0; iter < MAX_KMEANS_ITER; iter++) {
      // Assign each observation to the nearest centroid
      let changed = false;
      for (let t = 0; t < T; t++) {
        let bestC = 0;
        let bestD = Infinity;
        for (let c = 0; c < k; c++) {
          const d = this.squaredDistance(obs[t], centroids[c]);
          if (d < bestD) {
            bestD = d;
            bestC = c;
          }
        }
        if (assignments[t] !== bestC) {
          assignments[t] = bestC;
          changed = true;
        }
      }

      // Recompute centroids
      const counts = new Array(k).fill(0);
      const sums: number[][] = Array.from({ length: k }, () => new Array(D).fill(0));
      for (let t = 0; t < T; t++) {
        const c = assignments[t];
        counts[c]++;
        for (let d = 0; d < D; d++) {
          sums[c][d] += obs[t][d];
        }
      }
      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
          for (let d = 0; d < D; d++) {
            centroids[c][d] = sums[c][d] / counts[c];
          }
        }
      }

      if (!changed) break;
    }

    // ---------- Derive HMM parameters from clustering ----------

    // Means = cluster centroids
    for (let i = 0; i < k; i++) {
      this.means[i] = [...centroids[i]];
    }

    // Variances = within-cluster variance per dimension
    const varSums: number[][] = Array.from({ length: k }, () => new Array(D).fill(0));
    const counts = new Array(k).fill(0);
    for (let t = 0; t < T; t++) {
      const c = assignments[t];
      counts[c]++;
      for (let d = 0; d < D; d++) {
        const diff = obs[t][d] - centroids[c][d];
        varSums[c][d] += diff * diff;
      }
    }
    for (let i = 0; i < k; i++) {
      for (let d = 0; d < D; d++) {
        this.variances[i][d] = counts[i] > 1 ? varSums[i][d] / counts[i] : 1;
        if (this.variances[i][d] < MIN_VARIANCE) {
          this.variances[i][d] = MIN_VARIANCE;
        }
      }
    }

    // Uniform initial distribution
    this.pi = new Array(k).fill(1 / k);

    // Mildly self-sticky transition matrix (0.7 self, rest uniform)
    const selfProb = 0.7;
    const otherProb = (1 - selfProb) / (k - 1);
    this.A = Array.from({ length: k }, (_, i) =>
      Array.from({ length: k }, (_, j) => (i === j ? selfProb : otherProb)),
    );
  }

  // -----------------------------------------------------------------------
  // State-to-regime mapping
  // -----------------------------------------------------------------------

  /**
   * Build the mapping from HMM state index to MarketRegime by sorting states
   * according to their mean volatility (feature index 1).
   *
   *   lowest mean vol  -> LOW_VOL
   *   middle           -> HIGH_VOL
   *   highest mean vol -> CRISIS
   */
  private buildStateMap(): void {
    const N = this.config.numStates;

    // Create (state, meanVol) pairs and sort ascending by volatility
    const indexed = this.means.map((m, i) => ({ state: i, vol: m[1] }));
    indexed.sort((a, b) => a.vol - b.vol);

    this.stateMap = new Array(N);
    for (let rank = 0; rank < N; rank++) {
      const regime =
        rank === 0
          ? MarketRegime.LOW_VOL
          : rank === N - 1
            ? MarketRegime.CRISIS
            : MarketRegime.HIGH_VOL;
      this.stateMap[indexed[rank].state] = regime;
    }
  }

  private mapStateToRegime(state: number): MarketRegime {
    return this.stateMap[state] ?? MarketRegime.HIGH_VOL;
  }

  // -----------------------------------------------------------------------
  // Regime-aware risk management helpers
  // -----------------------------------------------------------------------

  /**
   * Convert raw alpha (filtered probabilities per HMM state) to probabilities
   * per MarketRegime.
   */
  private regimeProbabilities(alpha: number[]): number[] {
    const N = this.config.numStates;
    const probs = [0, 0, 0]; // LOW_VOL, HIGH_VOL, CRISIS

    for (let i = 0; i < N; i++) {
      const regime = this.stateMap[i];
      probs[regime] += alpha[i];
    }

    // Normalise (should already sum to ~1)
    const total = probs[0] + probs[1] + probs[2];
    if (total > 0) {
      probs[0] /= total;
      probs[1] /= total;
      probs[2] /= total;
    }

    return probs;
  }

  /**
   * Position scaling blended by regime probabilities for smooth transitions.
   *
   * Base scalings:
   *   LOW_VOL  -> 1.0
   *   HIGH_VOL -> 0.5
   *   CRISIS   -> 0.2
   */
  private getPositionScaling(regime: MarketRegime, probabilities: number[]): number {
    const baseScales = [1.0, 0.5, 0.2]; // LOW_VOL, HIGH_VOL, CRISIS

    // Probability-weighted blend
    let scaling = 0;
    for (let r = 0; r < 3; r++) {
      scaling += probabilities[r] * baseScales[r];
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, scaling));
  }

  /**
   * Regime-dependent parameter adjustments.
   */
  private getParameterAdjustments(
    regime: MarketRegime,
  ): RegimeResult['parameterAdjustments'] {
    switch (regime) {
      case MarketRegime.LOW_VOL:
        return {
          ehlersFastLimit: 0.5,
          riskMultiplier: 1.0,
          confidenceThreshold: 0.6,
        };
      case MarketRegime.HIGH_VOL:
        return {
          ehlersFastLimit: 0.7,
          riskMultiplier: 0.6,
          confidenceThreshold: 0.75,
        };
      case MarketRegime.CRISIS:
        return {
          ehlersFastLimit: 0.9,
          riskMultiplier: 0.3,
          confidenceThreshold: 0.9,
        };
      default:
        return {
          ehlersFastLimit: 0.7,
          riskMultiplier: 0.6,
          confidenceThreshold: 0.75,
        };
    }
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  /** Squared Euclidean distance between two vectors. */
  private squaredDistance(a: number[], b: number[]): number {
    let s = 0;
    for (let d = 0; d < a.length; d++) {
      const diff = a[d] - b[d];
      s += diff * diff;
    }
    return s;
  }

  /** Default result returned before the model has been trained. */
  private defaultResult(): RegimeResult {
    return {
      regime: MarketRegime.HIGH_VOL,
      label: REGIME_LABELS[MarketRegime.HIGH_VOL],
      probabilities: [0, 1, 0],
      positionScaling: 0.5,
      parameterAdjustments: this.getParameterAdjustments(MarketRegime.HIGH_VOL),
      isTrained: false,
      observationCount: this.observations.length,
    };
  }
}
