import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Mic, MicOff, Paperclip, MoreVertical, Edit2, Trash2, Copy, Check,
  ChevronLeft, ChevronRight, Plus, FileText, Search, Globe, Headphones,
  Video, Brain, FileBarChart, BookOpen, HelpCircle, Image, Presentation,
  StickyNote, X, Upload, File, Sparkles, MessageSquare, Volume2,
  PanelLeft, PanelRight, Pencil, Undo2, Redo2, Bold, Italic, Link2, List, ListOrdered, RemoveFormatting, ChevronDown, FileUp, Trash, AlertTriangle, RefreshCw, Loader2, Square
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getConversation, sendMessage, sendMessageStream, uploadFiles, addDocumentsToConversation, editMessage, deleteMessage as deleteMessageApi, deleteDocument, createNote, updateNote, convertNoteToSource, unconvertNoteFromSource, toggleDocument, getFlashcards, generateFlashcards, deleteFlashcard, getMindMap, generateMindMap } from '../utils/api';
import MindMapCanvas from './MindMapCanvas';

// Resizable Panel Component
const ResizablePanel = ({ children, width, minWidth, maxWidth, onResize, side, isDark, collapsed }) => {
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;

      const container = panelRef.current?.parentElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      let newWidth;

      if (side === 'left') {
        newWidth = e.clientX - containerRect.left;
      } else {
        newWidth = containerRect.right - e.clientX;
      }

      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Set cursor - ew-resize is more visible in both themes
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, minWidth, maxWidth, onResize, side, isDark]);

  if (collapsed) return null;

  return (
    <div
      ref={panelRef}
      className="relative flex-shrink-0 h-full"
      style={{ width: `${width}px` }}
    >
      {children}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute top-0 ${side === 'left' ? 'right-0' : 'left-0'} w-3 h-full transition-colors z-10`}
        style={{
          cursor: 'ew-resize',
          background: 'transparent'
        }}
      />
    </div>
  );
};

// Citation component for inline citations - NotebookLM style
const InlineCitation = ({ number, source, chunkContent, isDark, onCitationClick, leftPanelCollapsed }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const buttonRef = useRef(null);
  const [tooltipPosition, setTooltipPosition] = useState('center');

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setShowTooltip(false);
    onCitationClick(source, chunkContent);
  };

  const handleMouseEnter = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const tooltipWidth = 320; // w-80 = 20rem = 320px

      // When left panel is open, prefer showing tooltip on the right side
      if (!leftPanelCollapsed) {
        if (window.innerWidth - rect.right < tooltipWidth + 50) {
          setTooltipPosition('right');
        } else {
          setTooltipPosition('left');
        }
      }
      // When left panel is collapsed, use center positioning
      else {
        // Check if tooltip would overflow left
        if (rect.left < tooltipWidth / 2 + 16) {
          setTooltipPosition('left');
        }
        // Check if tooltip would overflow right
        else if (window.innerWidth - rect.right < tooltipWidth / 2 + 16) {
          setTooltipPosition('right');
        }
        else {
          setTooltipPosition('center');
        }
      }
    }
    setShowTooltip(true);
  };

  const getTooltipStyle = () => {
    if (tooltipPosition === 'left') {
      return { left: '30%', transform: 'translateX(-30%)' };
    } else if (tooltipPosition === 'right') {
      return { right: '0', left: 'auto', transform: 'translateX(0)' };
    }
    return { left: '50%', transform: 'translateX(-50%)' };
  };

  const getArrowStyle = () => {
    if (tooltipPosition === 'left') {
      return { left: '30%', transform: 'translateX(0)' };
    } else if (tooltipPosition === 'right') {
      return { right: '16px', left: 'auto', transform: 'translateX(0)' };
    }
    return { left: '50%', transform: 'translateX(-50%)' };
  };

  return (
    <span
      className="relative inline z-[10000]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        ref={buttonRef}
        onClick={handleClick}
        className={`inline-flex items-center justify-center min-w-[16px] h-[16px] mx-0.5 text-[10px] font-bold rounded cursor-pointer relative z-[10001]
          ${isDark ? 'bg-amber-500/30 text-amber-300 hover:bg-amber-500/50' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}
          transition-colors`}
        style={{
          verticalAlign: 'middle',
          lineHeight: 1,
          padding: '0 4px',
          pointerEvents: 'auto'
        }}
      >
        {number}
      </button>
      {showTooltip && (
        <div
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`absolute z-[999999] p-3 rounded-lg text-xs shadow-2xl pointer-events-auto
            ${isDark ? 'bg-[#2a2a2a] text-gray-200 border border-white/10' : 'bg-white text-gray-800 border border-gray-200'}`}
          style={{
            bottom: 'calc(100% + 8px)',
            pointerEvents: 'auto',
            width: '265px',
            ...getTooltipStyle()
          }}
        >
          {/* Arrow pointing down */}
          <div
            className={`absolute w-3 h-3 rotate-45 ${isDark ? 'bg-[#2a2a2a] border-r border-b border-white/10' : 'bg-white border-r border-b border-gray-200'}`}
            style={{
              bottom: '-6px',
              ...getArrowStyle()
            }}
          />
          <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
            <FileText size={12} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
            <span className={`font-medium text-[11px] truncate ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              {source}
            </span>
          </div>
          {chunkContent ? (
            <div
              className={`leading-relaxed text-[11px] max-h-48 overflow-y-auto custom-scrollbar ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
              style={{ wordBreak: 'break-word' }}
            >
              {chunkContent}
            </div>
          ) : (
            <div className={`leading-relaxed text-[11px] ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              No preview available.
            </div>
          )}
          <button
            onClick={handleClick}
            className={`flex items-center gap-1 mt-2 pt-2 border-t text-[10px] w-full cursor-pointer hover:underline ${isDark ? 'border-white/10 text-amber-400 hover:text-amber-300' : 'border-gray-100 text-amber-600 hover:text-amber-700'}`}
          >
            <Search size={10} />
            <span>Click to view in document</span>
          </button>
        </div>
      )}
    </span>
  );
};

