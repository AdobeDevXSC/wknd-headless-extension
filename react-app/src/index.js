/*
Copyright 2022 Adobe
All Rights Reserved.

NOTICE: Adobe permits you to use, modify, and distribute this file in
accordance with the terms of the Adobe license agreement accompanying
it.
*/
import { createRoot } from 'react-dom/client';
import React from 'react';
import App from './App';
import { getAemConfig } from './api/aemHeadlessClient';

try {
  const connection = document.querySelector('meta[name="urn:adobe:aue:system:aemconnection"]');
  connection.setAttribute('content', `aem:${getAemConfig().aemHost}`);
  const editor = document.createElement('script');
  editor.src = 'https://universal-editor-service.adobe.io/cors.js';
  editor.async = true;
  document.head.appendChild(editor);
} catch (error) {
  console.error('Could not initialize the Universal Editor connection:', error);
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);