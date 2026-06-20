// src/lib/rules-engine.ts
/**
 * Codeplain Rules — inspectable dispute-readiness rules engine
 * 
 * Implements the 5 rule types from spec §20:
 * - dispute_ready: Auto-approve for contest/recover
 * - recommend_contest: Suggest active contest strategy
 * - needs_human_review: Flag for manual inspection
 * - recommend_refund: Advise merchant to issue refund
 * - auto_generate_pack_if: Trigger pack creation conditionally
 */

export interface Rule {
  id: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
  ruleType: 'dispute_ready' | 'recommend_contest' | 'needs_human_review' |
             'recommend_refund' | 'auto_generate_pack_if';
  conditions: Condition[];
}

export interface Condition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'starts_with';
  value: any;
}

const CODEPLAIN_RULES: Rule[] = [
  // Dispute Ready Rules (auto-approve for contest)
  {
    id: 'order_has_full_evidence',
    description: 'Order has complete evidence package',
    severity: 'info',
    ruleType: 'dispute_ready',
    conditions: [
      { field: 'score', operator: '>=', value: 90 },
      { field: 'missing.length', operator: '=', value: 0 },
    ],
  },
  {
    id: 'payment_confirmed_with_receipt',
    description: 'Payment confirmed with receipt evidence',
    severity: 'info',
    ruleType: 'dispute_ready',
    conditions: [
      { field: 'evidence.payment.length', operator: '>=', value: 1 },
      { field: 'evidence.payment[0].relevance', operator: '>=', value: 0.8 },
    ],
  },

  // Recommend Contest Rules
  {
    id: 'strong_evidence_with_signal',
    description: 'Strong evidence exists and dispute signal detected',
    severity: 'warning',
    ruleType: 'recommend_contest',
    conditions: [
      { field: 'score', operator: '>=', value: 75 },
      { field: 'signals.length', operator: '>=', value: 1 },
    ],
  },
  {
    id: 'customer_history_winning',
    description: 'Customer has won disputes previously',
    severity: 'warning',
    ruleType: 'recommend_contest',
    conditions: [
      { field: 'merchant.customerHistory.won.length', operator: '>=', value: 1 },
      { field: 'score', operator: '>=', value: 60 },
    ],
  },

  // Needs Human Review Rules
  {
    id: 'score_between_50_and_74',
    description: 'Score indicates uncertain evidence strength',
    severity: 'warning',
    ruleType: 'needs_human_review',
    conditions: [
      { field: 'score', operator: '>=', value: 50 },
      { field: 'score', operator: '<', value: 75 },
    ],
  },
  {
    id: 'missing_critical_evidence',
    description: 'Critical evidence dimensions missing',
    severity: 'error',
    ruleType: 'needs_human_review',
    conditions: [
      { field: 'missing.length', operator: '>=', value: 1 },
      { field: 'score', operator: '<=', value: 85 },
    ],
  },

  // Recommend Refund Rules
  {
    id: 'weak_evidence_high_risk',
    description: 'Weak evidence and high-dispute-risk customer',
    severity: 'error',
    ruleType: 'recommend_refund',
    conditions: [
      { field: 'score', operator: '<=', value: 50 },
      { field: 'merchant.customerRiskScore', operator: '>=', value: 80 },
    ],
  },

  // Auto Generate Pack Rules
  {
    id: 'auto_generate_if_score_gt_90',
    description: 'Auto-generate pack if score exceeds threshold',
    severity: 'info',
    ruleType: 'auto_generate_pack_if',
    conditions: [
      { field: 'score', operator: '>=', value: 95 },
    ],
  },
];

/**
 * Applies Codeplain Rules to an order vault
 * @param vault - Order evidence vault to evaluate
 * @returns Array of applicable rules with metadata
 */
export function applyCodeplainRules(vault: OrderEvidenceVault): RuleResult[] {
  return CODEPLAIN_RULES.map(rule => ({
    rule,
    matches: doesRuleApply(rule, vault),
    timestamp: new Date(),
    merchantId: vault.merchantId,
  })).filter(r => r.matches);
}

/**
 * Checks if a single rule applies to a vault
 * @param rule - Rule definition
 * @param vault - Order evidence vault
 * @returns True if rule matches
 */
function doesRuleApply(rule: Rule, vault: OrderEvidenceVault): boolean {
  return rule.conditions.every(condition => {
    const fieldParts = condition.field.split('.');
    let value = vault;
    
    for (const part of fieldParts) {
      value = value?.[part];
      
      if (value === undefined) {
        return false; // Field doesn't exist - condition fails
      }
    }
    
    switch (condition.operator) {
      case '=':
        return value === condition.value;
      case '!=':
        return value !== condition.value;
      case '>':
        return value > condition.value;
      case '<':
        return value < condition.value;
      case '>=':
        return value >= condition.value;
      case '<=':
        return value <= condition.value;
      case 'contains':
        return Array.isArray(value) && value.includes(condition.value);
      case 'starts_with':
        return typeof value === 'string' && value.startsWith(condition.value);
      default:
        return false;
    }
  });
}