import { createRoot } from 'react-dom/client';
import App from './App';
import { MotionProvider } from './motion';
import './styles.css';
import './field-lab.css';
import './motion.css';
import './technical-noir.css';
import './coherence.css';
createRoot(document.getElementById('root')!).render(<MotionProvider><App /></MotionProvider>);
