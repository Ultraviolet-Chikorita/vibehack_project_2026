// src/lib/vaultMatching.ts
/**
 * Evidence vault matching module - links messages to existing orders
 * 
 * Implements the 7-step priority chain (§11.2):
 * 1. Exact order ID match
 * 2. Order ID partial match
 * 3. Price/amount match
 * 4. Tracking number match
 * 5. Customer name match
 * 6. Email address match
 * 7. Content similarity (fallback)
 */

export type VaultMatch = {
  vaultId: string;
  confidence: number;
  evidenceType: 'exact' | 'partial' | 'tracking' | 'content';
};

const matchingPriority: MatchingStep[] = [
  {
    key: 'orderId',
    description: 'Exact order ID match',
    threshold: 1.0,
    weight: 0.8,
  },
  {
    key: 'orderIdPartial',
    description: 'Partial order ID match',
    threshold: 0.75,
    weight: 0.6,
  },
  {
    key: 'price',
    description: 'Order amount match',
    threshold: 1.0,
    weight: 0.5,
  },
  {
    key: 'trackingNumber',
    description: 'Tracking number match',
    threshold: 1.0,
    weight: 0.7,
  },
  {
    key: 'customerName',
    description: 'Customer name match',
    threshold: 0.8,
    weight: 0.4,
  },
  {
    key: 'emailAddress',
    description: 'Email address match',
    threshold: 1.0,
    weight: 0.6,
  },
  {
    key: 'contentSimilarity',
    description: 'Text content similarity',
    threshold: 0.5,
    weight: 0.3,
  },
];

interface MatchingStep {
  key: string;
  description: string;
  threshold: number;
  weight: number;
}

/**
 * Matches a message to an existing order vault
 * @param message - Message to process
 * @param vaults - Existing vault candidates
 * @returns Best matching vault or null
 */
export async function matchToVault(
  message: SourceMessage,
  vaults: OrderEvidenceVault[]
): Promise<VaultMatch | null> {
  // Step 1: Extract all possible identifiers from message
  const extracted = await extractCommerceEvents(message);
  
  if (!extracted || !extracted.order) {
    return null; // No order information found - can't match
  }

  // Step 2: Score each vault against this message
  const scores: {vaultId: string, confidence: number}[] = [];
  
  for (const vault of vaults) {
    let totalConfidence = 0;
    
    // Apply matching steps in priority order
    for (const step of matchingPriority) {
      let matchScore = 0;
      
      switch (step.key) {
        case 'orderId':
          if (extracted.order.id === vault.orderId) {
            matchScore = step.threshold;
          }
          break;
          
        case 'orderIdPartial':
          if (vault.orderId && extracted.order.id.includes(vault.orderId)) {
            matchScore = step.threshold * 0.5 + 0.25; // Partial credit
          }
          break;
          
        case 'price':
          if (extracted.order.total && vault.order?.total) {
            const priceMatch = comparePrices(extracted.order.total, vault.order.total);
            matchScore = priceMatch * step.threshold;
          }
          break;
          
        case 'trackingNumber':
          if (extracted.shipment?.trackingNumber === vault.shipment?.trackingNumber) {
            matchScore = step.threshold;
          }
          break;
          
        case 'customerName':
          if (extracted.customer?.name && vault.customer?.name) {
            const nameMatch = similarity(extracted.customer.name, vault.customer.name);
            matchScore = nameMatch * step.threshold;
          }
          break;
          
        case 'emailAddress':
          if (message.email && vault.customer?.email === message.email) {
            matchScore = step.threshold;
          }
          break;
          
        case 'contentSimilarity':
          // Text similarity using cosine similarity
          const contentMatch = await textSimilarity(
            message.text,
            vault.evidence?.map(e => e.content).join(' ')
          );
          matchScore = contentMatch * step.threshold;
          break;
      }
      
      totalConfidence += matchScore * step.weight;
    }

    scores.push({
      vaultId: vault.id,
      confidence: totalConfidence,
    });
  }

  // Step 3: Return best match if confidence exceeds threshold
  scores.sort((a, b) => b.confidence - a.confidence);
  
  if (scores[0]?.confidence > 0.5) {
    return {
      vaultId: scores[0].vaultId,
      confidence: scores[0].confidence,
      evidenceType: determineEvidenceType(scores[0], extracted),
    };
  }
  
  return null;
}

function comparePrices(priceA: string, priceB: string): number {
  // Extract numeric values from prices
  const parsePrice = (price: string): number => {
    return parseFloat(price.replace(/[^0-9.]/g, ''));
  };
  
  const valueA = parsePrice(priceA);
  const valueB = parsePrice(priceB);
  
  if (valueA === valueB) {
    return 1.0;
  } else if (Math.abs(valueA - valueB) < 5) {
    return 0.75; // Acceptable variance
  } else {
    return 0;
  }
}

function similarity(a: string, b: string): number {
  // Simple cosine similarity implementation for short strings
  const tokensA = a.toLowerCase().split(/\s+/);
  const tokensB = b.toLowerCase().split(/\s+/);
  
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  
  const intersection = [...setA].filter(token => setB.has(token)).length;
  const union = [...new Set([...setA, ...setB])].length;
  
  return union > 0 ? intersection / union : 0;
}

async function textSimilarity(text1: string, text2: string): Promise<number> {
  // Use embeddings for better similarity (this is a simplified version)
  // In production, use a service like OpenAI or sentence-transformers
  const shortText1 = text1.slice(0, 500);
  const shortText2 = text2.slice(0, 500);
  
  const combined = `${shortText1} ${shortText2}`;
  const hash1 = crypto.createHash('sha256').update(shortText1).digest('hex');
  const hash2 = crypto.createHash('sha256').update(shortText2).digest('hex');
  
  // Fallback similarity based on hash comparison (not ideal, just for demo)
  return hash1 === hash2 ? 1.0 : 0.3;
}

function determineEvidenceType(match: {vaultId: string, confidence: number}, extracted: any): 'exact' | 'partial' | 'tracking' | 'content' {
  if (match.confidence > 0.85) {
    return 'exact';
  } else if (match.confidence > 0.6) {
    return 'partial';
  } else if (extracted.shipment?.trackingNumber && match.confidence > 0.4) {
    return 'tracking';
  } else {
    return 'content';
  }
}