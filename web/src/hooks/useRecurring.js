import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useRecurring() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: () => api('recurring/list', {}).then(d => d.recurring || []),
  });
}

export function useRecurringStatus(faturaId) {
  return useQuery({
    queryKey: ['recurringStatus', faturaId ?? null],
    queryFn: () => api('recurring/status', faturaId != null ? { fatura_id: faturaId } : {}),
    enabled: faturaId != null,
  });
}

function invalidateRecurring(qc) {
  qc.invalidateQueries({ queryKey: ['recurring'] });
  qc.invalidateQueries({ queryKey: ['recurringStatus'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
}

export function useCreateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api('recurring/create', body),
    onSuccess: () => invalidateRecurring(qc),
  });
}

export function useUpdateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api('recurring/update', body),
    onSuccess: () => invalidateRecurring(qc),
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api('recurring/delete', { id }),
    onSuccess: () => invalidateRecurring(qc),
  });
}
