import { createRoot } from 'react-dom/client';

function StandaloneStub() {
  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      NowPilot Standalone — wave 1 stub (real XProvider shell lands in plan 09)
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StandaloneStub />);
