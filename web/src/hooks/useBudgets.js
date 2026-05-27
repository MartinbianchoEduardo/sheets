import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: () => api('budgets/list', {}).then(d => d.budgets || {}),
  });
}

export function useUpsertBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoria, valor_cents }) =>
      api('budgets/upsert', { categoria, valor_cents }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}
