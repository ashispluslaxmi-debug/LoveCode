import React, { useState, useCallback } from 'react';
import { Box } from 'ink';
import { SplitPane, RepoContextPane, ChatPane, CommandPane, InputPane, StatusBar } from './components.js';
import { useKeyboard, useTerminalSize, useFocus } from './hooks.js';
import { setTheme, getThemeNames, type ThemeName } from './theme.js';

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
}: TUIProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [commands, setCommands] = useState<Array<{ command: string; output: string; status: 'running' | 'success' | 'error' }>>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [streamedIndex, setStreamedIndex] = useState(0);
  const [vimMode, setVimMode] = useState<'insert' | 'normal'>('insert');
  const [focus, setFocus] = useFocus();
  const [currentTheme, setCurrentThemeState] = useState<ThemeName>('default');
  useTerminalSize();

  const setCurrentTheme = useCallback((name: ThemeName) => {
    setTheme(name);
    setCurrentThemeState(name);
  }, []);

  useKeyboard({
    onKey: (key) => {
      if (focus === 'input') {
        if (vimMode === 'normal') {
          if (key === 'i') setVimMode('insert');
          else if (key === 'h') { setFocus('chat'); }
          else if (key === 'l') { setFocus('command'); }
        }
      }
    },
    onEnter: () => {
      if (focus === 'input' && input.trim() && vimMode === 'insert') {
        handleSend(input);
      }
    },
    onEscape: () => {
      if (vimMode === 'insert') setVimMode('normal');
    },
    onTab: () => {
      setFocus(focus === 'input' ? 'chat' : focus === 'chat' ? 'command' : focus === 'command' ? 'repo' : 'input');
    },
  });

  async function handleSend(text: string) {
    const userMsg: { role: 'user'; content: string } = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    if (text.startsWith('/')) {
      handleCommand(text);
      return;
    }

    if (onSendMessage) {
      setStreaming(true);
      const idx = messages.length + 1;
      setStreamedIndex(idx);
      setStreamedContent('');

      try {
        const response = await onSendMessage(text);
        if (response) {
          setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
        }
      } catch (err) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${(err as Error).message}` }]);
      }
      setStreaming(false);
    }
  }

  function handleCommand(text: string) {
    const cmd = text.slice(1).toLowerCase();

    if (cmd === 'help') {
      setMessages((prev) => [...prev, { role: 'system', content: 'Commands: /help, /clear, /theme <name>, /vim, /exit' }]);
    } else if (cmd === 'clear') {
      setMessages([]);
    } else if (cmd.startsWith('theme ')) {
      const name = cmd.slice(6) as ThemeName;
      const names = getThemeNames();
      if (names.includes(name)) {
        setCurrentTheme(name);
        setMessages((prev) => [...prev, { role: 'system', content: `Theme changed to: ${name}` }]);
      } else {
        setMessages((prev) => [...prev, { role: 'system', content: `Unknown theme: ${name}. Available: ${names.join(', ')}` }]);
      }
    } else if (cmd === 'vim') {
      setVimMode(vimMode === 'normal' ? 'insert' : 'normal');
      setMessages((prev) => [...prev, { role: 'system', content: `Vim mode: ${vimMode === 'normal' ? 'insert' : 'normal'}` }]);
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
    }
  }

  return (
    <Box flexDirection="column" width="100%" height="100%">
      <Box flexDirection="column" flexGrow={1} paddingX={0}>
        <SplitPane direction="vertical" sizes={[15, 55, 20, 10]}>
          <RepoContextPane
            projectName={_pn || 'LoveCode'}
            branch={_br || 'main'}
            fileCount={_fc || 42}
            language={_lg || 'TypeScript'}
            framework={_fw || 'Node.js'}
            status={_rs || 'clean'}
            focused={focus === 'repo'}
          />
          <ChatPane
            messages={messages}
            streaming={streaming}
            streamedIndex={streamedIndex}
            streamedContent={streamedContent}
            focused={focus === 'chat'}
          />
          <CommandPane
            commands={commands}
            focused={focus === 'command'}
          />
          <InputPane
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            placeholder="Type a message or /help..."
            focused={focus === 'input'}
            mode={vimMode}
            vimMode={true}
          />
        </SplitPane>
      </Box>
        <StatusBar
          mode="chat"
          theme={currentTheme}
          focus={focus}
          vimMode={vimMode === 'normal' ? 'NORMAL' : 'INSERT'}
          messages={messages.length}
        />
    </Box>
  );
}
