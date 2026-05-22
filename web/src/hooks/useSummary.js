import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useSummary(faturaId) {
  return useQuery({
    queryKey: ['summary', faturaId],
    queryFn: () => api('summary/fatura', { fatura_id: faturaId }),
    enabled: faturaId != null,
  });
}
