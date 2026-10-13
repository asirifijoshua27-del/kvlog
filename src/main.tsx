import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { OutputApp } from './output/OutputApp';
import './styles/global.css';
import './styles/presentation.css';
import './styles/planner.css';
import './styles/outputs.css';
import './styles/obs.css';
import './styles/bible.css';
import './styles/editor.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found in index.html');

// Projector and stage windows load the same page with #/output/projector or #/output/stage.
const match = /^#\/output\/(projector|stage)$/.exec(window.location.hash);

ReactDOM.createRoot(root).render(
  <React.StrictMode>{match ? <OutputApp role={match[1] as 'projector' | 'stage'} /> : <App />}</React.StrictMode>
);
