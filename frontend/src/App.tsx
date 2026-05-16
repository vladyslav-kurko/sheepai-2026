import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ModulesPreviewPage from './pages/ModulesPreviewPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/preview" element={<ModulesPreviewPage />} />
      </Routes>
    </BrowserRouter>
  );
}
