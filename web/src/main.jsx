import { render } from 'preact';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App.jsx';
import { queryClient } from './lib/queryClient.js';
import './styles/_imports.css';

render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
  document.getElementById('root'),
);
