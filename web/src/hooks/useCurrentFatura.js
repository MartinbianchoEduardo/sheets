import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

// Returns { fatura, override_set, today, outro_count }.
export function useCurrentFatura() {
  return useQuery({
    queryKey: ['faturas', 'current'],
    queryFn: () => api('faturas/current', {}),
  });
}
