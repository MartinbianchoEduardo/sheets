import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useTrends(months = 12) {
  return useQuery({
    queryKey: ['trends', { months }],
    queryFn: () => api('trends', { months }),
  });
}
