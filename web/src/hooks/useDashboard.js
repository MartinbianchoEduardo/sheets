import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useDashboard(faturaId) {
  return useQuery({
    queryKey: ['dashboard', faturaId],
    queryFn: () => api('dashboard', { fatura_id: faturaId }),
    enabled: faturaId != null,
  });
}
