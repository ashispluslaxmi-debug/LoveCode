import React from 'react';
import { render } from 'ink';
import { App, type TUIProps } from './App.js';

export function startTUI(props: TUIProps): void {
  const { waitUntilExit } = render(React.createElement(App, props));
  waitUntilExit().then(() => process.exit(0));
}

export * from './App.js';
export * from './components.js';
export * from './hooks.js';
export * from './theme.js';
