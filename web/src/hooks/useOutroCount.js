import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

// Counts non-deleted 'Outro' transactions for the given fatura. Backed by
// transactions/list rather than a dedicated endpoint so it can be invalidated
// independently of useTransactions (different query-key prefix).
export function useOutroCount(faturaId) {
  return useQuery({
    queryKey: ['outroCount', faturaId],
    queryFn: () => api('transactions/list', {
      fatura_id: faturaId,
      categoria: 'Outro',
      limit: 1000,
    }).then(d => (d.transactions || []).length),
    enabled: faturaId != null,
  });
}
