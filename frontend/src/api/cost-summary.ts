export interface CostSummary {
  user_id: string;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  estimated_cost_usd_micros: number;
}

export async function getCostSummary(userId: string): Promise<CostSummary> {
  const response = await fetch(`/api/users/${encodeURIComponent(userId)}/cost-summary`);
  if (!response.ok) {
    throw new Error(`Cost summary request failed with status ${response.status}`);
  }
  return (await response.json()) as CostSummary;
}
