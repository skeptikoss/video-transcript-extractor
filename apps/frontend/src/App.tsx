import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout/Layout';
import UploadPage from './pages/UploadPage';
import ProcessingPage from './pages/ProcessingPage';
import NotionPageSimple from './pages/NotionPageSimple';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/processing" element={<ProcessingPage />} />
            <Route path="/notion" element={<NotionPageSimple />} />
            <Route path="/test" element={<div style={{padding: '20px'}}><h1>Test Page</h1><p>This is a test page</p></div>} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
