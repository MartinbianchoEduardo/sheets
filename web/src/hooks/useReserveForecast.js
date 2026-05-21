import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useReserveForecast(input = {}) {
  const { months, taxa_mensal_pct, contribuicao_cents } = input;
  return useQuery({
    queryKey: ['reserveForecast', {
      months: months ?? null,
      taxa: taxa_mensal_pct ?? null,
      contrib: contribuicao_cents ?? null,
    }],
    queryFn: () => api('reserve/forecast', {
      ...(months != null ? { months } : {}),
      ...(taxa_mensal_pct != null ? { taxa_mensal_pct } : {}),
      ...(contribuicao_cents != null ? { contribuicao_cents } : {}),
    }),
  });
}
