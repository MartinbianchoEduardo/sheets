import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useCategoryTransactions(faturaId, categoria, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['transactions', { faturaId: faturaId ?? null, categoria: categoria ?? null, limit: 500, offset: null }],
    queryFn: () => api('transactions/list', {
      fatura_id: faturaId,
      categoria,
      limit: 500,
    }).then(d => d.transactions || []),
    enabled: enabled && faturaId != null && !!categoria,
  });
}
