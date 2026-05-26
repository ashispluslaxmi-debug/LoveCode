import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text } from 'ink';
import { SplitPane, RepoContextPane, CommandPane, StatusBar } from './components.js';
import { ChatBox } from './ChatBox.js';
import { useKeyboard, useTerminalSize, useFocus } from './hooks.js';
import { setTheme, getTheme, getThemeNames, type ThemeName } from './theme.js';

export interface TUIProps {
  initialMessages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  projectName?: string;
  branch?: string;
  fileCount?: number;
  language?: string;
  framework?: string;
  repoStatus?: string;
  messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  onSendMessage?: (message: string) => Promise<string | undefined>;
  onRunCommand?: (command: string) => Promise<string | undefined>;
  sessionId?: string;
  sessionName?: string;
  provider?: string;
  model?: string;
}

interface MessageEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export function App({
  initialMessages = [],
  projectName: _pn,
  branch: _br,
  fileCount: _fc,
  language: _lg,
  framework: _fw,
  repoStatus: _rs,
  onSendMessage,
  onRunCommand,
  sessionId: _sid,
  sessionName: _sname,
  provider: _provider,
  model: _model,
}: TUIProps) {
  const [messages, setMessages] = useState<MessageEntry[]>(
    initialMessages.map(m => ({ ...m, timestamp: Date.now() }))
  );
  const [commands, setCommands] = useState<Array<{ command: string; output: string; status: 'running' | 'success' | 'error' }>>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [focus, setFocus] = useFocus();
  const [currentTheme, setCurrentThemeState] = useState<ThemeName>('default');
  const [systemPrompt, setSystemPrompt] = useState('You are LoveCode AI, a terminal-native coding assistant.');
  const [splash, setSplash] = useState(true);
  useTerminalSize();

  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const setCurrentTheme = useCallback((name: ThemeName) => {
    setTheme(name);
    setCurrentThemeState(name);
  }, []);

  useKeyboard({
    onTab: () => {
      setFocus(focus === 'chat' ? 'command' : focus === 'command' ? 'repo' : focus === 'repo' ? 'chat' : 'chat');
    },
  });

  function addMessage(role: 'user' | 'assistant' | 'system', content: string) {
    const entry: MessageEntry = { role, content, timestamp: Date.now() };
    setMessages((prev) => [...prev, entry]);
    return entry;
  }

  async function handleConnect() {
    try {
      const { getAllProviders } = await import('../ai/registry.js');
      const { loadConfig } = await import('../config/config.js');
      const { loadEnv } = await import('../config/env.js');
      loadEnv();
      const providers = getAllProviders();
      const config = loadConfig();

      let info = '⚡ **Connect to an AI Provider**\n\n';
      info += '**Current config:**\n';
      info += `  Provider: ${config.provider || 'not set'}\n`;
      info += `  Model: ${config.model || 'not set'}\n\n`;
      info += '**Available providers:**\n';
      for (const p of providers) {
        const tag = p.local ? '(local)' : '(cloud)';
        info += `  ${p.name} ${tag}${config.provider === p.name ? ' ← active' : ''}\n`;
      }
      info += '\n**To configure:** use `lovecode init` in your terminal, then restart TUI';
      addMessage('assistant', info);
    } catch (err) {
      addMessage('system', `Error loading providers: ${(err as Error).message}`);
    }
  }

  async function handleModel() {
    try {
      const { loadConfig } = await import('../config/config.js');
      const config = loadConfig();
      const info = `**Current AI Configuration**\n\n  Provider: \`${config.provider || 'not set'}\`\n  Model: \`${config.model || 'not set'}\`\n  Theme: \`${currentTheme}\`\n  System prompt: ${systemPrompt}`;
      addMessage('assistant', info);
    } catch (err) {
      addMessage('system', `Error: ${(err as Error).message}`);
    }
  }

  function handleThemes() {
    const names = getThemeNames();
    let info = '**Available Themes**\n\n';
    for (const name of names) {
      info += `  ${currentTheme === name ? '●' : '○'} **${name}**${currentTheme === name ? ' (active)' : ''}\n`;
    }
    info += '\nUse `/theme <name>` to switch.';
    addMessage('assistant', info);
  }

  function handleSystem(prompt: string) {
    if (!prompt) {
      addMessage('system', `Current system prompt: "${systemPrompt}"\nUse \`/system <new prompt>\` to change it.`);
      return;
    }
    setSystemPrompt(prompt);
    addMessage('system', `System prompt updated to: "${prompt}"`);
  }

  async function handleExport() {
    try {
      const { writeChatLog } = await import('../memory/chatlog.js');
      const entries = messages.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));
      const path = writeChatLog(_sid || 'unknown', _sname || 'TUI Chat', entries);
      addMessage('system', `Chat exported to: ${path}`);
    } catch (err) {
      addMessage('system', `Export failed: ${(err as Error).message}`);
    }
  }

  async function handleSessions() {
    try {
      const { listSessions } = await import('../memory/session.js');
      const sessions = listSessions();
      if (sessions.length === 0) {
        addMessage('system', 'No saved sessions found. Messages are auto-saved during your session.');
        return;
      }
      let info = '**Saved Sessions**\n\n';
      for (const s of sessions.slice(0, 10)) {
        const date = new Date(s.updated).toLocaleDateString();
        info += `  ${_sid === s.id ? '●' : '○'} **${s.title}** (${s.entries.length} msgs, ${date})\n`;
      }
      if (sessions.length > 10) info += `  ... and ${sessions.length - 10} more\n`;
      info += '\nSessions are auto-saved. Use `lovecode memory list` to manage them.';
      addMessage('assistant', info);
    } catch (err) {
      addMessage('system', `Error: ${(err as Error).message}`);
    }
  }

  async function handleSend(text: string) {
    addMessage('user', text);

    if (text.startsWith('/')) {
      handleCommand(text);
      return;
    }

    if (onSendMessage) {
      setStreaming(true);
      setStreamedContent('');

      try {
        const response = await onSendMessage(text);
        if (response) {
          addMessage('assistant', response);
        }
      } catch (err) {
        addMessage('assistant', `Error: ${(err as Error).message}`);
      }
      setStreaming(false);
    }
  }

  function handleCommand(text: string) {
    const cmd = text.slice(1).toLowerCase().trim();

    if (cmd === 'help') {
      addMessage('system', [
        '**Commands:**',
        '  `/help` — Show this help',
        '  `/clear` — Clear chat',
        '  `/theme <name>` — Change theme',
        '  `/themes` — List themes',
        '  `/connect` — Show AI providers',
        '  `/model` — Show AI config',
        '  `/system <prompt>` — Set system prompt',
        '  `/export` — Save chat to file',
        '  `/sessions` — List sessions',
        '  `/!<cmd>` — Run shell command',
        '  `/exit` — Quit TUI',
        '',
        '**Keys:** Tab=focus, Esc=normal mode, i=insert, j/k=scroll, ↑↓=history',
      ].join('\n'));
    } else if (cmd === 'connect') {
      handleConnect();
    } else if (cmd === 'model') {
      handleModel();
    } else if (cmd === 'themes') {
      handleThemes();
    } else if (cmd === 'export') {
      handleExport();
    } else if (cmd === 'sessions') {
      handleSessions();
    } else if (cmd === 'clear') {
      setMessages([]);
    } else if (cmd.startsWith('theme ')) {
      const name = cmd.slice(6) as ThemeName;
      const names = getThemeNames();
      if (names.includes(name)) {
        setCurrentTheme(name);
        addMessage('system', `Theme changed to: ${name}`);
      } else {
        addMessage('system', `Unknown theme: ${name}. Available: ${names.join(', ')}`);
      }
    } else if (cmd.startsWith('system ')) {
      handleSystem(cmd.slice(7));
    } else if (cmd === 'system') {
      handleSystem('');
    } else if (cmd === 'vim') {
      addMessage('system', 'Vim mode: Esc=normal, i=insert, j/k=scroll');
    } else if (cmd === 'exit' || cmd === 'quit') {
      process.exit(0);
    } else if (cmd.startsWith('!')) {
      const shellCmd = cmd.slice(1);
      setCommands((prev) => [...prev, { command: shellCmd, output: '', status: 'running' }]);
      if (onRunCommand) {
        onRunCommand(shellCmd).then((output) => {
          setCommands((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.command === shellCmd) {
              last.status = 'success';
              last.output = output || '';
            }
            return updated;
          });
        }).catch((err) => {
          setCommands((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.command === shellCmd) {
              last.status = 'error';
              last.output = (err as Error).message;
            }
            return updated;
          });
        });
      }
    } else {
      addMessage('system', `Unknown command: ${cmd}. Try /help`);
    }
  }

  if (splash) {
    const theme = getTheme();
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" width="100%" height="100%">
        <Text bold color={theme.colors.primary}>LoveCode AI</Text>
        <Text color={theme.colors.textDim}>Terminal-native autonomous coding agent</Text>
        <Text color={theme.colors.muted}>v0.1.5</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%" height="100%">
      <Box flexDirection="column" flexGrow={1} paddingX={0}>
        <SplitPane direction="vertical" sizes={[15, 60, 25]}>
          <RepoContextPane
            projectName={_pn || 'LoveCode'}
            branch={_br || 'main'}
            fileCount={_fc || 42}
            language={_lg || 'TypeScript'}
            framework={_fw || 'Node.js'}
            status={_rs || 'clean'}
            focused={focus === 'repo'}
          />
          <ChatBox
            messages={messages}
            onSend={handleSend}
            streaming={streaming}
            streamedContent={streamedContent}
            focused={focus === 'chat'}
            placeholder="Type a message or /help..."
          />
          <CommandPane
            commands={commands}
            focused={focus === 'command'}
          />
        </SplitPane>
      </Box>
      <StatusBar
        mode="chat"
        theme={currentTheme}
        focus={focus}
        vimMode="INSERT"
        messages={messages.length}
        sessionName={_sname}
        provider={_provider}
        model={_model}
      />
    </Box>
  );
}


