import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useTransactions(filter = {}) {
  const { faturaId, categoria, categorias, search, limit, offset } = filter;
  const catsKey = Array.isArray(categorias) && categorias.length ? [...categorias].sort().join(',') : null;
  const searchKey = typeof search === 'string' && search.trim() ? search.trim() : null;
  return useQuery({
    queryKey: ['transactions', {
      faturaId: faturaId ?? null,
      categoria: categoria ?? null,
      categorias: catsKey,
      search: searchKey,
      limit: limit ?? null,
      offset: offset ?? null,
    }],
    queryFn: () => api('transactions/list', {
      ...(faturaId != null ? { fatura_id: faturaId } : {}),
      ...(categoria ? { categoria } : {}),
      ...(catsKey ? { categorias } : {}),
      ...(searchKey ? { search: searchKey } : {}),
      ...(limit != null ? { limit } : {}),
      ...(offset != null ? { offset } : {}),
    }).then(d => d.transactions || []),
  });
}

function invalidateTxFanout(qc) {
  qc.invalidateQueries({ queryKey: ['transactions'] });
  qc.invalidateQueries({ queryKey: ['summary'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
  qc.invalidateQueries({ queryKey: ['outroCount'] });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api('transactions/create', body),
    onSuccess: () => invalidateTxFanout(qc),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api('transactions/update', body),
    onSuccess: () => invalidateTxFanout(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api('transactions/delete', { id }),
    onSuccess: () => invalidateTxFanout(qc),
  });
}

export function useRestoreTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api('transactions/restore', { id }),
    onSuccess: () => invalidateTxFanout(qc),
  });
}