// Markdown renderer with theme support and inline citations
const MarkdownRenderer = ({ content, isDark, sources = [], sourceChunks = [], onCitationClick, leftPanelCollapsed }) => {
  const [copiedCode, setCopiedCode] = useState(null);

  const copyToClipboard = async (code, index) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(index);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const processTextWithCitations = (text, children) => {
    if (!sourceChunks || sourceChunks.length === 0 || typeof text !== 'string') {
      return children;
    }

    const citationRegex = /\[(\d+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let hasMatchedCitation = false;

    while ((match = citationRegex.exec(text)) !== null) {
      const citationNum = parseInt(match[1], 10);
      const chunk = sourceChunks.find(sc => sc.index === citationNum);
      const fallbackSource = sources[citationNum - 1] || 'Document';
      const source = chunk?.source || fallbackSource;
      const chunkContent = (chunk?.chunk || '').trim();

      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      parts.push(
        <InlineCitation
          key={`cite-${match.index}`}
          number={citationNum}
          source={source}
          chunkContent={chunkContent}
          isDark={isDark}
          onCitationClick={onCitationClick}
          leftPanelCollapsed={leftPanelCollapsed}
        />
      );

      lastIndex = match.index + match[0].length;
      hasMatchedCitation = true;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return hasMatchedCitation ? parts : children;
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeString = String(children).replace(/\n$/, '');
          const codeIndex = Math.random().toString(36).substr(2, 9);

          if (!inline && match) {
            return (
              <div className="relative group my-3">
                <div className={`flex items-center justify-between px-4 py-2 text-xs rounded-t-lg
                  ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                  <span>{match[1]}</span>
                  <button
                    onClick={() => copyToClipboard(codeString, codeIndex)}
                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors
                      ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                  >
                    {copiedCode === codeIndex ? (
                      <><Check size={14} /> Copied</>
                    ) : (
                      <><Copy size={14} /> Copy</>
                    )}
                  </button>
                </div>
                <SyntaxHighlighter
                  style={isDark ? oneDark : oneLight}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                    fontSize: '0.875rem',
                  }}
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          }

          return (
            <code className={`px-1.5 py-0.5 rounded text-sm
              ${isDark ? 'bg-gray-700 text-amber-300' : 'bg-amber-100 text-amber-800'}`} {...props}>
              {children}
            </code>
          );
        },
        p: ({ children, node }) => {
          const processedChildren = React.Children.map(children, child => {
            if (typeof child === 'string') {
              return processTextWithCitations(child, child);
            }
            return child;
          });
          return <p className={`mb-3 last:mb-0 leading-relaxed ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{processedChildren}</p>;
        },
        li: ({ children }) => {
          const processedChildren = React.Children.map(children, child => {
            if (typeof child === 'string') {
              return processTextWithCitations(child, child);
            }
            return child;
          });
          return <li className={`leading-relaxed ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{processedChildren}</li>;
        },
        ul: ({ children }) => <ul className={`list-disc list-inside mb-3 space-y-1 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{children}</ul>,
        ol: ({ children }) => <ol className={`list-decimal list-inside mb-3 space-y-1 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{children}</ol>,
        h1: ({ children }) => <h1 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{children}</h1>,
        h2: ({ children }) => <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{children}</h2>,
        h3: ({ children }) => <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className={`border-l-4 pl-4 my-3 italic
            ${isDark ? 'border-amber-500 text-gray-300' : 'border-amber-400 text-gray-600'}`}>
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer"
            className={`underline ${isDark ? 'text-amber-400 hover:text-amber-300' : 'text-amber-600 hover:text-amber-700'}`}>
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className={`min-w-full border ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => {
          const processedChildren = React.Children.map(children, child => {
            if (typeof child === 'string') {
              return processTextWithCitations(child, child);
            }
            return child;
          });
          return (
            <th className={`px-4 py-2 text-left font-semibold border-b ${isDark ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-gray-100 border-gray-300 text-gray-900'}`}>
              {processedChildren}
            </th>
          );
        },
        td: ({ children }) => {
          const processedChildren = React.Children.map(children, child => {
            if (typeof child === 'string') {
              return processTextWithCitations(child, child);
            }
            return child;
          });
          return (
            <td className={`px-4 py-2 border-b ${isDark ? 'border-gray-700 text-gray-100' : 'border-gray-300 text-gray-800'}`}>
              {processedChildren}
            </td>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

const ChatInterface = ({ conversationId, onConversationUpdate, isDark = false }) => {
  // Panel states
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // Chat states
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const [conversationTitle, setConversationTitle] = useState('');
  const [documents, setDocuments] = useState([]);
  const [currentLlmMode, setCurrentLlmMode] = useState('api');
  const [cloudModel, setCloudModel] = useState(() => localStorage.getItem('docTalkCloudModel') || 'gemini');
  const [showModelMenu, setShowModelMenu] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const [activeParentId, setActiveParentId] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Title editing states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');

  // Edit states
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [showMessageMenu, setShowMessageMenu] = useState(null);

  // File upload states
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Notes state
  const [notes, setNotes] = useState([]);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('New Note');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('Normal');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [previousRightPanelWidth, setPreviousRightPanelWidth] = useState(320);
  const [showNoteMenu, setShowNoteMenu] = useState(false);
  const [showNoteItemMenu, setShowNoteItemMenu] = useState(null);
  const [editorFixedWidth] = useState(480);
  const [previewFile, setPreviewFile] = useState(null);
  const [highlightedContent, setHighlightedContent] = useState(null);
  const [sourcePreview, setSourcePreview] = useState(null);
  const [sourceHighlight, setSourceHighlight] = useState(null);
  const [showDeleteSourceConfirm, setShowDeleteSourceConfirm] = useState(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [processingNoteId, setProcessingNoteId] = useState(null);
  const [processingDocIds, setProcessingDocIds] = useState([]);
  const noteEditorRef = useRef(null);

  // Flashcard states
  const [flashcards, setFlashcards] = useState([]);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Mind Map states
  const [mindMapData, setMindMapData] = useState(null);
  const [mindMapLoading, setMindMapLoading] = useState(false);
  const [showMindMap, setShowMindMap] = useState(false);
  const [mindMapCanvasMode, setMindMapCanvasMode] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [mindMapZoom, setMindMapZoom] = useState(1);
  const [mindMapPan, setMindMapPan] = useState({ x: 0, y: 0 });
  const mindMapGenRef = useRef(false);

  // Refs
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Simple textarea - no complex auto-resize, just track if we have content
  useEffect(() => {
    setIsExpanded(inputMessage.includes('\n') || inputMessage.length > 80);
  }, [inputMessage]);
  // Theme colors - matching landing page glass effects
  const theme = {
    bg: isDark ? 'bg-transparent' : 'bg-transparent',
    panelBg: isDark ? 'bg-white/[0.03] backdrop-blur-xl border border-white/10' : 'bg-white/70 backdrop-blur-xl border border-amber-100/50',
    panelBorder: isDark ? 'border-white/10' : 'border-amber-100/50',
    text: isDark ? 'text-gray-100' : 'text-gray-900',
    textMuted: isDark ? 'text-gray-500' : 'text-gray-500',
    textSecondary: isDark ? 'text-gray-400' : 'text-gray-600',
    inputBg: isDark ? 'bg-white/5 backdrop-blur-xl' : 'bg-white/80 backdrop-blur-xl',
    inputBorder: isDark ? 'border-white/10' : 'border-amber-200/50',
    cardBg: isDark ? 'bg-white/[0.02]' : 'bg-white/50',
    cardBorder: isDark ? 'border-white/5' : 'border-amber-100/30',
    hoverBg: isDark ? 'hover:bg-white/5' : 'hover:bg-amber-50/50',
    buttonPrimary: isDark ? 'bg-amber-600 hover:bg-amber-500' : 'bg-amber-600 hover:bg-amber-700',
    userMessage: isDark ? 'bg-amber-600' : 'bg-amber-600',
    assistantMessage: isDark ? 'bg-white/[0.03] backdrop-blur-xl' : 'bg-white/80 backdrop-blur-xl',
  };

  // Studio tools
  const studioTools = [
    { icon: Headphones, label: 'Audio Overview', color: isDark ? 'text-purple-400' : 'text-purple-600' },
    { icon: Video, label: 'Video Overview', color: isDark ? 'text-blue-400' : 'text-blue-600' },
    { icon: Brain, label: 'Mind Map', color: isDark ? 'text-emerald-400' : 'text-emerald-600' },
    { icon: FileBarChart, label: 'Reports', color: isDark ? 'text-orange-400' : 'text-orange-600' },
    { icon: BookOpen, label: 'Flashcards', color: isDark ? 'text-pink-400' : 'text-pink-600' },
    { icon: HelpCircle, label: 'Quiz', color: isDark ? 'text-cyan-400' : 'text-cyan-600' },
    { icon: Image, label: 'Infographic', color: isDark ? 'text-yellow-400' : 'text-yellow-600' },
    { icon: Presentation, label: 'Slide Deck', color: isDark ? 'text-indigo-400' : 'text-indigo-600' },
  ];

  const scrollToBottom = useCallback(() => {
    if (!userScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [userScrolledUp]);

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setUserScrolledUp(!isAtBottom);
    setShowScrollToBottom(!isAtBottom && isStreaming);
  }, [isStreaming]);

  const handleScrollToBottom = () => {
    setUserScrolledUp(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize note editor content when opening a note
  useEffect(() => {
    if (showNoteInput && noteEditorRef.current) {
      // Set the initial content
      noteEditorRef.current.innerHTML = noteContent;
      // Focus at the end
      setTimeout(() => {
        noteEditorRef.current?.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        if (noteEditorRef.current?.lastChild) {
          range.selectNodeContents(noteEditorRef.current);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }, 0);
    }
  }, [showNoteInput, editingNoteId]);

  // Load conversation
  useEffect(() => {
    if (conversationId) {
      loadConversation();
    } else {
      setMessages([]);
      setConversationMessages([]);
      setConversationTitle('');
      setDocuments([]);
      setNotes([]);
    }
  }, [conversationId]);

  const buildSourceChunks = (srcs = [], chunks = []) => {
    if (chunks && chunks.length) return chunks;
    if (srcs && srcs.length) {
      return srcs.map((s, i) => ({ index: i + 1, source: s || 'Document', chunk: '' }));
    }
    return [];
  };

  const buildNormalizedBranchFromAllMessages = (allMessages = [], startId = null) => {
    if (!Array.isArray(allMessages) || allMessages.length === 0) {
      return { normalizedMessages: [], lastAssistantId: null };
    }

    const messageMap = new Map();
    allMessages.forEach((msg) => messageMap.set(msg.id, msg));

    const childrenMap = new Map();
    allMessages.forEach((msg) => {
      if (!msg.reply_to_message_id) return;
      if (!childrenMap.has(msg.reply_to_message_id)) {
        childrenMap.set(msg.reply_to_message_id, []);
      }
      childrenMap.get(msg.reply_to_message_id).push(msg);
    });

    const editGroupMap = new Map();
    allMessages
      .filter((msg) => msg.role === 'user')
      .forEach((msg) => {
        const groupId = msg.edit_group_id || msg.id;
        if (!editGroupMap.has(groupId)) editGroupMap.set(groupId, []);
        editGroupMap.get(groupId).push(msg);
      });

    editGroupMap.forEach((group) => {
      group.sort((a, b) => (a.version_index || 1) - (b.version_index || 1));
    });

    const getChildren = (parentId) => childrenMap.get(parentId) || [];

    const getAssistantChildForUser = (userId) => {
      const children = getChildren(userId);
      return children.find((c) => c.role === 'assistant') || null;
    };

    const selectNextUserFromAssistant = (assistantId) => {
      const userChildren = getChildren(assistantId).filter((m) => m.role === 'user');
      if (!userChildren.length) return null;

      const latestByGroup = new Map();
      for (const u of userChildren) {
        const gid = u.edit_group_id || u.id;
        const existing = latestByGroup.get(gid);
        if (!existing || (u.version_index || 1) >= (existing.version_index || 1)) {
          latestByGroup.set(gid, u);
        }
      }

      let chosen = null;
      for (const candidate of latestByGroup.values()) {
        if (!chosen) {
          chosen = candidate;
          continue;
        }
        const cTime = new Date(candidate.created_at || candidate.timestamp || 0).getTime();
        const chosenTime = new Date(chosen.created_at || chosen.timestamp || 0).getTime();
        if (cTime > chosenTime) chosen = candidate;
      }
      return chosen;
    };

    const findLeafFromNode = (startNodeId) => {
      let currentId = startNodeId;
      const visited = new Set();

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const msg = messageMap.get(currentId);
        if (!msg) break;

        if (msg.role === 'user') {
          const assistantChild = getAssistantChildForUser(msg.id);
          if (!assistantChild) break;
          currentId = assistantChild.id;
          continue;
        }

        if (msg.role === 'assistant') {
          const nextUser = selectNextUserFromAssistant(msg.id);
          if (!nextUser) break;
          currentId = nextUser.id;
          continue;
        }

        break;
      }

      return currentId;
    };

    const buildBranchPathFromLeaf = (leafId) => {
      const path = [];
      let currentId = leafId;
      const visited = new Set();

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const msg = messageMap.get(currentId);
        if (!msg) break;
        path.push(msg);
        currentId = msg.reply_to_message_id;
      }

      path.reverse();
      return path;
    };

    const normalizeAssistant = (assistantMsg) => ({
      id: assistantMsg.id,
      role: 'assistant',
      content: assistantMsg.content,
      sources: assistantMsg.sources || [],
      sourceChunks: buildSourceChunks(
        assistantMsg.sources,
        assistantMsg.source_chunks || assistantMsg.sourceChunks
      ),
      timestamp: assistantMsg.created_at || assistantMsg.timestamp,
      reply_to_message_id: assistantMsg.reply_to_message_id,
    });

    const normalizeUser = (userMsg) => {
      const groupId = userMsg.edit_group_id || userMsg.id;
      const editGroup = editGroupMap.get(groupId) || [userMsg];
      const versionIdx = editGroup.findIndex((m) => m.id === userMsg.id);
      const safeEditIndex = versionIdx === -1 ? editGroup.length - 1 : versionIdx;

      const editHistory = editGroup.length > 1
        ? editGroup.map((editMsg, idx) => {
          const assistantChild = getAssistantChildForUser(editMsg.id);
          return {
            content: editMsg.content,
            timestamp: editMsg.created_at || editMsg.timestamp,
            branchId: `${groupId}_${idx}`,
            messageId: editMsg.id,
            // Rebuild the full branch when switching versions; keep this minimal.
            followingMessages: assistantChild ? [normalizeAssistant(assistantChild)] : [],
          };
        })
        : null;

      return {
        id: userMsg.id,
        role: 'user',
        content: userMsg.content,
        sources: [],
        timestamp: userMsg.created_at || userMsg.timestamp,
        edit_group_id: groupId,
        editHistory,
        editIndex: editHistory ? safeEditIndex : null,
        currentBranchId: editHistory ? `${groupId}_${safeEditIndex}` : null,
        reply_to_message_id: userMsg.reply_to_message_id,
      };
    };

    let startMsg = startId ? messageMap.get(startId) : null;
    if (!startMsg) {
      // Default: most recent message in the conversation
      startMsg = allMessages.reduce((acc, msg) => {
        if (!acc) return msg;
        const tA = new Date(msg.created_at || msg.timestamp || 0).getTime();
        const tB = new Date(acc.created_at || acc.timestamp || 0).getTime();
        return tA > tB ? msg : acc;
      }, null);
    }

    const leafId = startMsg ? findLeafFromNode(startMsg.id) : null;
    const branchPath = leafId ? buildBranchPathFromLeaf(leafId) : [];

    const normalizedMessages = [];
    for (const msg of branchPath) {
      if (msg.role === 'user') normalizedMessages.push(normalizeUser(msg));
      else if (msg.role === 'assistant') normalizedMessages.push(normalizeAssistant(msg));
    }

    const lastAssistant = [...normalizedMessages].reverse().find((m) => m.role === 'assistant');
    return { normalizedMessages, lastAssistantId: lastAssistant ? lastAssistant.id : null };
  };

  const loadConversation = async () => {
    try {
      const data = await getConversation(conversationId);
      setConversationTitle(data.conversation?.title || data.title || 'New Chat');
      setCurrentLlmMode(data.llm_mode || 'api');
      const storedCloudModel = localStorage.getItem(`cloudModel_${conversationId}`) || localStorage.getItem('docTalkCloudModel') || 'gemini';
      setCloudModel(storedCloudModel);

      if (data.documents) {
        const allDocs = data.documents.map((doc, idx) => {
          if (typeof doc === 'object' && doc !== null) {
            return {
              id: doc.id || idx,
              filename: doc.filename || doc.name || 'Document',
              content: doc.content,
              doc_type: doc.doc_type || 'file',
              is_active: doc.is_active !== false,
              uploaded_at: doc.uploaded_at,
              has_embeddings: doc.has_embeddings || false
            };
          }
          return { id: idx, filename: doc, doc_type: 'file', is_active: true, has_embeddings: false };
        });

        const files = allDocs.filter(d => d.doc_type !== 'note');
        const notesDocs = allDocs.filter(d => d.doc_type === 'note');
        const convertedNotes = notesDocs.filter(n => n.has_embeddings);

        setDocuments([...files, ...convertedNotes]);

        const loadedNotes = notesDocs.map(n => ({
          id: n.id,
          title: n.filename,
          content: n.content || '',
          createdAt: n.uploaded_at,
          convertedToSource: n.has_embeddings || false
        }));

        setNotes(loadedNotes);
        localStorage.setItem(`notes_${conversationId}`, JSON.stringify(loadedNotes));

      } else {
        setDocuments([]);
        const savedNotes = localStorage.getItem(`notes_${conversationId}`);
        if (savedNotes) {
          try {
            const parsed = JSON.parse(savedNotes);
            if (Array.isArray(parsed)) {
              setNotes(parsed);
            }
          } catch (e) {
            setNotes([]);
          }
        } else {
          setNotes([]);
        }
      }

      if (data.messages) {
        const allMessages = data.messages;
        setConversationMessages(allMessages);
        const { normalizedMessages, lastAssistantId } = buildNormalizedBranchFromAllMessages(allMessages);
        setMessages(normalizedMessages);
        setActiveParentId(lastAssistantId);
      }

      // Load flashcards
      try {
        const flashcardsData = await getFlashcards(conversationId);
        if (flashcardsData.flashcards && flashcardsData.flashcards.length > 0) {
          setFlashcards(flashcardsData.flashcards);
        }
      } catch (e) {
        // Flashcards not available, ignore
      }

      // Load mind map
      try {
        const mindMapResult = await getMindMap(conversationId);
        if (mindMapResult) {
          setMindMapData(mindMapResult);
          const savedExpanded = localStorage.getItem(`mindmap_expanded_${conversationId}`);
          if (savedExpanded) {
            setExpandedNodes(JSON.parse(savedExpanded));
          } else {
            const initialExpanded = {};
            mindMapResult.nodes?.forEach(node => { initialExpanded[node.id] = true; });
            setExpandedNodes(initialExpanded);
          }
          const savedZoom = localStorage.getItem(`mindmap_zoom_${conversationId}`);
          if (savedZoom) {
            setMindMapZoom(JSON.parse(savedZoom));
          }
          const savedPan = localStorage.getItem(`mindmap_pan_${conversationId}`);
          if (savedPan) {
            setMindMapPan(JSON.parse(savedPan));
          }
        }
      } catch (e) {
        // Mind map not available, ignore
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  // Voice input handler
  const handleVoiceInput = async () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('Speech Recognition not supported in your browser.');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false; // single session
      recognition.interimResults = false; // only final results
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        let captured = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (transcript && transcript.trim()) {
            captured += transcript + ' ';
          }
        }
        if (captured.trim()) {
          setInputMessage(prev => (prev ? `${prev} ${captured.trim()}` : captured.trim()));
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };

      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('Error accessing speech recognition:', error);
      alert('Microphone access denied or speech recognition not available.');
    }
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsStreaming(false);
      setIsLoading(false);

      // Mark last streaming message as stopped (whether thinking or generating)
      setMessages(prev => {
        const newMessages = [...prev];
        for (let i = newMessages.length - 1; i >= 0; i--) {
          if (newMessages[i].isStreaming || newMessages[i].isWaitingForFirstToken) {
            newMessages[i] = {
              ...newMessages[i],
              isStreaming: false,
              isWaitingForFirstToken: false,
              content: newMessages[i].content || '(Generation stopped)',
              isStopped: true
            };
            break;
          }
        }
        return newMessages;
      });
    }
  };

  // Flashcard handlers
  const flashcardGenRef = useRef(false);

  const handleGenerateFlashcards = async () => {
    if (!conversationId || flashcardGenRef.current) return;

    flashcardGenRef.current = true;
    setFlashcardsLoading(true);
    setShowFlashcards(true);

    try {
      const selectedCloudModel = currentLlmMode === 'api' ? cloudModel : null;
      console.log('[Flashcards] Generating with mode:', currentLlmMode, 'model:', selectedCloudModel);
      const result = await generateFlashcards(conversationId, selectedCloudModel);
      if (result.flashcards) {
        setFlashcards(result.flashcards);
        // Reset card view state when new cards are generated
        setCurrentCardIndex(0);
        setShowAnswer(false);
      }
    } catch (error) {
      console.error('Error generating flashcards:', error);
      alert(`Failed to generate flashcards: ${error.message}`);
    } finally {
      flashcardGenRef.current = false;
      setFlashcardsLoading(false);
    }
  };

  const handlePrevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
      setShowAnswer(false);
    }
  };

  const handleNextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setShowAnswer(false);
    }
  };

  const handleExplainCard = (cardFront) => {
    if (!cardFront) return;
    setShowFlashcards(false);
    setInputMessage(`Explain this in detail: ${cardFront}`);
    textareaRef.current?.focus();
  };

  const handleCloseFlashcards = () => {
    setShowFlashcards(false);
    setCurrentCardIndex(0);
    setShowAnswer(false);
  };

  const handleDeleteFlashcard = async (flashcardId) => {
    if (!conversationId) return;
    try {
      await deleteFlashcard(conversationId, flashcardId);
      setFlashcards(prev => {
        const newCards = prev.filter(fc => fc.id !== flashcardId);
        if (currentCardIndex >= newCards.length && newCards.length > 0) {
          setCurrentCardIndex(newCards.length - 1);
        }
        return newCards;
      });
    } catch (error) {
      console.error('Error deleting flashcard:', error);
    }
  };

  // Mind Map handlers
  const handleGenerateMindMap = async () => {
    if (!conversationId || mindMapGenRef.current) return;

    mindMapGenRef.current = true;
    setMindMapLoading(true);
    setShowMindMap(true);

    try {
      const selectedCloudModel = currentLlmMode === 'api' ? cloudModel : null;
      const result = await generateMindMap(conversationId, selectedCloudModel);
      if (result) {
        setMindMapData(result);
        const initialExpanded = {};
        result.nodes?.forEach(node => { initialExpanded[node.id] = true; });
        setExpandedNodes(initialExpanded);
        localStorage.setItem(`mindmap_expanded_${conversationId}`, JSON.stringify(initialExpanded));
      }
    } catch (error) {
      console.error('Error generating mind map:', error);
      alert(`Failed to generate mind map: ${error.message}`);
    } finally {
      mindMapGenRef.current = false;
      setMindMapLoading(false);
    }
  };

  const handleMindMapNodeToggle = (nodeId) => {
    setExpandedNodes(prev => {
      const updated = { ...prev, [nodeId]: !prev[nodeId] };
      localStorage.setItem(`mindmap_expanded_${conversationId}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleMindMapNodeClick = (label) => {
    setInputMessage(`Explain in detail about: "${label}"`);
    // Exit fullscreen mode but keep mind map visible at minimum width
    if (mindMapCanvasMode) {
      setMindMapCanvasMode(false);
    }
    // Focus the textarea for easy submission
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  const handleCloseMindMap = () => {
    setShowMindMap(false);
    setMindMapCanvasMode(false);
  };

  const handleStudioToolClick = (toolLabel) => {
    if (toolLabel === 'Flashcards') {
      if (flashcards.length > 0) {
        setShowFlashcards(true);
      } else {
        handleGenerateFlashcards();
      }
    } else if (toolLabel === 'Mind Map') {
      if (mindMapData) {
        setShowMindMap(true);
      } else {
        handleGenerateMindMap();
      }
    }
  };

  // Handle message submission
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if ((!inputMessage.trim() && selectedFiles.length === 0) || isLoading) return;

    const requestParentId = activeParentId;
    const tempUserMessageId = Date.now();
    const userMessage = {
      id: tempUserMessageId,
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);
    setIsStreaming(true);
    setUserScrolledUp(false); // Reset scroll state

    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);
    try {
      // Send message if there is one
      if (currentInput.trim()) {
        const selectedCloudModel = currentLlmMode === 'api' ? cloudModel : null;
        // Create a placeholder for streaming response
        const streamingMessageId = Date.now() + 1;
        let streamedContent = '';
        let sources = [];
        let sourceChunks = [];
        let hasReceivedFirstToken = false;
        let persistedUserMessageId = null;

        // Add placeholder message for streaming with waiting state
        setMessages(prev => [...prev, {
          id: streamingMessageId,
          role: 'assistant',
          content: '',
          sources: [],
          sourceChunks: [],
          timestamp: new Date().toISOString(),
          isStreaming: true,
          isWaitingForFirstToken: true,  // New flag for "Thinking..." state
        }]);

        await sendMessageStream(
          conversationId,
          currentInput,
          // onToken - update the message with each new token
          (token) => {
            if (!hasReceivedFirstToken) {
              hasReceivedFirstToken = true;
            }
            streamedContent += token;
            setMessages(prev => prev.map(msg =>
              msg.id === streamingMessageId
                ? { ...msg, content: streamedContent, isWaitingForFirstToken: false }
                : msg
            ));
          },
          // onMeta - receive sources at the start
          (meta) => {
            sources = meta.sources || [];
            sourceChunks = meta.source_chunks || [];

            // Replace the temporary user message id with the persisted DB id.
            // This is critical for correct edit/branch requests later.
            if (meta?.user_message_id) {
              persistedUserMessageId = meta.user_message_id;
              setMessages(prev => prev.map(msg =>
                msg.id === tempUserMessageId
                  ? {
                    ...msg,
                    id: meta.user_message_id,
                    edit_group_id: meta.edit_group_id || meta.user_message_id,
                  }
                  : msg
              ));

              // Keep an authoritative graph copy for branch reconstruction.
              // This makes branch switching affect persistence (parent_message_id) correctly.
              setConversationMessages(prev => {
                const exists = prev.some(m => m.id === meta.user_message_id);
                if (exists) return prev;
                return [
                  ...prev,
                  {
                    id: meta.user_message_id,
                    role: 'user',
                    content: currentInput,
                    created_at: new Date().toISOString(),
                    edit_group_id: meta.edit_group_id || meta.user_message_id,
                    version_index: 1,
                    reply_to_message_id: requestParentId,
                  }
                ];
              });
            }
            setMessages(prev => prev.map(msg =>
              msg.id === streamingMessageId
                ? { ...msg, sources, sourceChunks }
                : msg
            ));
          },
          // onDone - finalize the message
          (data) => {
            setMessages(prev => prev.map(msg =>
              msg.id === streamingMessageId
                ? {
                  ...msg,
                  id: data.assistant_message_id || streamingMessageId,
                  content: data.full_response || streamedContent,
                  isStreaming: false,
                  isWaitingForFirstToken: false
                }
                : msg
            ));
            setIsStreaming(false);
            setIsLoading(false);
            setAbortController(null);
            const finalAssistantId = data.assistant_message_id || streamingMessageId;
            setActiveParentId(finalAssistantId);

            // Update conversation graph with assistant message.
            setConversationMessages(prev => {
              const exists = prev.some(m => m.id === finalAssistantId);
              if (exists) return prev;
              const fallbackUser = [...prev].filter(m => m.role === 'user').slice(-1)[0];

              return [
                ...prev,
                {
                  id: finalAssistantId,
                  role: 'assistant',
                  content: data.full_response || streamedContent,
                  created_at: new Date().toISOString(),
                  reply_to_message_id: persistedUserMessageId || fallbackUser?.id || null,
                }
              ];
            });
          },
          // onError
          (error) => {
            console.error('Streaming error:', error);
            setMessages(prev => prev.map(msg =>
              msg.id === streamingMessageId
                ? {
                  ...msg,
                  content: `Error: ${error}`,
                  isStreaming: false,
                  isError: true
                }
                : msg
            ));
            setIsStreaming(false);
            setIsLoading(false);
            setAbortController(null);
          },
          controller.signal,
          false,
          null,
          selectedCloudModel,
          activeParentId  // Pass the active parent for proper branching
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
      setIsStreaming(false);
      setAbortController(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      // Replace selectedFiles instead of appending to prevent duplicates
      setSelectedFiles(files);
    }
    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCloudModelChange = (model) => {
    setCloudModel(model);
    if (conversationId) {
      localStorage.setItem(`cloudModel_${conversationId}`, model);
    }
    localStorage.setItem('docTalkCloudModel', model);
  };

  // Handle message editing
  const startEditing = (message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
    setShowMessageMenu(null);
  };

  const saveEdit = async (messageId) => {
    try {
      await editMessage(messageId, editContent);
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, content: editContent } : msg
      ));
      setEditingMessageId(null);
      setEditContent('');
    } catch (error) {
      console.error('Error updating message:', error);
    }
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  // Handle message deletion
  const handleDeleteMessage = async (messageId) => {
    try {
      await deleteMessageApi(messageId);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      setShowMessageMenu(null);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  // Copy message
  const copyMessage = async (content) => {
    await navigator.clipboard.writeText(content);
    setShowMessageMenu(null);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // NOTE: Textarea resize is handled in the useEffect near line 481
  // Do not add duplicate resize logic here

  // Close note menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showNoteItemMenu !== null && !e.target.closest('[data-note-menu]')) {
        setShowNoteItemMenu(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showNoteItemMenu]);

  // Add note - saves to backend
  const addNote = async () => {
    if (!noteContent.trim()) {
      alert('Note content cannot be empty');
      return null;
    }

    try {
      const savedNote = await createNote(conversationId, noteTitle || 'Untitled Note', noteContent);

      if (!savedNote?.id) {
        throw new Error('Note was not saved to database');
      }

      const newNote = {
        id: savedNote.id,
        title: savedNote.filename,
        content: savedNote.content,
        createdAt: savedNote.uploaded_at,
        convertedToSource: false
      };

      setNotes(prev => {
        const updated = [...prev, newNote];
        localStorage.setItem(`notes_${conversationId}`, JSON.stringify(updated));
        return updated;
      });

      setNoteContent('');
      setNoteTitle('New Note');
      setShowNoteInput(false);
      return newNote;

    } catch (error) {
      console.error('Failed to save note:', error);
      alert(`Note save failed: ${error.message}`);
      return null;
    }
  };

  // Delete note - removes from backend
  const deleteNote = async (noteId) => {
    try {
      await deleteDocument(conversationId, noteId);
      setNotes(prev => {
        const updated = prev.filter(note => note.id !== noteId);
        // Update localStorage
        localStorage.setItem(`notes_${conversationId}`, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Failed to delete note:', error);
      setNotes(prev => {
        const updated = prev.filter(note => note.id !== noteId);
        // Update localStorage
        localStorage.setItem(`notes_${conversationId}`, JSON.stringify(updated));
        return updated;
      });
    }
  };

  // Toggle document active status
  const handleToggleDocument = async (docId, currentStatus) => {
    try {
      await toggleDocument(conversationId, docId, !currentStatus);
      setDocuments(prev => prev.map(doc =>
        doc.id === docId ? { ...doc, is_active: !currentStatus } : doc
      ));
    } catch (error) {
      console.error('Failed to toggle document:', error);
    }
  };

  const handleConvertNoteToSource = async (noteId) => {
    const noteToConvert = notes.find(n => n.id === noteId);
    if (!noteToConvert) {
      alert('Note not found. Please refresh the page.');
      return;
    }

    if (noteId > 9999999999) {
      alert('Note is still being saved. Please wait and try again.');
      return;
    }

    setProcessingNoteId(noteId);
    setProcessingDocIds(prev => [...prev, noteId]);

    const alreadyInDocs = documents.some(d => d.id === noteId);

    if (!alreadyInDocs) {
      const tempDoc = {
        id: noteId,
        filename: noteToConvert.title,
        content: noteToConvert.content,
        doc_type: 'note',
        is_active: true,
        has_embeddings: false,
        isProcessing: true,
      };
      setDocuments(prev => [...prev, tempDoc]);
    } else {
      setDocuments(prev => prev.map(d => d.id === noteId ? { ...d, isProcessing: true } : d));
    }

    const start = Date.now();

    try {
      const result = await convertNoteToSource(conversationId, noteId);

      const minDuration = 2500;
      const elapsed = Date.now() - start;
      if (elapsed < minDuration) {
        await new Promise(res => setTimeout(res, minDuration - elapsed));
      }

      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, convertedToSource: true } : n));

      setDocuments(prev => {
        const exists = prev.some(d => d.id === noteId);
        if (!exists) {
          return [...prev, {
            id: noteId,
            filename: result.filename,
            content: result.content,
            doc_type: 'note',
            is_active: true,
            has_embeddings: true,
            isProcessing: false,
          }];
        }
        return prev.map(d => d.id === noteId ? {
          ...d,
          filename: result.filename,
          content: result.content,
          has_embeddings: true,
          isProcessing: false
        } : d);
      });
    } catch (error) {
      console.error('Convert failed:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Unknown error';
      alert(`Failed to convert note: ${errorMsg}`);
      setDocuments(prev => prev.filter(d => d.id !== noteId || d.has_embeddings));
    } finally {
      setProcessingNoteId(null);
      setProcessingDocIds(prev => prev.filter(id => id !== noteId));
    }
  };

  // Handle title save
  const handleTitleSave = () => {
    const newTitle = editTitleValue.trim() || 'New Chat';
    setConversationTitle(newTitle);
    setIsEditingTitle(false);
    // TODO: Save to backend if needed
  };

  // Copy message content
  const handleCopyMessage = async (content, messageId) => {
    await navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Text-to-speech for AI responses
  const handleSpeak = (content, messageId) => {
    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);
    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  // Handle edit and regenerate with streaming
  const handleEditAndRegenerate = async (messageId) => {
    if (!editContent.trim()) return;

    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const oldMessage = messages[messageIndex];

    // Get the edit_group_id - use existing one or the original message's ID
    const editGroupId = oldMessage.edit_group_id || oldMessage.id;

    // The edited version must attach to the same parent assistant as the original.
    const editParentId = oldMessage.reply_to_message_id || null;

    // Build edit history
    const existingHistory = oldMessage.editHistory || [{
      content: oldMessage.content,
      timestamp: oldMessage.timestamp,
      branchId: oldMessage.id + '_0',
      followingMessages: messages.slice(messageIndex + 1),
      messageId: oldMessage.id
    }];

    // Save current branch's messages
    const currentIndex = oldMessage.editIndex ?? existingHistory.length - 1;
    existingHistory[currentIndex] = {
      ...existingHistory[currentIndex],
      followingMessages: messages.slice(messageIndex + 1)
    };

    // Create new edit entry
    const newBranchId = `${editGroupId}_${existingHistory.length}`;
    const newEdit = {
      content: editContent,
      timestamp: new Date().toISOString(),
      branchId: newBranchId,
      followingMessages: [],
      messageId: null  // Will be set after we get the new message ID
    };

    const updatedUserMessage = {
      ...oldMessage,
      content: editContent,
      editHistory: [...existingHistory, newEdit],
      editIndex: existingHistory.length,
      timestamp: new Date().toISOString(),
      currentBranchId: newBranchId,
      edit_group_id: editGroupId,
    };

    // Remove messages after edit, add streaming placeholder
    const messagesBeforeEdit = messages.slice(0, messageIndex);
    const streamingMessageId = Date.now() + 1;

    setMessages([
      ...messagesBeforeEdit,
      updatedUserMessage,
      {
        id: streamingMessageId,
        role: 'assistant',
        content: '',
        sources: [],
        sourceChunks: [],
        timestamp: new Date().toISOString(),
        isStreaming: true,
        isWaitingForFirstToken: true,
        branchId: newBranchId,
      }
    ]);

    setEditingMessageId(null);
    setEditContent('');
    setIsLoading(true);
    setIsStreaming(true);
    setUserScrolledUp(false);

    const controller = new AbortController();
    setAbortController(controller);

    let streamedContent = '';
    let sources = [];
    let sourceChunks = [];
    let persistedEditedUserId = null;
    const selectedCloudModel = currentLlmMode === 'api' ? cloudModel : null;

    try {
      await sendMessageStream(
        conversationId,
        editContent,
        (token) => {
          streamedContent += token;
          setMessages(prev => prev.map(msg =>
            msg.id === streamingMessageId
              ? { ...msg, content: streamedContent, isWaitingForFirstToken: false }
              : msg
          ));
        },
        (meta) => {
          sources = meta.sources || [];
          sourceChunks = meta.source_chunks || [];

          // Capture persisted user message ID for branch linking
          const newUserMessageId = meta.user_message_id;
          persistedEditedUserId = newUserMessageId;
          if (newUserMessageId) {
            setMessages(prev => {
              const msgIdx = prev.findIndex(m => m.id === messageId);
              if (msgIdx === -1) return prev;

              const userMsg = prev[msgIdx];
              const updatedHistory = [...(userMsg.editHistory || [])];
              if (updatedHistory.length > 0) {
                updatedHistory[updatedHistory.length - 1] = {
                  ...updatedHistory[updatedHistory.length - 1],
                  messageId: newUserMessageId
                };
              }

              return prev.map((m, i) => {
                if (i === msgIdx) return { ...m, id: newUserMessageId, editHistory: updatedHistory, edit_group_id: editGroupId, reply_to_message_id: editParentId };
                if (m.id === streamingMessageId) return { ...m, sources, sourceChunks };
                return m;
              });
            });

            // Sync conversation graph for branch navigation
            setConversationMessages(prev => {
              const exists = prev.some(m => m.id === newUserMessageId);
              if (exists) return prev;
              return [
                ...prev,
                {
                  id: newUserMessageId,
                  role: 'user',
                  content: editContent,
                  created_at: new Date().toISOString(),
                  edit_group_id: editGroupId,
                  version_index: (meta.version_index || updatedUserMessage?.version_index || 1),
                  is_edited: 1,
                  reply_to_message_id: editParentId,
                }
              ];
            });
          } else {
            setMessages(prev => prev.map(msg =>
              msg.id === streamingMessageId
                ? { ...msg, sources, sourceChunks }
                : msg
            ));
          }
        },
        (data) => {
          const finalMessage = {
            id: data.assistant_message_id || streamingMessageId,
            role: 'assistant',
            content: data.full_response || streamedContent,
            sources,
            sourceChunks,
            timestamp: new Date().toISOString(),
            isStreaming: false,
            branchId: newBranchId,
          };

          setMessages(prev => {
            const msgIdx = prev.findIndex(m => m.id === messageId);
            if (msgIdx === -1) return prev.map(m => m.id === streamingMessageId ? finalMessage : m);

            const userMsg = prev[msgIdx];
            const updatedHistory = [...(userMsg.editHistory || [])];
            if (updatedHistory.length > 0) {
              updatedHistory[updatedHistory.length - 1] = {
                ...updatedHistory[updatedHistory.length - 1],
                followingMessages: [finalMessage]
              };
            }

            return prev.map((m, i) => {
              if (i === msgIdx) return { ...m, editHistory: updatedHistory };
              if (m.id === streamingMessageId) return finalMessage;
              return m;
            });
          });
          setIsStreaming(false);
          setAbortController(null);
          setActiveParentId(finalMessage.id);

          // Add assistant message to conversation graph
          setConversationMessages(prev => {
            const assistantId = finalMessage.id;
            const exists = prev.some(m => m.id === assistantId);
            if (exists) return prev;

            return [
              ...prev,
              {
                id: assistantId,
                role: 'assistant',
                content: finalMessage.content,
                created_at: new Date().toISOString(),
                reply_to_message_id: persistedEditedUserId || null,
              }
            ];
          });
        },
        (error) => {
          setMessages(prev => prev.map(msg =>
            msg.id === streamingMessageId
              ? { ...msg, content: `Error: ${error}`, isStreaming: false, isError: true }
              : msg
          ));
          setIsStreaming(false);
          setAbortController(null);
        },
        controller.signal,
        false,
        { edit_group_id: editGroupId },  // Pass edit options
        selectedCloudModel,
        editParentId
      );
    } catch (error) {
      console.error('Error in edit regenerate:', error);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setAbortController(null);
    }
  };

  // Navigate through edit history - switches between branches
  const navigateEditHistory = (messageId, direction) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg?.editHistory || msg.editHistory.length <= 1) return;

    const currentIndex = msg.editIndex ?? msg.editHistory.length - 1;
    let newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    newIndex = Math.max(0, Math.min(msg.editHistory.length - 1, newIndex));
    if (newIndex === currentIndex) return;

    const targetEntry = msg.editHistory[newIndex];
    if (!targetEntry?.messageId) return;
    if (!Array.isArray(conversationMessages) || conversationMessages.length === 0) return;

    const { normalizedMessages, lastAssistantId } = buildNormalizedBranchFromAllMessages(
      conversationMessages,
      targetEntry.messageId
    );
    setMessages(normalizedMessages);
    setActiveParentId(lastAssistantId);
  };

  const handleRegenerate = async () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage || isLoading) return;

    // Find and store the last assistant message index
    const lastAssistantIndex = messages.map(m => m.role).lastIndexOf('assistant');

    // Keep messages up to the last assistant (we'll replace it with streaming content)
    setIsLoading(true);
    setIsStreaming(true);
    setUserScrolledUp(false);

    // Create abort controller for regenerate
    const controller = new AbortController();
    setAbortController(controller);

    // Create a placeholder for streaming response
    const streamingMessageId = Date.now() + 1;
    let streamedContent = '';
    let sources = [];
    let sourceChunks = [];
    let hasReceivedFirstToken = false;
    const selectedCloudModel = currentLlmMode === 'api' ? cloudModel : null;

    // Replace the last assistant message with streaming placeholder
    if (lastAssistantIndex !== -1) {
      setMessages(prev => prev.map((msg, idx) =>
        idx === lastAssistantIndex
          ? {
            ...msg,
            id: streamingMessageId,
            content: '',
            sources: [],
            sourceChunks: [],
            isStreaming: true,
            isWaitingForFirstToken: true,
          }
          : msg
      ));
    } else {
      // No assistant message exists, add a new one
      setMessages(prev => [...prev, {
        id: streamingMessageId,
        role: 'assistant',
        content: '',
        sources: [],
        sourceChunks: [],
        timestamp: new Date().toISOString(),
        isStreaming: true,
        isWaitingForFirstToken: true,
      }]);
    }

    try {
      await sendMessageStream(
        conversationId,
        lastUserMessage.content,
        // onToken - update the message with each new token
        (token) => {
          if (!hasReceivedFirstToken) {
            hasReceivedFirstToken = true;
          }
          streamedContent += token;
          setMessages(prev => prev.map(msg =>
            msg.id === streamingMessageId
              ? { ...msg, content: streamedContent, isWaitingForFirstToken: false }
              : msg
          ));
        },
        // onMeta - receive sources at the start
        (meta) => {
          sources = meta.sources || [];
          sourceChunks = meta.source_chunks || [];
          setMessages(prev => prev.map(msg =>
            msg.id === streamingMessageId
              ? { ...msg, sources, sourceChunks }
              : msg
          ));
        },
        // onDone - finalize the message
        (data) => {
          setMessages(prev => prev.map(msg =>
            msg.id === streamingMessageId
              ? {
                ...msg,
                id: data.assistant_message_id || streamingMessageId,
                content: data.full_response || streamedContent,
                isStreaming: false,
                isWaitingForFirstToken: false
              }
              : msg
          ));
          setIsStreaming(false);
          setAbortController(null);
        },
        // onError
        (error) => {
          console.error('Regenerate streaming error:', error);
          setMessages(prev => prev.map(msg =>
            msg.id === streamingMessageId
              ? {
                ...msg,
                content: `Error: ${error}`,
                isStreaming: false,
                isError: true
              }
              : msg
          ));
          setIsStreaming(false);
          setAbortController(null);
        },
        controller.signal,
        true,
        null,
        selectedCloudModel
      );
    } catch (error) {
      console.error('Error regenerating response:', error);
      await loadConversation();
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setAbortController(null);
    }
  };

  // Handle source citation click
  const handleCitationClick = (source) => {
    const doc = documents.find(d => d.filename === source || d.filename?.includes(source));
    if (doc) {
      setPreviewFile(doc);
      setHighlightedContent(source);
    }
  };

  // Delete source with confirmation
  const handleDeleteSource = async (index) => {
    const docToDelete = documents[index];
    if (!docToDelete || !docToDelete.id) {
      // If no ID, just remove locally
      setDocuments(documents.filter((_, i) => i !== index));
      setShowDeleteSourceConfirm(null);
      return;
    }

    // If this is a note that was converted to source, just unconvert it (remove embeddings)
    // This keeps the original note but removes it from sources
    if (docToDelete.doc_type === 'note') {
      try {
        await unconvertNoteFromSource(conversationId, docToDelete.id);
        // Remove from documents (sources) list
        setDocuments(documents.filter((_, i) => i !== index));
        // Update notes to mark it as not converted (so it can be converted again)
        setNotes(prev => prev.map(n => n.id === docToDelete.id ? { ...n, convertedToSource: false, has_embeddings: false } : n));
      } catch (error) {
        console.error('Failed to unconvert note:', error);
        // Still remove from sources UI even if API fails
        setDocuments(documents.filter((_, i) => i !== index));
      }
      setShowDeleteSourceConfirm(null);
      return;
    }

    try {
      await deleteDocument(conversationId, docToDelete.id);
      setDocuments(documents.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Failed to delete document:', error);
      // Still remove from UI even if API fails
      setDocuments(documents.filter((_, i) => i !== index));
    }
    setShowDeleteSourceConfirm(null);
  };

  // Tooltip component - using inline style for z-index to ensure it's always on top
  const Tooltip = ({ children, text, side = 'right' }) => (
    <div className="relative group/tooltip" style={{ zIndex: 9999 }}>
      {children}
      <div
        className={`absolute ${side === 'right' ? 'left-full ml-3' : 'right-full mr-3'} top-1/2 -translate-y-1/2 
          px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap opacity-0 invisible pointer-events-none
          group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200
          ${isDark ? 'bg-gray-900 text-white border border-white/10' : 'bg-gray-900 text-white'} shadow-xl`}
        style={{ zIndex: 99999 }}
      >
        {text}
      </div>
    </div>
  );

  return (
    <div className={`flex h-full p-2 gap-2 ${theme.bg}`} style={{ overflow: 'visible' }}>
      {/* Left Panel Collapsed Bar */}
      {leftPanelCollapsed && (
        <div className={`relative z-[60] flex flex-col items-center py-3 px-1.5 ${theme.panelBg} rounded-2xl`}>
          <Tooltip text="Expand sources" side="right">
            <button
              onClick={() => setLeftPanelCollapsed(false)}
              className={`p-2 rounded-xl transition-all ${theme.hoverBg} ${theme.textSecondary} mb-2`}
            >
              <PanelLeft size={18} strokeWidth={2} />
            </button>
          </Tooltip>

          <div className={`w-6 h-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'} my-2`} />

          <Tooltip text="Add source" side="right">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`p-2 rounded-lg transition-all ${theme.hoverBg} ${theme.textSecondary} mb-1`}
            >
              <Plus size={18} strokeWidth={2} />
            </button>
          </Tooltip>

          <Tooltip text="Deep research" side="right">
            <button className={`p-2 rounded-lg transition-all ${theme.hoverBg} mb-1`}>
              <Sparkles size={18} strokeWidth={2} className="text-amber-500" />
            </button>
          </Tooltip>

          <Tooltip text="Web search" side="right">
            <button className={`p-2 rounded-lg transition-all ${theme.hoverBg} mb-1`}>
              <Globe size={18} strokeWidth={2} className="text-blue-500" />
            </button>
          </Tooltip>

          {documents.length > 0 && (
            <>
              <div className={`w-6 h-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'} my-2`} />
              <Tooltip text={`${documents.length} source${documents.length > 1 ? 's' : ''}`} side="right">
                <div className={`p-2 rounded-lg ${theme.textSecondary}`}>
                  <FileText size={18} strokeWidth={2} className="text-amber-500" />
                </div>
              </Tooltip>
            </>
          )}
        </div>
      )}

      {/* Left Panel - Sources */}
      <ResizablePanel
        width={sourcePreview ? 400 : leftPanelWidth}
        minWidth={sourcePreview ? 400 : 150}
        maxWidth={sourcePreview ? 500 : Math.max(150, Math.min(
          Math.floor(window.innerWidth * 0.35),
          window.innerWidth - (rightPanelCollapsed ? 48 : rightPanelWidth) - 450 - 32
        ))}
        onResize={sourcePreview ? () => { } : setLeftPanelWidth}
        side="left"
        isDark={isDark}
        collapsed={leftPanelCollapsed || mindMapCanvasMode}
      >
        <div className={`h-full flex flex-col ${theme.panelBg} backdrop-blur-xl rounded-2xl`}>
          {sourcePreview ? (
            /* Source Document Preview - Overlaps the Sources panel like notes editor */
            <>
              {/* Preview Header */}
              <div className={`flex items-center justify-between px-4 py-3 border-b ${theme.panelBorder}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => { setSourcePreview(null); setSourceHighlight(null); }}
                    className={`p-1.5 rounded-lg ${theme.hoverBg} ${theme.textSecondary}`}
                  >
                    <ChevronLeft size={18} strokeWidth={2} />
                  </button>
                  <div className={`p-1.5 rounded ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                    <FileText size={16} className={isDark ? 'text-blue-400' : 'text-blue-600'} strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${theme.text}`}>
                      {sourcePreview.filename || sourcePreview.name || 'Document'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setSourcePreview(null); setSourceHighlight(null); }}
                  className={`p-1.5 rounded-lg ${theme.hoverBg} ${theme.textSecondary}`}
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>

              {/* Source Content - Full document with highlighted chunk */}
              <div className={`flex-1 overflow-y-auto p-4 ${theme.text}`} id="source-content-container">
                {sourcePreview.content ? (
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {(() => {
                        const content = sourcePreview.content;

                        // If no highlight needed, show full content
                        if (!sourceHighlight) {
                          return <pre className="whitespace-pre-wrap text-sm leading-relaxed">{content}</pre>;
                        }

                        // Find the chunk to highlight
                        const searchTerm = sourceHighlight.toLowerCase().substring(0, 100);
                        let highlightIndex = content.toLowerCase().indexOf(searchTerm);

                        // Try to find any part of the highlight text if exact match not found
                        if (highlightIndex === -1) {
                          const words = sourceHighlight.split(/\s+/).filter(w => w.length > 4).slice(0, 5);
                          for (const word of words) {
                            const wordIndex = content.toLowerCase().indexOf(word.toLowerCase());
                            if (wordIndex !== -1) {
                              highlightIndex = wordIndex;
                              break;
                            }
                          }
                        }

                        // If still not found, just show full content
                        if (highlightIndex === -1) {
                          return <pre className="whitespace-pre-wrap text-sm leading-relaxed">{content}</pre>;
                        }

                        // Calculate highlight range (show the relevant chunk fully)
                        const highlightLength = Math.min(sourceHighlight.length, 500);
                        const highlightEnd = Math.min(highlightIndex + highlightLength, content.length);

                        // Auto-scroll to highlighted section after render
                        setTimeout(() => {
                          const highlightEl = document.getElementById('highlight-section');
                          if (highlightEl) {
                            highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }, 100);

                        return (
                          <>
                            {/* Content before highlight */}
                            {content.substring(0, highlightIndex)}
                            {/* Highlighted chunk */}
                            <mark
                              id="highlight-section"
                              className={`${isDark ? 'bg-yellow-500/40 text-yellow-100' : 'bg-yellow-200 text-yellow-900'} px-1 py-0.5 rounded`}
                            >
                              {content.substring(highlightIndex, highlightEnd)}
                            </mark>
                            {/* Content after highlight */}
                            {content.substring(highlightEnd)}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className={`w-12 h-12 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'} flex items-center justify-center mb-3`}>
                      <FileText size={24} className="opacity-40" />
                    </div>
                    <p className={`text-sm ${theme.textMuted}`}>Content not available</p>
                  </div>
                )}
              </div>


            </>
          ) : (
            /* Normal Sources List View */
            <>
              {/* Sources Header */}
              <div className={`flex items-center justify-between px-4 py-3 border-b ${theme.panelBorder}`}>
                <h2 className={`text-sm font-semibold tracking-wide uppercase ${theme.textSecondary}`}>Sources</h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-1.5 rounded-xl transition-all ${theme.hoverBg} ${theme.textSecondary}`}
                    title="Add source"
                  >
                    <Plus size={16} strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => setLeftPanelCollapsed(true)}
                    className={`p-1.5 rounded-xl transition-all ${theme.hoverBg} ${theme.textSecondary}`}
                    title="Collapse sources"
                  >
                    <PanelLeft size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Add Sources Button */}
              <div className="p-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-dashed
                ${isDark ? 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
                ${theme.textSecondary} transition-all text-sm`}
                >
                  <Upload size={16} strokeWidth={2} />
                  <span>Add sources</span>
                </button>
              </div>

              {/* Quick Actions */}
              <div className="px-3 space-y-1">
                <button className={`w-full flex items-center gap-2.5 py-2 px-3 rounded-lg ${theme.hoverBg} ${theme.textSecondary} transition-all text-sm`}>
                  <Sparkles size={16} className="text-amber-500" strokeWidth={2} />
                  <span>Deep research</span>
                </button>
                <button className={`w-full flex items-center gap-2.5 py-2 px-3 rounded-lg ${theme.hoverBg} ${theme.textSecondary} transition-all text-sm`}>
                  <Globe size={16} className="text-blue-500" strokeWidth={2} />
                  <span>Web search</span>
                </button>
              </div>

              {/* Documents List */}
              <div className="flex-1 overflow-y-auto p-3 mt-2">
                <div className="space-y-1.5">
                  {documents.length > 0 ? (
                    documents.map((doc, index) => (
                      <div
                        key={doc.id || index}
                        className={`group flex items-center gap-2.5 p-2.5 rounded-lg ${theme.cardBg} border ${theme.cardBorder} transition-all hover:border-blue-500/30 cursor-pointer ${sourcePreview?.id === doc.id ? 'ring-2 ring-blue-500 border-blue-500/30' : ''} ${doc.is_active === false ? 'opacity-50' : ''}`}
                        onClick={() => { setSourcePreview(doc); setSourceHighlight(null); }}
                      >
                        {/* Checkbox for active/inactive */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleDocument(doc.id, doc.is_active !== false);
                          }}
                          disabled={doc.isProcessing || processingDocIds.includes(doc.id)}
                          className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${doc.is_active !== false
                            ? 'bg-amber-500 border-amber-500'
                            : isDark ? 'border-gray-600 bg-transparent' : 'border-gray-300 bg-transparent'
                            } ${doc.isProcessing || processingDocIds.includes(doc.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={doc.is_active !== false ? 'Disable for queries' : 'Enable for queries'}
                        >
                          {doc.is_active !== false && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <div className={`p-1.5 rounded ${doc.doc_type === 'note' ? (isDark ? 'bg-amber-500/20' : 'bg-amber-100') : (isDark ? 'bg-blue-500/20' : 'bg-blue-100')} relative`}>
                          {doc.isProcessing || processingDocIds.includes(doc.id) ? (
                            <Loader2 size={14} className={`${isDark ? 'text-amber-400' : 'text-amber-600'} animate-spin`} strokeWidth={2} />
                          ) : doc.doc_type === 'note' ? (
                            <StickyNote size={14} className={isDark ? 'text-amber-400' : 'text-amber-600'} strokeWidth={2} />
                          ) : (
                            <FileText size={14} className={isDark ? 'text-blue-400' : 'text-blue-600'} strokeWidth={2} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${theme.text}`}>
                            {doc.filename || doc.original_filename || doc.name || doc.file_name || 'Document'}
                          </p>
                          <p className={`text-xs ${theme.textMuted}`}>
                            {doc.isProcessing || processingDocIds.includes(doc.id)
                              ? 'Converting...'
                              : doc.is_active === false
                                ? 'Disabled'
                                : doc.doc_type === 'note'
                                  ? 'From notes'
                                  : (doc.page_count ? `${doc.page_count} pages` : (doc.file_size ? `${Math.round(doc.file_size / 1024)} KB` : ''))}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteSourceConfirm(index);
                          }}
                          className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all ${theme.hoverBg}`}
                          title="Remove source"
                        >
                          <X size={14} className={theme.textMuted} strokeWidth={2} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className={`text-center py-10 ${theme.textMuted}`}>
                      <div className={`mx-auto w-12 h-12 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'} flex items-center justify-center mb-3`}>
                        <FileText size={24} className="opacity-40" />
                      </div>
                      <p className="text-sm font-medium">No sources added</p>
                      <p className="text-xs mt-1 opacity-70">Upload documents to get started</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className={`p-4 border-t ${theme.panelBorder}`}>
                  <p className={`text-xs font-medium mb-2 ${theme.textMuted}`}>Ready to upload:</p>
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className={`flex items-center gap-2 p-2 rounded-lg ${theme.cardBg}`}>
                        <File size={14} className="text-amber-500" />
                        <span className={`text-xs truncate flex-1 ${theme.text}`}>{file.name}</span>
                        <button
                          onClick={() => removeSelectedFile(index)}
                          className={`p-1 rounded ${theme.hoverBg}`}
                        >
                          <X size={14} className={theme.textMuted} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {/* Upload Button */}
                  <button
                    onClick={async () => {
                      if (selectedFiles.length === 0 || isUploading) return;
                      setIsUploading(true);
                      try {
                        if (conversationId) {
                          await addDocumentsToConversation(conversationId, selectedFiles);
                          await loadConversation();
                        } else {
                          const result = await uploadFiles(selectedFiles, 'New Chat');
                          if (result.conversation_id) {
                            onConversationUpdate?.(result.conversation_id);
                          }
                        }
                        setSelectedFiles([]);
                      } catch (error) {
                        console.error('Error uploading files:', error);
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                    disabled={isUploading}
                    className={`w-full mt-3 flex items-center justify-center gap-2 py-2 px-4 rounded-lg
                  ${theme.buttonPrimary} text-white text-sm font-medium transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isUploading ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload size={16} strokeWidth={2} /> Upload Files</>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </ResizablePanel>

      {/* Middle Panel - Chat */}
      <div
        className={`flex-1 flex flex-col min-w-0 relative z-10 ${theme.panelBg} rounded-2xl overflow-visible`}
        style={{ display: mindMapCanvasMode ? 'none' : 'flex' }}
      >
        {/* Chat Header */}
        <div className={`relative z-30 flex items-center justify-between px-5 py-3 border-b ${theme.panelBorder} backdrop-blur-xl`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-xl ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
              <MessageSquare size={16} className="text-amber-600" strokeWidth={2} />
            </div>
            {isEditingTitle ? (
              <input
                type="text"
                value={editTitleValue}
                onChange={(e) => setEditTitleValue(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') { setIsEditingTitle(false); setEditTitleValue(conversationTitle || 'New Chat'); }
                }}
                className={`text-sm font-semibold bg-transparent border-b-2 border-amber-500 outline-none px-1 ${theme.text}`}
                autoFocus
              />
            ) : (
              <button
                onClick={() => { setIsEditingTitle(true); setEditTitleValue(conversationTitle || 'New Chat'); }}
                className={`group flex items-center gap-1.5 text-sm font-semibold ${theme.text} hover:opacity-80 transition-all`}
                title="Click to rename"
              >
                <span>{conversationTitle || 'New Chat'}</span>
                <Pencil size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2">
            {/* Model Selector - Moved from Input Area */}
            {currentLlmMode === 'api' && (
              <div
                className="relative"
                onBlur={() => setTimeout(() => setShowModelMenu(false), 120)}
              >
                <button
                  type="button"
                  onClick={() => setShowModelMenu((open) => !open)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                    ${isDark
                      ? 'bg-white/10 text-gray-100 border-white/15 hover:bg-white/15'
                      : 'bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-100'}
                  `}
                >
                  <span>{cloudModel === 'groq' ? 'Groq' : 'Gemini'}</span>
                  <ChevronDown size={12} className={isDark ? 'text-gray-200' : 'text-amber-900'} strokeWidth={2} />
                </button>
                {showModelMenu && (
                  <div
                    className={`absolute top-full right-0 mt-2 min-w-[160px] rounded-2xl shadow-2xl border overflow-hidden z-[100]
                      ${isDark ? 'bg-[#1a1b1e] border-white/10' : 'bg-white border-amber-100'}`}
                  >
                    {[
                      { value: 'gemini', label: 'Gemini' },
                      { value: 'groq', label: 'Groq' },
                    ].map(({ value, label }) => {
                      const isActive = cloudModel === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            handleCloudModelChange(value);
                            setShowModelMenu(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between
                            ${isDark
                              ? isActive ? 'bg-white/10 text-white' : 'text-gray-200 hover:bg-white/5'
                              : isActive ? 'bg-amber-50 text-amber-900' : 'text-gray-800 hover:bg-amber-50'}
                          `}
                        >
                          <span>{label}</span>
                          {isActive && <span className={`text-[10px] ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>Active</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* LLM Mode Badge */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${currentLlmMode === 'local'
              ? isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'
              : isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
              }`}>
              {currentLlmMode === 'local' ? (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Local</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                  <span>Cloud</span>
                </>
              )}
            </div>
          </div>
        </div>




        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-6 relative z-10"
          style={{ overflowX: 'visible' }}
        >
          {
            messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-5 shadow-lg ${isDark ? 'shadow-amber-500/20' : 'shadow-amber-500/30'}`}>
                  <Sparkles size={26} className="text-white" strokeWidth={2} />
                </div>
                <h2 className={`text-lg font-semibold mb-2 ${theme.text}`}>How can I help you today?</h2>
                <p className={`text-center max-w-sm text-sm ${theme.textMuted}`}>
                  Ask me anything about your documents. I can help you analyze, summarize, and find information.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto relative z-20" style={{ overflow: 'visible' }}>
                {messages.map((message, msgIndex) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    style={{ overflow: 'visible' }}
                  >
                    {message.role === 'user' ? (
                      /* User Message - ChatGPT style with edit on hover */
                      <div className="relative group max-w-[85%]">
                        {editingMessageId === message.id ? (
                          /* Edit Mode */
                          <div className={`rounded-xl px-4 py-3 ${theme.userMessage} text-white`}>
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className={`w-full p-2.5 rounded-lg resize-none text-sm bg-white/10 text-white placeholder-white/50 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30`}
                              rows={3}
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end mt-2">
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-white"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleEditAndRegenerate(message.id)}
                                className="px-3 py-1.5 text-sm rounded-lg bg-white text-amber-600 hover:bg-white/90 font-medium"
                              >
                                Save & Submit
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Display Mode */
                          <div className={`rounded-xl px-4 py-3 ${theme.userMessage} text-white shadow-sm`}>
                            <p className="whitespace-pre-wrap">{message.content}</p>

                            {/* Edit History Navigation - Compact like ChatGPT */}
                            {message.editHistory && message.editHistory.length > 1 && (
                              <div className="flex items-center justify-end gap-1 mt-2 pt-1.5 border-t border-white/20">
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigateEditHistory(message.id, 'prev'); }}
                                  disabled={(message.editIndex ?? message.editHistory.length - 1) === 0}
                                  className="p-0.5 rounded hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <ChevronLeft size={12} />
                                </button>
                                <span className="text-[10px] opacity-70 min-w-[24px] text-center">
                                  {(message.editIndex ?? message.editHistory.length - 1) + 1}/{message.editHistory.length}
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigateEditHistory(message.id, 'next'); }}
                                  disabled={(message.editIndex ?? message.editHistory.length - 1) === message.editHistory.length - 1}
                                  className="p-0.5 rounded hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <ChevronRight size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Edit Icon on Hover - ChatGPT style */}
                        {editingMessageId !== message.id && (
                          <button
                            onClick={() => startEditing(message)}
                            className="absolute -left-10 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10"
                            title="Edit message"
                          >
                            <Edit2 size={14} className={theme.textMuted} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    ) : (
                      /* AI Response - New design with copy, speaker, inline citations */
                      <div className={`relative max-w-[85%] rounded-xl px-4 py-3 ${theme.assistantMessage} ${theme.text} border ${theme.cardBorder} shadow-sm ${message.isError ? 'border-red-500/50 bg-red-500/10' : ''}`} style={{ overflow: 'visible' }}>
                        {/* Show "Thinking..." when waiting for first token */}
                        {message.isWaitingForFirstToken ? (
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className={theme.textMuted}>Thinking...</span>
                          </div>
                        ) : (
                          <>
                            <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`} style={{ overflow: 'visible' }}>
                              <MarkdownRenderer
                                content={message.content}
                                isDark={isDark}
                                sources={message.sources || []}
                                sourceChunks={message.sourceChunks || []}
                                leftPanelCollapsed={leftPanelCollapsed}
                                onCitationClick={(source, chunkContent) => {
                                  const doc = documents.find(d => d.filename === source || d.filename?.includes(source.split('_page_')[0]));
                                  if (doc) {
                                    setLeftPanelCollapsed(false);
                                    setSourcePreview(doc);
                                    setSourceHighlight(chunkContent || source);
                                  }
                                }}
                              />
                            </div>
                            {/* Blinking cursor at the end of text while streaming */}
                            {message.isStreaming && !message.isWaitingForFirstToken && (
                              <span className="inline-block w-0.5 h-4 ml-0.5 bg-amber-500 animate-pulse" style={{ verticalAlign: 'baseline' }} />
                            )}
                          </>
                        )}

                        {/* Action Bar - Copy, Speaker, Regenerate - Hide during streaming */}
                        {!message.isStreaming && (
                          <div className={`flex items-center gap-1 mt-3 pt-2 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                            <button
                              onClick={() => handleCopyMessage(message.content, message.id)}
                              className={`p-1.5 rounded-md transition-all ${theme.hoverBg} ${theme.textMuted}`}
                              title="Copy response"
                            >
                              {copiedMessageId === message.id ? (
                                <Check size={14} className="text-green-500" strokeWidth={2} />
                              ) : (
                                <Copy size={14} strokeWidth={2} />
                              )}
                            </button>
                            <button
                              onClick={() => handleSpeak(message.content, message.id)}
                              className={`p-1.5 rounded-md transition-all ${theme.hoverBg} ${speakingMessageId === message.id ? 'text-amber-500' : theme.textMuted}`}
                              title={speakingMessageId === message.id ? "Stop speaking" : "Read aloud"}
                            >
                              <Volume2 size={14} strokeWidth={2} />
                            </button>
                            {/* Regenerate button only for last assistant message */}
                            {msgIndex === messages.length - 1 && (
                              <button
                                onClick={handleRegenerate}
                                disabled={isLoading}
                                className={`p-1.5 rounded-md transition-all ${theme.hoverBg} ${theme.textMuted} disabled:opacity-50`}
                                title="Regenerate response"
                              >
                                <RefreshCw size={14} strokeWidth={2} className={isLoading ? 'animate-spin' : ''} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading indicator - only show if no streaming message */}
                {isLoading && !messages.some(m => m.isStreaming) && (
                  <div className="flex justify-start">
                    <div className={`${theme.assistantMessage} ${theme.text} border ${theme.cardBorder} rounded-2xl px-4 py-3`}>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className={theme.textMuted}>Thinking</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )
          }

          {
            showScrollToBottom && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                <button
                  onClick={handleScrollToBottom}
                  className={`p-2 rounded-full shadow-lg transition-all hover:scale-110
                  ${isDark ? 'bg-white/10 hover:bg-white/20 border border-white/20' : 'bg-white hover:bg-gray-50 border border-gray-200'}
                  backdrop-blur-xl`}
                  title="Scroll to bottom"
                >
                  <ChevronDown size={20} className={theme.text} strokeWidth={2} />
                </button>
              </div>
            )
          }
        </div >

        {/* Input Area - Grid Layout for Adaptive Compact/Expanded State */}
        < div className="px-4 py-3 relative z-50" >
          <div className="max-w-3xl mx-auto">
            <div
              className={`grid gap-x-2 gap-y-2 items-end rounded-3xl border transition-all duration-200 ease-in-out ${isDark ? 'bg-white/[0.03] border-white/10 backdrop-blur-xl' : 'bg-white/70 border-amber-100/50 backdrop-blur-xl'
                }`}
              style={{
                gridTemplateColumns: 'auto 1fr auto',
                gridTemplateAreas: isExpanded
                  ? '"input input input" "left . right"'
                  : '"left input right"',
                padding: '0.5rem 0.75rem' // py-2 px-3 equivalent
              }}
            >
              {/* Left Actions Group */}
              <div style={{ gridArea: 'left' }} className="flex items-end gap-2 self-end">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-full transition-all shrink-0 ${theme.hoverBg} ${theme.textMuted}`}
                  title="Attach file"
                >
                  <Plus size={20} strokeWidth={2} />
                </button>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your documents..."
                className={`w-full resize-none bg-transparent outline-none py-2 px-2 overflow-y-auto text-sm leading-5 ${theme.text} placeholder:${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                rows={1}
                disabled={isLoading}
                style={{
                  gridArea: 'input',
                  minHeight: '36px',
                  maxHeight: '200px',
                  fieldSizing: 'content'  // Modern CSS auto-grow (Chrome 123+, Firefox 128+)
                }}
              />

              {/* Right Actions Group */}
              <div style={{ gridArea: 'right' }} className="flex items-end gap-1 self-end">
                <button
                  onClick={handleVoiceInput}
                  className={`p-2 rounded-full transition-all shrink-0 ${isRecording
                    ? 'animate-breathing ' + (isDark ? 'bg-red-500 text-white' : 'bg-red-600 text-white')
                    : theme.hoverBg + ' ' + theme.textMuted
                    }`}
                  title={isRecording ? 'Stop recording' : 'Start voice input'}
                >
                  <Mic size={20} strokeWidth={2} />
                </button>
                {isStreaming ? (
                  <button
                    onClick={handleStop}
                    className={`p-2 rounded-full transition-all shrink-0 ${isDark ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-red-600 text-white hover:bg-red-700'}`}
                    title="Stop generating"
                  >
                    <Square size={20} strokeWidth={2} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading || (!inputMessage.trim() && selectedFiles.length === 0)}
                    className={`p-2 rounded-full transition-all shrink-0 ${isDark ? 'bg-amber-500 text-white hover:bg-amber-400' : 'bg-amber-600 text-white hover:bg-amber-700'}
                      disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Send size={20} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
            <p className={`text-xs text-center mt-2 ${theme.textMuted} opacity-70`}>
              DocTalk may make mistakes. Please verify important information.
            </p>
          </div>
        </div >
      </div >

      {/* Right Panel Collapsed Bar */}
      {
        rightPanelCollapsed && (
          <div className={`relative z-[60] flex flex-col items-center py-3 px-1.5 ${theme.panelBg} rounded-2xl`}>
            <Tooltip text="Expand studio" side="left">
              <button
                onClick={() => setRightPanelCollapsed(false)}
                className={`p-2 rounded-xl transition-all ${theme.hoverBg} ${theme.textSecondary} mb-2`}
              >
                <PanelRight size={18} strokeWidth={2} />
              </button>
            </Tooltip>

            <div className={`w-6 h-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'} my-2`} />

            {studioTools.map((tool, index) => (
              <Tooltip key={index} text={tool.label} side="left">
                <button className={`p-2 rounded-xl transition-all ${theme.hoverBg} mb-1`}>
                  <tool.icon size={18} strokeWidth={1.5} className={tool.color} />
                </button>
              </Tooltip>
            ))}

            <div className={`w-6 h-px ${isDark ? 'bg-gray-700' : 'bg-gray-200'} my-2`} />

            <Tooltip text="Notes" side="left">
              <button
                onClick={() => { setRightPanelCollapsed(false); setShowNoteInput(true); }}
                className={`p-2 rounded-xl transition-all ${theme.hoverBg} ${theme.textSecondary} mb-1`}
              >
                <StickyNote size={18} strokeWidth={2} />
              </button>
            </Tooltip>

            <Tooltip text="Chat" side="left">
              <button className={`p-2 rounded-xl transition-all ${theme.hoverBg} ${theme.textSecondary}`}>
                <MessageSquare size={18} strokeWidth={2} />
              </button>
            </Tooltip>
          </div>
        )
      }

      {/* Right Panel - Studio */}
      <ResizablePanel
        width={showMindMap ? (mindMapCanvasMode ? window.innerWidth : Math.max(450, rightPanelWidth)) : (showNoteInput || showFlashcards) ? Math.max(editorFixedWidth, rightPanelWidth) : rightPanelWidth}
        minWidth={showMindMap ? 450 : (showNoteInput || showFlashcards) ? editorFixedWidth : 150}
        maxWidth={showMindMap ? (mindMapCanvasMode ? window.innerWidth : Math.max(450, window.innerWidth - (leftPanelCollapsed ? 80 : leftPanelWidth) - 450)) : (showNoteInput || showFlashcards) ? editorFixedWidth : Math.max(150, Math.min(
          Math.floor(window.innerWidth * 0.35),
          window.innerWidth - (leftPanelCollapsed ? 48 : leftPanelWidth) - 450 - 32
        ))}
        onResize={showMindMap && !mindMapCanvasMode ? setRightPanelWidth : (showNoteInput || showFlashcards) ? () => { } : setRightPanelWidth}
        side="right"
        isDark={isDark}
        collapsed={rightPanelCollapsed && !mindMapCanvasMode && !showMindMap}
      >
        <div className={`h-full flex flex-col ${mindMapCanvasMode ? '' : theme.panelBg + ' backdrop-blur-xl rounded-2xl'} ${mindMapCanvasMode ? 'overflow-hidden' : ''}`}>
          {/* Show Editor at TOP when note input is open - Hide everything else */}
          {showNoteInput ? (
            <div className="flex-1 flex flex-col h-full">
              {/* Editor Header with breadcrumb */}
              <div className={`flex items-center justify-between px-4 py-3 border-b ${theme.panelBorder}`}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowNoteInput(false);
                      setNoteContent('');
                      setNoteTitle('New Note');
                      setEditingNoteId(null);
                      setShowNoteMenu(false);
                    }}
                    className={`text-sm font-semibold tracking-wide uppercase ${theme.textSecondary} hover:text-amber-500 transition-colors`}
                  >
                    Studio
                  </button>
                  <ChevronRight size={14} className={theme.textMuted} />
                  <span className={`text-sm font-semibold ${theme.text}`}>Note</span>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowNoteMenu(!showNoteMenu)}
                    className={`p-1.5 rounded-md transition-all ${theme.hoverBg} ${theme.textMuted}`}
                  >
                    <MoreVertical size={16} strokeWidth={2} />
                  </button>
                  {showNoteMenu && (
                    <div className={`absolute top-full right-0 mt-1 w-52 rounded-lg shadow-xl border ${isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200'} py-1 z-50`}>
                      <button
                        onClick={async () => {
                          setShowNoteMenu(false);
                          // First save the note if it's new
                          if (!editingNoteId && noteContent.trim() && noteTitle.trim()) {
                            const newNote = await addNote();
                            if (newNote && newNote.id) {
                              await handleConvertNoteToSource(newNote.id);
                            }
                          } else if (editingNoteId) {
                            // Update existing note first, then convert
                            try {
                              await updateNote(conversationId, editingNoteId, noteTitle, noteContent);
                              await handleConvertNoteToSource(editingNoteId);
                            } catch (err) {
                              console.error('Failed to convert note to source:', err);
                            }
                          }
                        }}
                        disabled={processingNoteId !== null}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${theme.hoverBg} ${theme.textSecondary} ${processingNoteId !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {processingNoteId ? (
                          <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                        ) : (
                          <FileUp size={16} strokeWidth={2} />
                        )}
                        <span>Convert to source</span>
                      </button>
                      <button
                        onClick={async () => {
                          setShowNoteMenu(false);
                          if (notes.length > 0) {
                            for (const note of notes) {
                              if (!note.convertedToSource) {
                                await handleConvertNoteToSource(note.id);
                              }
                            }
                          }
                        }}
                        disabled={processingNoteId !== null}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${theme.hoverBg} ${theme.textSecondary} ${processingNoteId !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {processingNoteId ? (
                          <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                        ) : (
                          <FileUp size={16} strokeWidth={2} />
                        )}
                        <span>Convert all notes to source</span>
                      </button>
                      <div className={`my-1 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`} />
                      <button
                        onClick={() => {
                          setShowNoteMenu(false);
                          if (editingNoteId) {
                            setShowDeleteConfirm(editingNoteId);
                          } else {
                            setShowNoteInput(false);
                            setNoteContent('');
                            setNoteTitle('New Note');
                            setEditingNoteId(null);
                          }
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${theme.hoverBg} text-red-400`}
                      >
                        <Trash size={16} strokeWidth={2} />
                        <span>{editingNoteId ? 'Delete note' : 'Discard'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Note Title */}
              <div className={`px-4 py-3 border-b ${theme.panelBorder}`}>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Note title..."
                  className={`w-full text-lg font-semibold bg-transparent outline-none ${theme.text}`}
                />
              </div>

              {/* Toolbar */}
              <div className={`flex items-center gap-1 px-4 py-2 border-b ${theme.panelBorder} flex-wrap`}>
                <button
                  onClick={() => document.execCommand('undo')}
                  className={`p-1.5 rounded-md transition-all ${theme.hoverBg} ${theme.textMuted}`}
                  title="Undo"
                >
                  <Undo2 size={16} strokeWidth={2} />
                </button>
                <button
                  onClick={() => document.execCommand('redo')}
                  className={`p-1.5 rounded-md transition-all ${theme.hoverBg} ${theme.textMuted}`}
                  title="Redo"
                >
                  <Redo2 size={16} strokeWidth={2} />
                </button>

                <div className={`w-px h-5 mx-1 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />

                {/* Format Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowFormatDropdown(!showFormatDropdown)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${theme.hoverBg} ${theme.textSecondary} text-xs`}
                  >
                    <span>{selectedFormat}</span>
                    <ChevronDown size={12} />
                  </button>
                  {showFormatDropdown && (
                    <div className={`absolute top-full left-0 mt-1 w-28 rounded-lg shadow-xl border ${isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200'} py-1 z-50`}>
                      {['Normal', 'Heading 1', 'Heading 2', 'Heading 3'].map((format) => (
                        <button
                          key={format}
                          onClick={() => {
                            setSelectedFormat(format);
                            setShowFormatDropdown(false);
                            noteEditorRef.current?.focus();
                            if (format === 'Normal') document.execCommand('formatBlock', false, 'p');
                            else if (format === 'Heading 1') document.execCommand('formatBlock', false, 'h1');
                            else if (format === 'Heading 2') document.execCommand('formatBlock', false, 'h2');
                            else if (format === 'Heading 3') document.execCommand('formatBlock', false, 'h3');
                          }}
                          className={`w-full px-3 py-1.5 text-left text-xs ${theme.hoverBg} ${selectedFormat === format ? 'text-amber-500' : theme.textSecondary}`}
                        >
                          {format}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`w-px h-5 mx-1 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />

                <button
                  onClick={() => { noteEditorRef.current?.focus(); document.execCommand('bold'); }}
                  className={`p-1.5 rounded-md transition-all ${theme.hoverBg} ${theme.textMuted}`}
                  title="Bold"
                >
                  <Bold size={16} strokeWidth={2} />
                </button>
                <button
                  onClick={() => { noteEditorRef.current?.focus(); document.execCommand('italic'); }}
                  className={`p-1.5 rounded-md transition-all ${theme.hoverBg} ${theme.textMuted}`}
                  title="Italic"
                >
                  <Italic size={16} strokeWidth={2} />
                </button>
                <button
                  onClick={() => {
                    const url = prompt('Enter URL:');
                    if (url) { noteEditorRef.current?.focus(); document.execCommand('createLink', false, url); }
                  }}
                  className={`p-1.5 rounded-md transition-all ${theme.hoverBg} ${theme.textMuted}`}
                  title="Insert Link"
                >
                  <Link2 size={16} strokeWidth={2} />
                </button>

                <div className={`w-px h-5 mx-1 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />

                <button
                  onClick={() => { noteEditorRef.current?.focus(); document.execCommand('insertUnorderedList'); }}
                  className={`p-1.5 rounded-md transition-all ${theme.hoverBg} ${theme.textMuted}`}
                  title="Bullet List"
                >
                  <List size={16} strokeWidth={2} />
                </button>
                <button
                  onClick={() => { noteEditorRef.current?.focus(); document.execCommand('insertOrderedList'); }}
                  className={`p-1.5 rounded-md transition-all ${theme.hoverBg} ${theme.textMuted}`}
                  title="Numbered List"
                >
                  <ListOrdered size={16} strokeWidth={2} />
                </button>

                <div className={`w-px h-5 mx-1 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`} />

                <button
                  onClick={() => { noteEditorRef.current?.focus(); document.execCommand('removeFormat'); }}
                  className={`p-1.5 rounded-md transition-all ${theme.hoverBg} text-red-400`}
                  title="Clear Formatting"
                >
                  <RemoveFormatting size={16} strokeWidth={2} />
                </button>
              </div>

              {/* Editor Content */}
              <div
                ref={noteEditorRef}
                contentEditable
                suppressContentEditableWarning={true}
                className={`flex-1 p-4 outline-none overflow-y-auto text-sm ${theme.text}`}
                style={{ direction: 'ltr', unicodeBidi: 'plaintext' }}
                onInput={(e) => setNoteContent(e.currentTarget.innerHTML)}
                data-placeholder="Start typing your note..."
              />

              {/* Footer Actions */}
              <div className={`flex justify-end items-center gap-2 px-4 py-3 border-t ${theme.panelBorder}`}>
                <button
                  onClick={() => {
                    setShowNoteInput(false);
                    setNoteContent('');
                    setNoteTitle('New Note');
                    setEditingNoteId(null);
                    setShowNoteMenu(false);
                  }}
                  className={`px-4 py-2 text-sm rounded-lg ${theme.hoverBg} ${theme.textSecondary}`}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (noteContent.trim() || noteTitle.trim()) {
                      if (editingNoteId) {
                        try {
                          await updateNote(conversationId, editingNoteId, noteTitle, noteContent);
                          setNotes(prev => {
                            const updated = prev.map(n => n.id === editingNoteId ? { ...n, title: noteTitle, content: noteContent } : n);
                            localStorage.setItem(`notes_${conversationId}`, JSON.stringify(updated));
                            return updated;
                          });
                        } catch (err) {
                          console.error('Failed to update note:', err);
                          setNotes(prev => {
                            const updated = prev.map(n => n.id === editingNoteId ? { ...n, title: noteTitle, content: noteContent } : n);
                            localStorage.setItem(`notes_${conversationId}`, JSON.stringify(updated));
                            return updated;
                          });
                        }
                      } else {
                        // Create new note
                        await addNote();
                        return; // addNote already handles cleanup
                      }
                      setShowNoteInput(false);
                      setNoteContent('');
                      setNoteTitle('New Note');
                      setEditingNoteId(null);
                      setShowNoteMenu(false);
                    }
                  }}
                  className={`px-4 py-2 text-sm rounded-lg ${theme.buttonPrimary} text-white`}
                >
                  {editingNoteId ? 'Update' : 'Save Note'}
                </button>
              </div>
            </div>
          ) : (
            /* Normal Studio View when editor is closed */
            <>
              {/* Studio Header - hide in fullscreen mode */}
              <div
                className={`flex items-center justify-between px-4 py-3 border-b ${theme.panelBorder}`}
                style={{ display: mindMapCanvasMode ? 'none' : 'flex' }}
              >
                {showMindMap ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCloseMindMap}
                      className={`text-sm font-semibold tracking-wide uppercase ${theme.textSecondary} hover:text-amber-500 transition-colors`}
                    >
                      Studio
                    </button>
                    <ChevronRight size={14} className={theme.textMuted} />
                    <span className={`text-sm font-semibold ${theme.text}`}>Mindmap</span>
                  </div>
                ) : showFlashcards ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCloseFlashcards}
                      className={`text-sm font-semibold tracking-wide uppercase ${theme.textSecondary} hover:text-amber-500 transition-colors`}
                    >
                      Studio
                    </button>
                    <ChevronRight size={14} className={theme.textMuted} />
                    <span className={`text-sm font-semibold ${theme.text}`}>Flashcards</span>
                    {flashcards.length > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                        {flashcards.length}
                      </span>
                    )}
                  </div>
                ) : (
                  <h2 className={`text-sm font-semibold tracking-wide uppercase ${theme.textSecondary}`}>Studio</h2>
                )}
                <div className="flex items-center gap-1">
                  {showMindMap && (
                    <>
                      <button
                        onClick={() => setMindMapCanvasMode(!mindMapCanvasMode)}
                        className={`p-1.5 rounded-xl transition-all ${theme.hoverBg} ${theme.textSecondary}`}
                        title={mindMapCanvasMode ? "Exit fullscreen" : "Fullscreen"}
                      >
                        {mindMapCanvasMode ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                          </svg>
                        )}
                      </button>
                    </>
                  )}
                  <button
                    onClick={showMindMap ? handleCloseMindMap : (showFlashcards ? handleCloseFlashcards : () => setRightPanelCollapsed(true))}
                    className={`p-1.5 rounded-xl transition-all ${theme.hoverBg} ${theme.textSecondary}`}
                    title={(showMindMap || showFlashcards) ? "Close" : "Collapse studio"}
                  >
                    {(showMindMap || showFlashcards) ? <X size={16} strokeWidth={2} /> : <PanelRight size={16} strokeWidth={2} />}
                  </button>
                </div>
              </div>

              {/* Studio Tools Grid / Flashcard View / Mind Map View */}
              <div className={`${showMindMap && mindMapCanvasMode ? 'p-0' : 'p-3'} flex-1 ${showMindMap && mindMapCanvasMode ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                {showMindMap ? (
                  /* Mind Map View */
                  <div
                    className="flex flex-col w-full"
                    style={{
                      minHeight: mindMapCanvasMode ? 'calc(100vh - 48px)' : '500px',
                      height: mindMapCanvasMode ? 'calc(100vh - 48px)' : '100%'
                    }}
                  >
                    {mindMapLoading ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <Loader2 size={40} className={`animate-spin ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                        <p className={`text-sm ${theme.textMuted}`}>Generating mind map...</p>
                      </div>
                    ) : mindMapData ? (
                      <MindMapCanvas
                        mindMapData={mindMapData}
                        expandedNodes={expandedNodes}
                        onNodeToggle={handleMindMapNodeToggle}
                        onNodeClick={handleMindMapNodeClick}
                        isDark={isDark}
                        zoom={mindMapZoom}
                        setZoom={setMindMapZoom}
                        pan={mindMapPan}
                        setPan={setMindMapPan}
                        conversationId={conversationId}
                        isFullscreen={mindMapCanvasMode}
                        onExitFullscreen={() => setMindMapCanvasMode(false)}
                      />
                    ) : (
                      <div className={`flex-1 flex flex-col items-center justify-center gap-3 ${theme.textMuted}`}>
                        <Brain size={32} strokeWidth={1.5} />
                        <p className="text-sm">No mind map yet</p>
                        <button
                          onClick={handleGenerateMindMap}
                          disabled={mindMapLoading}
                          className={`mt-2 px-4 py-2 rounded-lg text-sm ${theme.buttonPrimary} text-white flex items-center gap-2`}
                        >
                          <Sparkles size={14} />
                          Generate Mind Map
                        </button>
                      </div>
                    )}
                  </div>
                ) : showFlashcards ? (
                  /* Flashcard View - Carousel Style */
                  <div className="flex flex-col h-full">
                    {flashcardsLoading ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <Loader2 size={40} className={`animate-spin ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                        <p className={`text-sm ${theme.textMuted}`}>Generating flashcards...</p>
                      </div>
                    ) : flashcards.length > 0 ? (
                      <div className="flex-1 flex flex-col">
                        {/* Card Container */}
                        <div className="flex-1 flex items-center justify-center relative px-8">
                          {/* Left Arrow */}
                          <button
                            onClick={handlePrevCard}
                            disabled={currentCardIndex === 0}
                            className={`absolute left-0 p-2 rounded-full transition-all ${currentCardIndex === 0
                              ? 'opacity-30 cursor-not-allowed'
                              : `${theme.hoverBg} hover:scale-110`
                              } ${isDark ? 'text-white' : 'text-gray-700'}`}
                          >
                            <ChevronLeft size={24} />
                          </button>

                          {/* Centered Card with depth and polish */}
                          <div
                            className={`w-full max-w-[280px] min-h-[220px] rounded-2xl p-5 flex flex-col justify-between relative transition-all duration-300 ${isDark
                              ? 'bg-gradient-to-br from-gray-800 via-gray-800/95 to-gray-900'
                              : 'bg-gradient-to-br from-white via-gray-50 to-gray-100'
                              }`}
                            style={{
                              boxShadow: isDark
                                ? '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
                                : '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
                              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)'
                            }}
                          >
                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteFlashcard(flashcards[currentCardIndex]?.id)}
                              className={`absolute top-3 right-3 p-1.5 rounded-full opacity-40 hover:opacity-100 transition-all ${isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-100 text-red-500'
                                }`}
                              title="Delete card"
                            >
                              <Trash2 size={14} />
                            </button>

                            {/* Card Content */}
                            <div className="flex-1 flex items-center justify-center text-center px-3 py-4">
                              <p className={`text-lg font-medium leading-relaxed ${theme.text}`}>
                                {showAnswer ? flashcards[currentCardIndex]?.back : flashcards[currentCardIndex]?.front}
                              </p>
                            </div>

                            {/* See Answer / See Question Button */}
                            <button
                              onClick={() => setShowAnswer(!showAnswer)}
                              className={`w-full py-2.5 text-sm font-medium rounded-xl transition-all ${isDark
                                ? 'text-gray-400 hover:text-amber-400 hover:bg-white/5'
                                : 'text-gray-500 hover:text-amber-600 hover:bg-gray-100'
                                }`}
                            >
                              {showAnswer ? 'See question' : 'See answer'}
                            </button>
                          </div>

                          {/* Right Arrow */}
                          <button
                            onClick={handleNextCard}
                            disabled={currentCardIndex === flashcards.length - 1}
                            className={`absolute right-0 p-2 rounded-full transition-all ${currentCardIndex === flashcards.length - 1
                              ? 'opacity-30 cursor-not-allowed'
                              : `${theme.hoverBg} hover:scale-110`
                              } ${isDark ? 'text-white' : 'text-gray-700'}`}
                          >
                            <ChevronRight size={24} />
                          </button>
                        </div>

                        {/* Bottom Section */}
                        <div className="mt-4 space-y-3">
                          {/* Explain Button */}
                          {showAnswer && (
                            <button
                              onClick={() => handleExplainCard(flashcards[currentCardIndex]?.front)}
                              className={`w-full py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${isDark ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                }`}
                            >
                              <MessageSquare size={14} />
                              Explain this
                            </button>
                          )}

                          {/* Progress */}
                          <div className="flex items-center gap-3">
                            <button
                              onClick={handleGenerateFlashcards}
                              disabled={flashcardsLoading}
                              className={`p-2 rounded-lg ${theme.hoverBg} ${theme.textMuted}`}
                              title="Generate more cards"
                            >
                              <RefreshCw size={16} className={flashcardsLoading ? 'animate-spin' : ''} />
                            </button>
                            <div className="flex-1 h-1.5 rounded-full bg-gray-700/30 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${isDark ? 'bg-amber-400' : 'bg-amber-500'}`}
                                style={{ width: `${((currentCardIndex + 1) / flashcards.length) * 100}%` }}
                              />
                            </div>
                            <span className={`text-xs ${theme.textMuted} whitespace-nowrap`}>
                              {currentCardIndex + 1} / {flashcards.length} cards
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex-1 flex flex-col items-center justify-center gap-3 ${theme.textMuted}`}>
                        <BookOpen size={32} strokeWidth={1.5} />
                        <p className="text-sm">No flashcards yet</p>
                        <button
                          onClick={handleGenerateFlashcards}
                          disabled={flashcardsLoading}
                          className={`mt-2 px-4 py-2 rounded-lg text-sm ${theme.buttonPrimary} text-white flex items-center gap-2`}
                        >
                          <Sparkles size={14} />
                          Generate Flashcards
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Normal Studio Tools Grid */
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {studioTools.map((tool, index) => (
                        <button
                          key={index}
                          onClick={() => handleStudioToolClick(tool.label)}
                          className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border
                            ${theme.cardBg} ${theme.cardBorder} ${theme.hoverBg} transition-all hover:scale-[1.02]
                            ${tool.label === 'Flashcards' && flashcards.length > 0 ? (isDark ? 'ring-1 ring-pink-500/50' : 'ring-1 ring-pink-400/50') : ''}
                            ${tool.label === 'Mind Map' && mindMapData ? (isDark ? 'ring-1 ring-emerald-500/50' : 'ring-1 ring-emerald-400/50') : ''}`}
                        >
                          <tool.icon size={20} className={tool.color} strokeWidth={1.5} />
                          <span className={`text-xs text-center ${theme.textSecondary}`}>
                            {tool.label}
                            {tool.label === 'Flashcards' && flashcards.length > 0 && (
                              <span className={`ml-1 px-1 rounded text-[10px] ${isDark ? 'bg-pink-500/20 text-pink-400' : 'bg-pink-100 text-pink-600'}`}>
                                {flashcards.length}
                              </span>
                            )}
                            {tool.label === 'Mind Map' && mindMapData && (
                              <span className={`ml-1 px-1 rounded text-[10px] ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                                ✓
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Notes Section */}
                    <div className="mt-5">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-xs font-semibold tracking-wide uppercase ${theme.textSecondary}`}>Notes</h3>
                        <button
                          onClick={() => {
                            setShowNoteInput(true);
                            setNoteTitle('New Note');
                            setNoteContent('');
                            setEditingNoteId(null);
                          }}
                          className={`p-1 rounded-md transition-all ${theme.hoverBg} ${theme.textMuted}`}
                        >
                          <Plus size={14} strokeWidth={2} />
                        </button>
                      </div>

                      {/* Notes List */}
                      <div className="space-y-1.5">
                        {notes.length > 0 ? (
                          notes.map((note) => (
                            <div
                              key={note.id}
                              onClick={() => {
                                if (showNoteItemMenu !== note.id) {
                                  setEditingNoteId(note.id);
                                  setNoteTitle(note.title);
                                  setNoteContent(note.content);
                                  setShowNoteInput(true);
                                }
                              }}
                              className={`group relative p-3 rounded-lg border ${theme.cardBorder} ${theme.cardBg} cursor-pointer hover:border-amber-500/30 transition-all`}
                            >
                              {/* Three dots menu button */}
                              <div className="absolute top-2 right-2" data-note-menu>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowNoteItemMenu(showNoteItemMenu === note.id ? null : note.id);
                                  }}
                                  className={`p-1.5 rounded-md opacity-0 group-hover:opacity-100 ${showNoteItemMenu === note.id ? 'opacity-100' : ''} transition-all ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                                >
                                  <MoreVertical size={14} className={theme.textMuted} strokeWidth={2} />
                                </button>
                                {/* Dropdown menu */}
                                {showNoteItemMenu === note.id && (
                                  <div
                                    data-note-menu
                                    className={`absolute top-full right-0 mt-1 w-48 rounded-xl shadow-2xl border overflow-hidden
                              ${isDark ? 'bg-[#252525] border-white/10' : 'bg-white border-gray-200'}`}
                                    style={{ zIndex: 100 }}
                                  >
                                    {/* Convert to source - always creates new source */}
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setShowNoteItemMenu(null);
                                        await handleConvertNoteToSource(note.id);
                                      }}
                                      disabled={processingNoteId !== null}
                                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm whitespace-nowrap transition-colors
                                ${isDark ? 'hover:bg-white/5 text-gray-300' : 'hover:bg-gray-50 text-gray-700'}
                                ${processingNoteId === note.id ? 'opacity-50' : ''}`}
                                    >
                                      {processingNoteId === note.id ? (
                                        <Loader2 size={16} strokeWidth={2} className="flex-shrink-0 animate-spin" />
                                      ) : (
                                        <FileUp size={16} strokeWidth={2} className={`flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                                      )}
                                      <span>Convert to source</span>
                                    </button>
                                    {/* Delete */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowNoteItemMenu(null);
                                        setShowDeleteConfirm(note.id);
                                      }}
                                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-t
                                ${isDark ? 'border-white/5 hover:bg-white/5 text-red-400' : 'border-gray-100 hover:bg-red-50 text-red-500'}`}
                                    >
                                      <Trash size={16} strokeWidth={2} />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mb-1 pr-6">
                                <h4 className={`text-sm font-medium ${theme.text}`}>{note.title}</h4>
                              </div>
                              <div className={`text-xs ${theme.textMuted} line-clamp-2`} dangerouslySetInnerHTML={{ __html: note.content }} />
                            </div>
                          ))
                        ) : (
                          <button
                            onClick={() => {
                              setShowNoteInput(true);
                              setNoteTitle('New Note');
                              setNoteContent('');
                            }}
                            className={`w-full flex items-center justify-center gap-2 py-3 px-3 rounded-lg border border-dashed
                      ${isDark ? 'border-gray-700 hover:border-amber-500/30 hover:bg-white/5' : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50/50'}
                      ${theme.textMuted} transition-all text-sm`}
                          >
                            <StickyNote size={14} strokeWidth={2} />
                            <span>Add note</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Delete Confirmation Modal */}
              {showDeleteConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <div className={`w-full max-w-sm mx-4 rounded-2xl shadow-2xl ${isDark ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white border border-gray-200'} p-6`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-full bg-red-500/10">
                        <AlertTriangle size={24} className="text-red-500" />
                      </div>
                      <h3 className={`text-lg font-semibold ${theme.text}`}>Delete Note?</h3>
                    </div>
                    <p className={`mb-6 ${theme.textSecondary}`}>Are you sure you want to delete this note? This action cannot be undone.</p>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className={`px-4 py-2 rounded-lg ${theme.hoverBg} ${theme.textSecondary}`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          deleteNote(showDeleteConfirm);
                          setShowDeleteConfirm(null);
                          setShowNoteInput(false);
                          setNoteContent('');
                          setNoteTitle('New Note');
                          setEditingNoteId(null);
                        }}
                        className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ResizablePanel>

      {/* Delete Source Confirmation Modal - Outside panels for proper z-index */}
      {
        showDeleteSourceConfirm !== null && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className={`w-full max-w-sm mx-4 rounded-2xl shadow-2xl ${isDark ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white border border-gray-200'} p-6`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-red-500/10">
                  <AlertTriangle size={24} className="text-red-500" />
                </div>
                <h3 className={`text-lg font-semibold ${theme.text}`}>Remove Source?</h3>
              </div>
              <p className={`mb-6 ${theme.textSecondary}`}>
                Are you sure you want to remove "{documents[showDeleteSourceConfirm]?.filename || 'this document'}" from sources?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteSourceConfirm(null)}
                  className={`px-4 py-2 rounded-lg ${theme.hoverBg} ${theme.textSecondary}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteSource(showDeleteSourceConfirm)}
                  className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.md"
      />
    </div >
  );
};

export default ChatInterface;
