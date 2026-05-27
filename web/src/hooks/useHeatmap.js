import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useHeatmap(days = 365) {
  return useQuery({
    queryKey: ['heatmap', { days }],
    queryFn: () => api('heatmap', { days }),
  });
}
