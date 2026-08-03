import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { customCategoriesSignal } from '../lib/categories.js';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api('settings/get', {}).then(d => {
      customCategoriesSignal.value = d.settings.custom_categories || [];
      return d.settings;
    }),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch) => api('settings/update', patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['reserveForecast'] });
    },
  });
}
