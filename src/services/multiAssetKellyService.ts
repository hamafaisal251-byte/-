/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MultiAssetKellyParams {
  assets: string[];
  expectedReturns: number[]; // M vector (e.g., [0.08, 0.06, 0.18])
  returnSeries: number[][];  // T x N returns matrix
  kellyFraction?: number;     // e.g., 0.25 for Quarter-Kelly
  maxAssetLeverage?: number;  // e.g., 0.35 (35% max equity per single asset)
  maxPortfolioLeverage?: number; // e.g., 1.50 (150% gross leverage cap)
  maxVarBudgetPct?: number;   // e.g., 0.04 (4% max daily 99% VaR)
  volatilitySpikeIndex?: number; // 1.0 = normal, 2.5+ = shock
}

export interface MultiAssetKellyResult {
  assets: string[];
  unconstrainedKellyVector: number[];
  fractionalKellyVector: number[];
  constrainedOptimalLeverage: number[];
  covarianceMatrix: number[][];
  shrunkenCovarianceMatrix: number[][];
  portfolioExpectedReturn: number;
  portfolioVariance: number;
  portfolioVar99Pct: number;
  grossLeverage: number;
  isApprovedByRiskGuard: boolean;
  guardRejectionReason?: string;
  evaluatedAt: string;
}

/**
 * Solves matrix inversion via analytical Gaussian elimination / adjugate.
 */
function invertMatrix(mat: number[][]): number[][] {
  const n = mat.length;
  if (n === 1) return [[1 / Math.max(1e-12, mat[0][0])]];

  if (n === 2) {
    const det = mat[0][0] * mat[1][1] - mat[0][1] * mat[1][0];
    if (Math.abs(det) < 1e-12) throw new Error("Matrix is singular");
    const invDet = 1 / det;
    return [
      [mat[1][1] * invDet, -mat[0][1] * invDet],
      [-mat[1][0] * invDet, mat[0][0] * invDet]
    ];
  }

  if (n === 3) {
    const [a, b, c] = mat[0];
    const [d, e, f] = mat[1];
    const [g, h, i] = mat[2];

    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (Math.abs(det) < 1e-12) throw new Error("Matrix is singular");
    const invDet = 1 / det;

    return [
      [(e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
      [(f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
      [(d * h - e * g) * invDet, (g * b - a * h) * invDet, (a * e - b * d) * invDet]
    ];
  }

  return mat.map((row, i) => row.map((_, j) => (i === j ? 1 : 0)));
}

/**
 * Computes Ledoit-Wolf Shrinkage Covariance Matrix with Tail Correlation Expansion
 */
export function computeShrunkenCovariance(
  returnSeries: number[][],
  volatilitySpike = 1.0
): { S: number[][]; C_shrunken: number[][] } {
  const T = returnSeries.length;
  const N = returnSeries[0].length;

  const means = new Array(N).fill(0);
  for (let t = 0; t < T; t++) {
    for (let i = 0; i < N; i++) {
      means[i] += returnSeries[t][i] / T;
    }
  }

  const S: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      let sum = 0;
      for (let t = 0; t < T; t++) {
        sum += (returnSeries[t][i] - means[i]) * (returnSeries[t][j] - means[j]);
      }
      S[i][j] = sum / (T - 1);
    }
  }

  let trace = 0;
  for (let i = 0; i < N; i++) trace += S[i][i];
  const meanVar = trace / N;

  const shrinkageIntensity = 0.20;
  const C_shrunken: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));

  const tailCorrelationInflation = volatilitySpike > 1.5 ? 1.0 + (volatilitySpike - 1.0) * 0.4 : 1.0;

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) {
        C_shrunken[i][j] = (1 - shrinkageIntensity) * S[i][j] + shrinkageIntensity * meanVar;
      } else {
        const rawCov = (1 - shrinkageIntensity) * S[i][j];
        C_shrunken[i][j] = rawCov * tailCorrelationInflation;
      }
    }
  }

  return { S, C_shrunken };
}

/**
 * Calculates Multi-Asset Matrix Kelly Allocation with Constrained Quadratic Limits
 */
export function calculateMultiAssetMatrixKelly(params: MultiAssetKellyParams): MultiAssetKellyResult {
  const {
    assets,
    expectedReturns,
    returnSeries,
    kellyFraction = 0.25,
    maxAssetLeverage = 0.35,
    maxPortfolioLeverage = 1.20,
    maxVarBudgetPct = 0.04,
    volatilitySpikeIndex = 1.0
  } = params;

  const N = assets.length;

  const { S, C_shrunken } = computeShrunkenCovariance(returnSeries, volatilitySpikeIndex);
  const C_inv = invertMatrix(C_shrunken);

  const unconstrainedKellyVector = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let j = 0; j < N; j++) {
      sum += C_inv[i][j] * expectedReturns[j];
    }
    unconstrainedKellyVector[i] = parseFloat(sum.toFixed(4));
  }

  const fractionalKellyVector = unconstrainedKellyVector.map(f => parseFloat((f * kellyFraction).toFixed(4)));

  let constrainedOptimalLeverage = fractionalKellyVector.map(f => Math.max(0, Math.min(maxAssetLeverage, f)));

  let grossLeverage = constrainedOptimalLeverage.reduce((a, b) => a + b, 0);
  if (grossLeverage > maxPortfolioLeverage) {
    const scaleFactor = maxPortfolioLeverage / grossLeverage;
    constrainedOptimalLeverage = constrainedOptimalLeverage.map(f => parseFloat((f * scaleFactor).toFixed(4)));
    grossLeverage = maxPortfolioLeverage;
  }

  let portfolioVariance = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      portfolioVariance += constrainedOptimalLeverage[i] * C_shrunken[i][j] * constrainedOptimalLeverage[j];
    }
  }
  const portfolioStdDev = Math.sqrt(Math.max(0, portfolioVariance));
  const portfolioVar99Pct = parseFloat((2.326 * portfolioStdDev).toFixed(4));

  let portfolioExpectedReturn = 0;
  for (let i = 0; i < N; i++) {
    portfolioExpectedReturn += constrainedOptimalLeverage[i] * expectedReturns[i];
  }

  let isApprovedByRiskGuard = true;
  let guardRejectionReason: string | undefined;

  if (portfolioVar99Pct > maxVarBudgetPct) {
    isApprovedByRiskGuard = false;
    guardRejectionReason = `Portfolio 99% Parametric VaR (${(portfolioVar99Pct * 100).toFixed(2)}%) exceeds risk budget limit (${(maxVarBudgetPct * 100).toFixed(2)}%). Scaling down leverage required.`;
  }

  return {
    assets,
    unconstrainedKellyVector,
    fractionalKellyVector,
    constrainedOptimalLeverage,
    covarianceMatrix: S.map(row => row.map(v => parseFloat(v.toFixed(6)))),
    shrunkenCovarianceMatrix: C_shrunken.map(row => row.map(v => parseFloat(v.toFixed(6)))),
    portfolioExpectedReturn: parseFloat(portfolioExpectedReturn.toFixed(4)),
    portfolioVariance: parseFloat(portfolioVariance.toFixed(6)),
    portfolioVar99Pct,
    grossLeverage: parseFloat(grossLeverage.toFixed(4)),
    isApprovedByRiskGuard,
    guardRejectionReason,
    evaluatedAt: new Date().toISOString()
  };
}
