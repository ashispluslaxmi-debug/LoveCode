import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import { getTheme } from './theme.js';
import { useScroll, useSpinner } from './hooks.js';
import type { FocusTarget } from './hooks.js';

interface SplitPaneProps {
  direction: 'horizontal' | 'vertical';
  sizes: number[];
  children: React.ReactNode[];
  gap?: number;
}

export function SplitPane({ direction, sizes, children, gap = 1 }: SplitPaneProps) {
  return (
    <Box flexDirection={direction === 'horizontal' ? 'row' : 'column'} width="100%" height="100%">
      {React.Children.map(children, (child, i) => {
        if (!child) return null;
        const isLast = i === children.length - 1;
        const size = sizes[i] || 1;
        return (
          <>
            <Box
              flexGrow={0}
              flexShrink={0}
              width={direction === 'horizontal' ? `${size}%` : '100%'}
              height={direction === 'vertical' ? `${size}%` : '100%'}
            >
              {child}
            </Box>
            {!isLast && <Box width={direction === 'horizontal' ? gap : '100%'} height={direction === 'vertical' ? gap : 1} />}
          </>
        );
      })}
    </Box>
  );
}

interface PaneProps {
  title: string;
  children: React.ReactNode;
  focused?: boolean;
  borderColor?: string;
  height?: string | number;
}

export function Pane({ title, children, focused = false, borderColor, height }: PaneProps) {
  const theme = getTheme();
  const color = borderColor || (focused ? theme.colors.primary : theme.colors.border);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      height={height || '100%'}
      width="100%"
    >
      <Box>
        <Text bold color={color}>
          {' '}{title}{' '}
        </Text>
      </Box>
      <Box flexDirection="column" paddingX={1} paddingY={0} flexGrow={1}>
        {children}
      </Box>
    </Box>
  );
}

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
  streamedContent?: string;
}

export function ChatMessage({ role, content, streaming, streamedContent }: ChatMessageProps) {
  const theme = getTheme();
  const displayContent = streaming && streamedContent !== undefined ? streamedContent : content;
  const label = role === 'user' ? 'You' : role === 'assistant' ? 'LoveCode' : 'System';
  const labelColor = role === 'user' ? theme.colors.success : role === 'assistant' ? theme.colors.primary : theme.colors.warning;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={labelColor}>{label}</Text>
      </Box>
      <Box>
        <Text color={theme.colors.text}>{displayContent}</Text>
        {streaming && <Text color={theme.colors.primary}>█</Text>}
      </Box>
    </Box>
  );
}

interface RepoContextPaneProps {
  projectName?: string;
  branch?: string;
  fileCount?: number;
  language?: string;
  framework?: string;
  status?: string;
  focused: boolean;
}

export function RepoContextPane({ projectName, branch, fileCount, language, framework, status, focused }: RepoContextPaneProps) {
  const theme = getTheme();

  return (
    <Pane title="Repo Context" focused={focused} height={7}>
      <Box flexDirection="row" gap={2}>
        <Box flexDirection="column" width="50%">
          {projectName && <Text><Text bold color={theme.colors.secondary}>Project:</Text> <Text color={theme.colors.text}>{projectName}</Text></Text>}
          {branch && <Text><Text bold color={theme.colors.secondary}>Branch:</Text> <Text color={theme.colors.text}>{branch}</Text></Text>}
          {fileCount !== undefined && <Text><Text bold color={theme.colors.secondary}>Files:</Text> <Text color={theme.colors.text}>{fileCount}</Text></Text>}
        </Box>
        <Box flexDirection="column" width="50%">
          {language && <Text><Text bold color={theme.colors.secondary}>Language:</Text> <Text color={theme.colors.text}>{language}</Text></Text>}
          {framework && <Text><Text bold color={theme.colors.secondary}>Framework:</Text> <Text color={theme.colors.text}>{framework}</Text></Text>}
          {status && <Text><Text bold color={theme.colors.secondary}>Status:</Text> <Text color={theme.colors.text}>{status}</Text></Text>}
        </Box>
      </Box>
    </Pane>
  );
}

interface ChatPaneProps {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  streaming?: boolean;
  streamedIndex?: number;
  streamedContent?: string;
  focused: boolean;
  onScroll?: (dir: 'up' | 'down') => void;
}

