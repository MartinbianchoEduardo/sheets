import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useTransactions(filter = {}, { enabled = true } = {}) {
  const { faturaId, faturaIds, categoria, categorias, search, data, limit, offset } = filter;
  const catsKey = Array.isArray(categorias) && categorias.length ? [...categorias].sort().join(',') : null;
  const idsKey = Array.isArray(faturaIds) && faturaIds.length ? [...faturaIds].sort((a, b) => a - b).join(',') : null;
  const searchKey = typeof search === 'string' && search.trim() ? search.trim() : null;
  return useQuery({
    enabled,
    queryKey: ['transactions', {
      faturaId: faturaId ?? null,
      faturaIds: idsKey,
      categoria: categoria ?? null,
      categorias: catsKey,
      search: searchKey,
      data: data ?? null,
      limit: limit ?? null,
      offset: offset ?? null,
    }],
    queryFn: () => api('transactions/list', {
      ...(faturaId != null ? { fatura_id: faturaId } : {}),
      ...(idsKey ? { fatura_ids: faturaIds } : {}),
      ...(categoria ? { categoria } : {}),
      ...(catsKey ? { categorias } : {}),
      ...(searchKey ? { search: searchKey } : {}),
      ...(data ? { data } : {}),
      ...(limit != null ? { limit } : {}),
      ...(offset != null ? { offset } : {}),
    }).then(d => d.transactions || []),
  });
}

// One query per fatura so "Ver mais" only fetches the newly revealed fatura.
// Key shape mirrors useTransactions' single-fatura key for cache sharing.
export function useTransactionsPerFatura(faturaIds) {
  return useQueries({
    queries: faturaIds.map(id => ({
      queryKey: ['transactions', {
        faturaId: id, faturaIds: null, categoria: null, categorias: null,
        search: null, data: null, limit: 500, offset: null,
      }],
      queryFn: () => api('transactions/list', { fatura_id: id, limit: 500 }).then(d => d.transactions || []),
    })),
    combine: (results) => ({
      rows: results.flatMap(r => r.data || []),
      isLoading: results.some(r => r.isLoading),
      isError: results.some(r => r.isError),
      error: results.find(r => r.error)?.error,
    }),
  });
}

function invalidateTxFanout(qc) {
  qc.invalidateQueries({ queryKey: ['transactions'] });
  qc.invalidateQueries({ queryKey: ['summary'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
  qc.invalidateQueries({ queryKey: ['outroCount'] });
  qc.invalidateQueries({ queryKey: ['recurringStatus'] });
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
