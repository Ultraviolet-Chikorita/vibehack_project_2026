// src/lib/scoring.ts
/**
 * Evidence scoring module - calculates dispute-readiness score
 * 
 * Implements the 10 weighted dimensions from spec §13:
 * 1. Order proof (25%)
 * 2. Payment proof (20%)
 * 3. Product proof (15%)
 * 4. Policy proof (10%)
 * 5. Fulfilment proof (10%)
 * 6. Delivery proof (10%)
 * 7. Address match (3%)
 * 8. Communication history (3%)
 * 9. Refund history (2%)
 * 10. Conflict detection (2%)
 */

export interface ScoreResult {
  score: number;
  status: 'dispute_ready' | 'mostly_ready' | 'missing_delivery_proof' |
           'missing_policy_snapshot' | 'missing_product_snapshot' |
           'needs_review' | 'weak_evidence';
  missing: string[];
  weak: string[];
  strongest: string[];
}

const scoringWeights: ScoringDimension[] = [
  { id: 'order', weight: 0.25, label: 'Order Proof' },
  { id: 'payment', weight: 0.20, label: 'Payment Proof' },
  { id: 'product', weight: 0.15, label: 'Product Proof' },
  { id: 'policy', weight: 0.10, label: 'Policy Proof' },
  { id: 'fulfilment', weight: 0.10, label: 'Fulfilment Proof' },
  { id: 'delivery', weight: 0.10, label: 'Delivery Proof' },
  { id: 'address', weight: 0.03, label: 'Address Match' },
  { id: 'communication', weight: 0.03, label: 'Communication History' },
  { id: 'refund', weight: 0.02, label: 'Refund History' },
  { id: 'conflict', weight: 0.02, label: 'Conflict Detection' },
];

interface ScoringDimension {
  id: string;
  weight: number;
  label: string;
}

// Evidence presence thresholds
const EVIDENCE_THRESHOLDS = {
  critical: ['order', 'payment', 'delivery'] as const,
  important: ['product', 'policy', 'fulfilment'] as const,
};

/**
 * Calculates the overall dispute-readiness score for an order vault
 * @param vault - Order evidence vault to score
 * @returns Score result with detailed breakdown
 */
export function calculateScore(vault: OrderEvidenceVault): ScoreResult {
  // Initialize scoring structure
  const scoresByDimension: Record<string, number> = {};
  const missing: string[] = [];
  const weak: string[] = [];
  
  let totalScore = 0;
  
  // Evaluate each dimension
  for (const dimension of scoringWeights) {
    const evidenceItems = vault.evidence.filter(e => e.category === dimension.id);
    
    if (evidenceItems.length === 0) {
      missing.push(dimension.label);
      scoresByDimension[dimension.id] = 0;
      
      // Critical missing dimensions affect status heavily
      if (EVIDENCE_THRESHOLDS.critical.includes(dimension.id as never)) {
        weak.push(dimension.label);
      }
    } else {
      const dimensionScore = calculateDimensionScore(evidenceItems, dimension.id);
      scoresByDimension[dimension.id] = dimensionScore;
      
      // Dimension score below 50% indicates weakness
      if (dimensionScore < 0.5) {
        weak.push(dimension.label);
      }
    }
    
    totalScore += scoresByDimension[dimension.id] * dimension.weight;
  }

  // Determine status based on score and missing evidence
  let status: ScoreResult['status'] = 'dispute_ready';
  
  if (missing.length > 0) {
    if (missing.includes('Delivery Proof')) {
      status = 'missing_delivery_proof';
    } else if (missing.includes('Policy Proof')) {
      status = 'missing_policy_snapshot';
    } else if (missing.includes('Product Proof')) {
      status = 'missing_product_snapshot';
    } else {
      status = 'needs_review';
    }
  }

  return {
    score: Math.round(totalScore * 100) / 100,
    status,
    missing: missing.map(m => m.replace('Proof', '').trim()),
    weak: weak.map(w => w.replace('Proof', '').trim()),
    strongest: Object.entries(scoresByDimension)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => scoringWeights.find(d => d.id === key)?.label || key),
  };
}

/**
 * Calculates score for a specific evidence dimension
 * @param items - Evidence items for this dimension
 * @param dimension - Dimension being scored
 * @returns Score between 0 and 1
 */
function calculateDimensionScore(items: EvidenceItem[], dimension: string): number {
  // Weighted scoring based on item quality
  const qualityWeights = {
    'order': { id: 0.4, description: 0.3, receipt: 0.2, confirmation: 0.1 },
    'payment': { receipt: 0.4, confirmation: 0.3, email: 0.2, invoice: 0.1 },
    'product': { photo: 0.4, description: 0.3, specs: 0.2, packaging: 0.1 },
    // Add weights for other dimensions...
  };
  
  if (!qualityWeights[dimension]) {
    return 0;
  }
  
  let weightedScore = 0;
  let totalWeight = 0;
  
  for (const item of items) {
    const type = Object.keys(item.content)[0];
    const weight = qualityWeights[dimension][type as keyof typeof qualityWeights['order']] || 0.1;
    
    weightedScore += item.relevance * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? weightedScore / totalWeight : 0;
}