export function ChatPane({ messages, streaming, streamedIndex, streamedContent, focused }: ChatPaneProps) {
  const scroll = useScroll();

  useEffect(() => {
    scroll.scrollToBottom();
  }, [messages.length]);

  return (
    <Pane title="Chat" focused={focused} height="100%">
      <Box flexDirection="column" overflowY="hidden" overflowX="hidden">
        {messages.length === 0 && (
          <Text color={getTheme().colors.textDim}>Start typing to chat with LoveCode AI</Text>
        )}
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            role={msg.role}
            content={streaming && i === streamedIndex && streamedContent !== undefined ? streamedContent : msg.content}
            streaming={streaming && i === streamedIndex}
            streamedContent={streaming && i === streamedIndex ? streamedContent : undefined}
          />
        ))}
      </Box>
    </Pane>
  );
}

interface CommandPaneProps {
  commands: Array<{ command: string; output: string; status: 'running' | 'success' | 'error' }>;
  focused: boolean;
}

export function CommandPane({ commands, focused }: CommandPaneProps) {
  const spinner = useSpinner();
  const theme = getTheme();

  return (
    <Pane title="Command Runner" focused={focused}>
      <Box flexDirection="column" overflowY="hidden" overflowX="hidden">
        {commands.length === 0 && (
          <Text color={theme.colors.textDim}>Commands will appear here</Text>
        )}
        {commands.map((cmd, i) => (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Box>
              <Text>
                {cmd.status === 'running' && <Text color={theme.colors.warning}>{spinner} </Text>}
                {cmd.status === 'success' && <Text color={theme.colors.success}>✓ </Text>}
                {cmd.status === 'error' && <Text color={theme.colors.error}>✗ </Text>}
                <Text color={theme.colors.text}>{cmd.command}</Text>
              </Text>
            </Box>
            {(cmd.status === 'running' || cmd.output) && (
              <Box paddingLeft={3}>
                <Text color={cmd.status === 'error' ? theme.colors.error : theme.colors.textDim}>
                  {cmd.output.slice(0, 200)}
                  {cmd.output.length > 200 ? '...' : ''}
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Pane>
  );
}

interface InputPaneProps {
  value: string;
  onChange: (_value: string) => void;
  onSubmit: (_value: string) => void;
  placeholder?: string;
  focused: boolean;
  mode?: 'insert' | 'normal';
  vimMode?: boolean;
}

export function InputPane({ value, placeholder, focused, mode, vimMode }: InputPaneProps) {
  const theme = getTheme();
  const cursor = vimMode ? (mode === 'normal' ? '▌' : '█') : '█';
  const modeIndicator = vimMode ? (mode === 'normal' ? ' NORMAL ' : ' INSERT ') : '';

  return (
    <Pane title={`Input${modeIndicator}`} focused={focused} height={4}>
      <Box flexDirection="row">
        <Text bold color={theme.colors.success}>{' > '}</Text>
        <Text color={theme.colors.text}>
          {value || (placeholder ? <Text color={theme.colors.textDim}>{placeholder}</Text> : null)}
        </Text>
        {focused && <Text color={theme.colors.primary}>{cursor}</Text>}
      </Box>
    </Pane>
  );
}

interface StatusBarProps {
  mode: string;
  theme?: string;
  focus: FocusTarget;
  vimMode: string;
  messages: number;
}

export function StatusBar({ mode, theme: themeName, focus, vimMode, messages }: StatusBarProps) {
  const theme = getTheme();

  return (
    <Box
      flexDirection="row"
      width="100%"
      paddingX={1}
      justifyContent="space-between"
    >
      <Text>
        <Text color={theme.colors.secondary}>LoveCode</Text>
        <Text color={theme.colors.textDim}> AI </Text>
        <Text color={theme.colors.muted}>|</Text>
        <Text color={theme.colors.text}> Mode: </Text>
        <Text color={theme.colors.primary}>{mode}</Text>
      </Text>
      <Text>
        <Text color={theme.colors.textDim}>Focus: </Text>
        <Text color={theme.colors.accent}>{focus}</Text>
        <Text color={theme.colors.muted}> | </Text>
        <Text color={theme.colors.textDim}>Vim: </Text>
        <Text color={vimMode === 'NORMAL' ? theme.colors.warning : theme.colors.textDim}>{vimMode}</Text>
        <Text color={theme.colors.muted}> | </Text>
        <Text color={theme.colors.textDim}>{messages} msgs</Text>
        <Text color={theme.colors.muted}> | </Text>
        <Text color={theme.colors.textDim}>{themeName}</Text>
      </Text>
    </Box>
  );
}

export function Divider(): React.ReactElement {
  const theme = getTheme();
  return (
    <Box width="100%">
      <Text color={theme.colors.border}>{'─'.repeat(80)}</Text>
    </Box>
  );
}
