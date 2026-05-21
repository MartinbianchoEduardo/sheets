import { render } from 'preact';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App.jsx';
import './styles/_imports.css';

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: true,
    },
  },
});

render(
  <QueryClientProvider client={qc}>
    <App />
  </QueryClientProvider>,
  document.getElementById('root'),
);
