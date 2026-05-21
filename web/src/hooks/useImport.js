import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useImportPreview() {
  return useMutation({
    mutationFn: (body) => api('import/preview', body),
  });
}

export function useImportConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows) => api('import/confirm', { rows }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['outroCount'] });
    },
  });
}
