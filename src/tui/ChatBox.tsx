import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { getTheme } from './theme.js';
import { useScroll } from './hooks.js';
import { renderMarkdown } from '../chat/markdown.js';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

interface ChatBoxProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  streaming?: boolean;
  streamedContent?: string;
  focused: boolean;
  placeholder?: string;
}

const SLASH_COMMANDS = ['help', 'clear', 'theme', 'connect', 'system', 'model', 'themes', 'export', 'sessions', 'vim', 'exit'];

function formatTime(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function MessageRow({ msg, isStreaming, streamContent, timestamp }: { msg: ChatMessage; isStreaming?: boolean; streamContent?: string; timestamp?: number }) {
  const theme = getTheme();
  const displayContent = isStreaming && streamContent !== undefined ? streamContent : msg.content;
  const label = msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'LoveCode' : 'System';
  const labelColor = msg.role === 'user' ? theme.colors.success : msg.role === 'assistant' ? theme.colors.primary : theme.colors.warning;
  const formatted = msg.role === 'assistant' || msg.role === 'system' ? renderMarkdown(displayContent) : displayContent;
  const time = formatTime(timestamp);
  const lines = formatted.split('\n');

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={labelColor}>{label}</Text>
        {time && <Text color={theme.colors.textDim}>{` ${time}`}</Text>}
      </Box>
      {lines.map((line, i) => (
        <Box key={i}>
          <Text color={theme.colors.text}>{line}</Text>
          {isStreaming && i === lines.length - 1 && <Text color={theme.colors.primary}>█</Text>}
        </Box>
      ))}
    </Box>
  );
}

export function ChatBox({ messages, onSend, streaming, streamedContent, focused, placeholder = 'Type a message...' }: ChatBoxProps) {
  const [input, setInput] = useState('');
  const [vimMode, setVimMode] = useState<'insert' | 'normal'>('insert');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [tabIndex, setTabIndex] = useState(-1);
  const scroll = useScroll();
  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    scroll.scrollToBottom();
  }, [messages.length, streamedContent]);

  function submitInput(val: string) {
    if (!val.trim()) return;
    onSend(val);
    setHistory(prev => [val, ...prev].slice(0, 50));
    setHistoryIdx(-1);
    setInput('');
  }

  function handleTab() {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed.startsWith('/')) return;
    const partial = trimmed.slice(1);
    const matches = SLASH_COMMANDS.filter(c => c.startsWith(partial));
    if (matches.length === 0) return;
    const next = (tabIndex + 1) % matches.length;
    setTabIndex(next);
    setInput('/' + matches[next] + ' ');
  }

  useInput((text, key) => {
    if (!focused) return;

    if (vimMode === 'normal') {
      if (text === 'i') { setVimMode('insert'); return; }
      if (text === 'a') { setVimMode('insert'); setInput(prev => prev + ' '); return; }
      if (text === 'j') { scroll.scrollDown(); return; }
      if (text === 'k') { scroll.scrollUp(); return; }
      if (text === 'g') { scroll.scrollToTop(); return; }
      if (text === 'G') { scroll.scrollToBottom(); return; }
      if (text === '0') { setInput(''); return; }
      return;
    }

    if (key.escape) { setVimMode('normal'); return; }
    if (key.return) { submitInput(input); return; }
    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
      setTabIndex(-1);
      return;
    }
    if (key.upArrow) {
      if (history.length > 0) {
        const nextIdx = historyIdx < history.length - 1 ? historyIdx + 1 : historyIdx;
        setHistoryIdx(nextIdx);
        setInput(history[nextIdx] || '');
      }
      return;
    }
    if (key.downArrow) {
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setInput(history[nextIdx]);
      } else {
        setHistoryIdx(-1);
        setInput('');
      }
      return;
    }
    if (key.pageUp) { for (let i = 0; i < 10; i++) scroll.scrollUp(); return; }
    if (key.pageDown) { for (let i = 0; i < 10; i++) scroll.scrollDown(); return; }

    if (text === '\t') { handleTab(); return; }
    setTabIndex(-1);

    if (text && text.length === 1 && !key.ctrl && !key.meta) {
      setInput(prev => prev + text);
    }
  });

  const theme = getTheme();
  const cursor = vimMode === 'normal' ? '▌' : '█';
  const modeIndicator = vimMode === 'normal' ? ' NORMAL ' : ' INSERT ';
  const hasMore = messages.length > 10;
  const totalMessages = messages.length;

  return (
    <Box flexDirection="column" height="100%" width="100%">
      <Box
        flexDirection="column"
        flexGrow={1}
        overflowY="hidden"
        overflowX="hidden"
        paddingX={1}
        paddingY={0}
      >
        {messages.length === 0 && (
          <Box flexDirection="column" alignItems="center" marginTop={2}>
            <Text bold color={theme.colors.primary}>LoveCode AI</Text>
            <Text color={theme.colors.textDim}>Type a message or /help to start</Text>
          </Box>
        )}
        {messages.map((msg, i) => (
          <MessageRow
            key={i}
            msg={msg}
            isStreaming={streaming && i === messages.length - 1}
            streamContent={streaming && i === messages.length - 1 ? streamedContent : undefined}
            timestamp={msg.timestamp}
          />
        ))}
        {streaming && !streamedContent && (
          <Box><Text color={theme.colors.warning}>Thinking...</Text></Box>
        )}
        {hasMore && (
          <Box marginTop={1}>
            <Text color={theme.colors.textDim}>
              {totalMessages} messages — j/k to scroll
            </Text>
          </Box>
        )}
      </Box>
      <Box
        borderStyle="round"
        borderColor={focused ? theme.colors.primary : theme.colors.border}
        marginX={0}
        paddingX={1}
      >
        <Text bold color={theme.colors.warning}>{modeIndicator}</Text>
        <Text bold color={theme.colors.success}>{'> '}</Text>
        <Text color={theme.colors.text}>
          {input || <Text italic color={theme.colors.textDim}>{placeholder}</Text>}
        </Text>
        {focused && vimMode === 'insert' && <Text color={theme.colors.primary}>{cursor}</Text>}
      </Box>
    </Box>
  );
}
