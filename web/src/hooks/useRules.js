import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useRules() {
  return useQuery({
    queryKey: ['rules'],
    queryFn: () => api('rules/list', {}).then(d => d.rules || []),
  });
}

function invalidateRules(qc) {
  qc.invalidateQueries({ queryKey: ['rules'] });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api('rules/create', body),
    onSuccess: () => invalidateRules(qc),
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api('rules/update', body),
    onSuccess: () => invalidateRules(qc),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api('rules/delete', { id }),
    onSuccess: () => invalidateRules(qc),
  });
}

export function useReorderRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids) => api('rules/reorder', { ids }),
    onSuccess: () => invalidateRules(qc),
  });
}

export function useCategorize() {
  return useMutation({
    mutationFn: (descriptions) => api('categorize', { descriptions }).then(d => d.assignments || []),
  });
}
