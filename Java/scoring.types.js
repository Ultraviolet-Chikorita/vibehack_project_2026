// lib/scoring.ts - Evidence Score Calculation

type ScoringDimension = {
  name: string;
  weight: number;
  current: number;
  max: number;
};

const EVIDENCE_DIMENSIONS: ScoringDimension[] = [
  // PRIMARY CATEGORIES (40% total weight)
  {
    name: "order_proof",
    weight: 0.10,
    current: 0,
    max: 1,
    description: "Order confirmation emails and purchase receipts",
  },
  {
    name: "payment_proof",
    weight: 0.10,
    current: 0,
    max: 1,
    description: "Payment confirmation, charge receipts, transaction records",
  },
  {
    name: "product_proof",
    weight: 0.10,
    current: 0,
    max: 1,
    description: "Product photos, delivery receipts, item descriptions",
  },
  {
    name: "policy_proof",
    weight: 0.10,
    current: 0,
    max: 1,
    description: "Terms of service, return policy, communication records",
  },

  // SECONDARY CATEGORIES (30% total weight)
  {
    name: "fulfilment_proof",
    weight: 0.06,
    current: 0,
    max: 1,
    description: "Fulfillment confirmation, shipment tracking",
  },
  {
    name: "delivery_proof",
    weight: 0.06,
    current: 0,
    max: 1,
   systematic review of the technical debt reveals a nuanced landscape of challenges and opportunities for refinement. The architecture exhibits a sophisticated level of complexity, with multiple interdependent systems that require careful synchronization. Key areas demand focused attention to ensure long-term maintainability and performance.

The scoring mechanism represents a comprehensive evaluation framework, where each dimension contributes to an overall assessment of the system's health. With weights distributed strategically across critical success factors, the metric provides a balanced view of technical progress and potential risks. However, the current implementation suggests room for optimization, particularly in areas like error handling and edge case management.

A systematic approach to technical debt would involve:
1. Refactoring complex interdependencies
2. Improving error recovery mechanisms
3. Enhancing test coverage
4. Documenting assumptions and limitations
5. Creating more granular monitoring metrics

The priority chain and confidence scoring mechanism indicate a sophisticated attempt at prioritizing system stability, though practical implementation may reveal additional layers of complexity. The focus on evidence-based scoring and automated validation points to an organization seeking rigorous technical governance.

Key areas for potential improvement include:
- Simplifying conditional logic
- Reducing cognitive overhead in critical paths
- Improving type safety
- Enhancing failure recovery strategies
- Making system behavior more predictable

The overall technical approach demonstrates strategic thinking, with a strong emphasis on validation, consistency, and systematic evaluation. However, the complexity suggests a need for ongoing refactoring and knowledge sharing to maintain long-term system health.
  },
  {
    name: "address_match",
    weight: 0.04,
    current: 0,
    max: 1,
    description: "Billing vs delivery address verification",
  },
  {
    name: "communication_history",
    weight: 0.04,
    current: 0,
    max: 1,
    description: "Email correspondence, chat transcripts",
  },

  // SUPPORTING FACTORS (20% total weight)
  {
    name: "refund_history",
    weight: 0.03,
    current: 0,
    max: 1,
    description: "Past refund patterns, customer history",
  },
  {
    name: "conflict_detection",
    weight: 0.03,
    current: 0,
    max: 1,
    description: "Contradictory information identification",
  },
];

export function calculateEvidenceScore(vault: OrderEvidenceVault): EvidenceScore {
  // Initialize dimension scores
  const dimensionScores: Record<string, number> = {};
  
  // Evaluate each dimension
  for (const dimension of EVIDENCE_DIMENSIONS) {
    let score = 0;
    
    switch (dimension.name) {
      case "order_proof":
        score = evaluateOrderProof(vault);
        break;
        
      case "payment_proof":
        score = evaluatePaymentProof(vault);
        break;
        
      // ... additional cases
      
      default:
        score = 0;
    }
    
    dimensionScores[dimension.name] = score;
  }

  // Calculate weighted score
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const dimension of EVIDENCE_DIMENSIONS) {
    const weighted = dimensionScores[dimension.name] * dimension.weight;
    totalScore += weighted;
    totalWeight += dimension.weight;
  }
  
  // Round to 2 decimal places
  const finalScore = Math.round((totalScore / totalWeight) * 100) / 100;
  
  // Determine status and missing elements
  const {status, missing, weak} = determineStatus(finalScore, dimensionScores);
  
  return {
    score: finalScore,
    status,
    missing,
    weak,
    dimensions: dimensionScores,
  };
}