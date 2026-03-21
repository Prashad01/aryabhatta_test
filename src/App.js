import AryabhattaSite from './pages/AryabhattaSite';
import AryabhattaAdmin from './pages/AryabhattaAdmin';

export default function App() {
  const isAdmin = window.location.pathname.startsWith('/admin');
  return isAdmin ? <AryabhattaAdmin /> : <AryabhattaSite />;
}