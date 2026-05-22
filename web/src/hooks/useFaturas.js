import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useFaturas() {
  return useQuery({
    queryKey: ['faturas'],
    queryFn: () => api('faturas/list', {}).then(d => d.faturas || []),
  });
}

function invalidateFaturasFanout(qc) {
  qc.invalidateQueries({ queryKey: ['faturas'] });
  qc.invalidateQueries({ queryKey: ['transactions'] });
  qc.invalidateQueries({ queryKey: ['summary'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
}

export function useCreateFatura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api('faturas/create', body),
    onSuccess: () => invalidateFaturasFanout(qc),
  });
}

export function useUpdateFatura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api('faturas/update', body),
    onSuccess: () => invalidateFaturasFanout(qc),
  });
}

export function useDeleteFatura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api('faturas/delete', { id }),
    onSuccess: () => invalidateFaturasFanout(qc),
  });
}
