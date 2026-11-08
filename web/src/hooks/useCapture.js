import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useCaptureStatus() {
  return useQuery({ queryKey: ['capture'], queryFn: () => api('capture/status', {}) });
}

export function useCaptureKey(action) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`capture/${action}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capture'] }),
    gcTime: 0,
  });
}
