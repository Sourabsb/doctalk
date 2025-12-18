import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, Mic, MicOff, Paperclip, MoreVertical, Edit2, Trash2, Copy, Check,
  ChevronLeft, ChevronRight, Plus, FileText, Search, Globe, Headphones,
  Video, Brain, FileBarChart, BookOpen, HelpCircle, Image, Presentation,
  StickyNote, X, Upload, File, Sparkles, MessageSquare, Volume2,
  PanelLeft, PanelRight, Pencil, Undo2, Redo2, Bold, Italic, Link2, List, ListOrdered, RemoveFormatting, ChevronDown, FileUp, Trash, AlertTriangle, RefreshCw, Loader2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getConversation, sendMessage, uploadFiles, addDocumentsToConversation, editMessage, deleteMessage as deleteMessageApi, deleteDocument, createNote, updateNote, convertNoteToSource, toggleDocument } from '../utils/api';

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
const InlineCitation = ({ number, source, chunkContent, isDark, onCitationClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setShowTooltip(false);
    onCitationClick(source, chunkContent);
  };
  
  return (
    <span 
      className="relative inline"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={handleClick}
        className={`inline-flex items-center justify-center min-w-[16px] h-[16px] mx-0.5 text-[10px] font-bold rounded cursor-pointer
          ${isDark ? 'bg-amber-500/30 text-amber-300 hover:bg-amber-500/50' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}
          transition-colors`}
        style={{ 
          verticalAlign: 'middle', 
          lineHeight: 1,
          padding: '0 4px'
        }}
      >
        {number}
      </button>
      {/* Simple tooltip on hover - NotebookLM style */}
      {showTooltip && chunkContent && (
        <div 
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`absolute z-[99999] p-3 rounded-lg text-xs w-80 shadow-2xl
            ${isDark ? 'bg-[#2a2a2a] text-gray-200 border border-white/10' : 'bg-white text-gray-800 border border-gray-200'}`}
          style={{ 
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px'
          }}
        >
          {/* Arrow */}
          <div 
            className={`absolute w-3 h-3 rotate-45 ${isDark ? 'bg-[#2a2a2a] border-r border-b border-white/10' : 'bg-white border-r border-b border-gray-200'}`}
            style={{
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)'
            }}
          />
          <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
            <FileText size={12} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
            <span className={`font-medium text-[11px] truncate ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              {source}
            </span>
          </div>
          <div 
            className={`leading-relaxed text-[11px] max-h-48 overflow-y-auto custom-scrollbar ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
            style={{ wordBreak: 'break-word' }}
          >
            {chunkContent}
          </div>
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
const MarkdownRenderer = ({ content, isDark, sources = [], sourceContents = {}, onCitationClick }) => {
  const [copiedCode, setCopiedCode] = useState(null);

  const copyToClipboard = async (code, index) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(index);
    setTimeout(() => setCopiedCode(null), 2000);
  };
  
  // Process text to add inline citations where sources are referenced in the AI response
  const processTextWithCitations = (text, children) => {
    if (!sources || sources.length === 0 || typeof text !== 'string') {
      return children;
    }
    
    const parts = [];
    let lastIndex = 0;
    let hasMatchedCitation = false;
    
    // Build a regex to match source file names in various formats
    // Match: `source.pdf`, [source.pdf], "source.pdf", source.pdf, source.pdf_page_1, etc.
    const sourcePatterns = sources.map((source, idx) => {
      const baseName = source.replace(/\.[^.]+$/, ''); // Remove extension
      // Also handle _page_X suffix
      const baseNameNoPage = baseName.replace(/_page_\d+$/, '');
      
      const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedBaseNameNoPage = baseNameNoPage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      return { 
        source, 
        idx, 
        // Match various patterns including backticks, brackets, quotes
        regex: new RegExp(
          `(\`${escapedSource}\`|\`${escapedBaseName}\`|\`${escapedBaseNameNoPage}[^)\`]*\`|` +
          `\\[${escapedSource}\\]|\\[${escapedBaseName}\\]|` +
          `"${escapedSource}"|"${escapedBaseName}"|` +
          `${escapedSource}|${escapedBaseName})(?![\\w])`, 
          'gi'
        )
      };
    });
    
    // Find all matches and their positions
    const allMatches = [];
    sourcePatterns.forEach(({ source, idx, regex }) => {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        allMatches.push({
          index: match.index,
          length: match[0].length,
          sourceIdx: idx,
          source: source,
          matchText: match[0]
        });
      }
    });
    
    // Sort by position
    allMatches.sort((a, b) => a.index - b.index);
    
    // Remove overlapping matches (keep first occurrence)
    const filteredMatches = [];
    let lastEnd = 0;
    for (const match of allMatches) {
      if (match.index >= lastEnd) {
        filteredMatches.push(match);
        lastEnd = match.index + match.length;
      }
    }
    
    // Build result with citation components
    for (const match of filteredMatches) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      // Add inline citation after the source mention
      parts.push(match.matchText);
      parts.push(
        <InlineCitation 
          key={`cite-${match.index}`}
          number={match.sourceIdx + 1}
          source={match.source}
          chunkContent={sourceContents[match.source] || ''}
          isDark={isDark}
          onCitationClick={onCitationClick}
        />
      );
      
      lastIndex = match.index + match.length;
      hasMatchedCitation = true;
    }
    
    // Add remaining text
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
          // Check if inline code is a source reference
          const codeText = String(children);
          const matchedSourceIdx = sources.findIndex(s => {
            const baseName = s.replace(/\.[^.]+$/, '');
            const baseNameNoPage = baseName.replace(/_page_\d+$/, '');
            return codeText.includes(s) || codeText.includes(baseName) || 
                   s.includes(codeText) || baseName.includes(codeText) ||
                   codeText.toLowerCase().includes(baseNameNoPage.toLowerCase());
          });
          
          if (matchedSourceIdx !== -1) {
            // It's a source reference - render as citation
            return (
              <span className="inline">
                <code className={`px-1.5 py-0.5 rounded text-sm
                  ${isDark ? 'bg-gray-700 text-amber-300' : 'bg-amber-100 text-amber-800'}`} {...props}>
                  {children}
                </code>
                <InlineCitation 
                  number={matchedSourceIdx + 1}
                  source={sources[matchedSourceIdx]}
                  chunkContent={sourceContents[sources[matchedSourceIdx]] || ''}
                  isDark={isDark}
                  onCitationClick={onCitationClick}
                />
              </span>
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
          // Process text nodes to add inline citations
          const processedChildren = React.Children.map(children, child => {
            if (typeof child === 'string') {
              return processTextWithCitations(child, child);
            }
            return child;
          });
          return <p className={`mb-3 last:mb-0 leading-relaxed ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{processedChildren}</p>;
        },
        ul: ({ children }) => <ul className={`list-disc list-inside mb-3 space-y-1 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{children}</ul>,
        ol: ({ children }) => <ol className={`list-decimal list-inside mb-3 space-y-1 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{children}</ol>,
        li: ({ children }) => <li className={`leading-relaxed ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>{children}</li>,
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
        th: ({ children }) => (
          <th className={`px-4 py-2 text-left font-semibold border-b
            ${isDark ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-gray-100 border-gray-300 text-gray-900'}`}>
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className={`px-4 py-2 border-b ${isDark ? 'border-gray-700 text-gray-100' : 'border-gray-300 text-gray-800'}`}>
            {children}
          </td>
        ),
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
  const [conversationTitle, setConversationTitle] = useState('');
  const [documents, setDocuments] = useState([]);
  
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
  
  // Refs
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

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

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

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
      setConversationTitle('');
      setDocuments([]);
      setNotes([]);
    }
  }, [conversationId]);

  const loadConversation = async () => {
    try {
      const data = await getConversation(conversationId);
      
      setConversationTitle(data.conversation?.title || data.title || 'New Chat');
      
      if (data.documents) {
        console.log('RAW documents from backend:', JSON.stringify(data.documents, null, 2));
        
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
        
        console.log('All docs after transform:', allDocs);
        
        const files = allDocs.filter(d => d.doc_type !== 'note');
        const notesDocs = allDocs.filter(d => d.doc_type === 'note');
        
        console.log('Files:', files);
        console.log('Notes:', notesDocs);
        
        const convertedNotes = notesDocs.filter(n => n.has_embeddings);
        
        setDocuments([...files, ...convertedNotes]);
        
        const loadedNotes = notesDocs.map(n => ({
          id: n.id,
          title: n.filename,
          content: n.content || '',
          createdAt: n.uploaded_at,
          convertedToSource: n.has_embeddings || false
        }));
        
        console.log('Setting notes to:', loadedNotes);
        
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
        const normalizedMessages = data.messages.map(msg => ({
          id: msg.id,
          role: msg.role === 'ai' ? 'assistant' : msg.role,
          content: msg.content,
          sources: msg.sources || [],
          timestamp: msg.timestamp || msg.created_at,
        }));
        setMessages(normalizedMessages);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  // Handle message submission
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if ((!inputMessage.trim() && selectedFiles.length === 0) || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      // Send message if there is one
      if (currentInput.trim()) {
        const data = await sendMessage(conversationId, currentInput);

        const assistantMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.response,
          sources: data.sources || [],
          sourceChunks: data.source_chunks || [],
          timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, assistantMessage]);

        if (data.conversation_id && !conversationId) {
          onConversationUpdate?.(data.conversation_id);
        }
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
    } finally {
      setIsLoading(false);
      setIsUploading(false);
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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputMessage]);

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

  // Handle edit and regenerate for user messages - with proper branching
  const handleEditAndRegenerate = async (messageId) => {
    if (!editContent.trim()) return;
    
    // Find the message index
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    
    const oldMessage = messages[messageIndex];
    
    // Build edit history - each entry contains its own content and the responses that follow it
    const existingHistory = oldMessage.editHistory || [{
      content: oldMessage.content,
      timestamp: oldMessage.timestamp,
      branchId: oldMessage.id + '_0',
      // Store all messages that came after this version (its "branch")
      followingMessages: messages.slice(messageIndex + 1)
    }];
    
    // Save current branch's following messages to the current edit history entry
    const currentIndex = oldMessage.editIndex ?? existingHistory.length - 1;
    existingHistory[currentIndex] = {
      ...existingHistory[currentIndex],
      followingMessages: messages.slice(messageIndex + 1)
    };
    
    // Create new edit entry with new branch
    const newBranchId = `${oldMessage.id}_${existingHistory.length}`;
    const newEdit = { 
      content: editContent, 
      timestamp: new Date().toISOString(),
      branchId: newBranchId,
      followingMessages: [] // Will be populated with the new response
    };
    
    const updatedUserMessage = {
      ...oldMessage,
      content: editContent,
      editHistory: [...existingHistory, newEdit],
      editIndex: existingHistory.length, // Point to the new edit
      timestamp: new Date().toISOString(),
      currentBranchId: newBranchId,
    };
    
    // Remove all messages after this one (they belong to the previous branch)
    const messagesBeforeEdit = messages.slice(0, messageIndex);
    setMessages([...messagesBeforeEdit, updatedUserMessage]);
    setEditingMessageId(null);
    setEditContent('');
    setIsLoading(true);
    
    try {
      const data = await sendMessage(conversationId, editContent);
      
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.response,
        sources: data.sources || [],
        timestamp: new Date().toISOString(),
        branchId: newBranchId,
      };
      
      // Update the edit history with the new response
      setMessages(prev => {
        const msgIndex = prev.findIndex(m => m.id === messageId);
        if (msgIndex === -1) return [...prev, assistantMessage];
        
        const msg = prev[msgIndex];
        const updatedHistory = [...msg.editHistory];
        updatedHistory[updatedHistory.length - 1] = {
          ...updatedHistory[updatedHistory.length - 1],
          followingMessages: [assistantMessage]
        };
        
        return [
          ...prev.slice(0, msgIndex),
          { ...msg, editHistory: updatedHistory },
          assistantMessage
        ];
      });
    } catch (error) {
      console.error('Error regenerating response:', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true,
        branchId: newBranchId,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate through edit history - switches between branches
  const navigateEditHistory = (messageId, direction) => {
    setMessages(prev => {
      const msgIndex = prev.findIndex(m => m.id === messageId);
      if (msgIndex === -1) return prev;
      
      const msg = prev[msgIndex];
      if (!msg.editHistory || msg.editHistory.length <= 1) return prev;
      
      const currentIndex = msg.editIndex ?? msg.editHistory.length - 1;
      let newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
      newIndex = Math.max(0, Math.min(msg.editHistory.length - 1, newIndex));
      
      if (newIndex === currentIndex) return prev;
      
      // First, save current branch's following messages
      const currentEntry = msg.editHistory[currentIndex];
      const currentFollowingMessages = prev.slice(msgIndex + 1);
      
      const updatedHistory = [...msg.editHistory];
      updatedHistory[currentIndex] = {
        ...currentEntry,
        followingMessages: currentFollowingMessages
      };
      
      // Switch to the target branch
      const targetEntry = updatedHistory[newIndex];
      const targetFollowingMessages = targetEntry.followingMessages || [];
      
      // Rebuild messages: all before the edited message, then the message with new content, then the branch's messages
      const messagesBeforeEdit = prev.slice(0, msgIndex);
      const updatedUserMessage = {
        ...msg,
        content: targetEntry.content,
        editHistory: updatedHistory,
        editIndex: newIndex,
        currentBranchId: targetEntry.branchId,
      };
      
      return [...messagesBeforeEdit, updatedUserMessage, ...targetFollowingMessages];
    });
  };

  // Regenerate last response
  const handleRegenerate = async () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage || isLoading) return;
    
    // Find and store the last assistant message index
    const lastAssistantIndex = messages.map(m => m.role).lastIndexOf('assistant');
    
    // Keep messages up to and including the last user message, remove only the assistant response
    const messagesWithoutLastAssistant = lastAssistantIndex !== -1 
      ? messages.filter((_, idx) => idx !== lastAssistantIndex)
      : messages;
    
    setMessages(messagesWithoutLastAssistant);
    setIsLoading(true);
    
    try {
      const data = await sendMessage(conversationId, lastUserMessage.content);
      
      if (data && data.response) {
        const assistantMessage = {
          id: data.assistant_message?.id || Date.now() + 1,
          role: 'assistant',
          content: data.response,
          sources: data.sources || [],
          timestamp: new Date().toISOString(),
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        console.error('Invalid response from server:', data);
        // Reload conversation to get proper state
        await loadConversation();
      }
    } catch (error) {
      console.error('Error regenerating response:', error);
      // Reload conversation to restore state on error
      await loadConversation();
    } finally {
      setIsLoading(false);
    }
  };

  // Handle source citation click - highlight in left panel
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
    
    // If this is a note that was converted to source, don't delete from backend
    // Just remove from Sources list (it will still exist in Notes)
    if (docToDelete.doc_type === 'note') {
      setDocuments(documents.filter((_, i) => i !== index));
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
    <div className={`flex h-full p-2 gap-2 ${theme.bg}`}>
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
        onResize={sourcePreview ? () => {} : setLeftPanelWidth}
        side="left"
        isDark={isDark}
        collapsed={leftPanelCollapsed}
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
                      className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                        doc.is_active !== false
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
      <div className={`flex-1 flex flex-col min-w-0 relative z-10 ${theme.panelBg} rounded-2xl overflow-hidden`}>
        {/* Chat Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${theme.panelBorder} backdrop-blur-xl`}>
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
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
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
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((message, msgIndex) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
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
                    <div className={`relative max-w-[85%] rounded-xl px-4 py-3 ${theme.assistantMessage} ${theme.text} border ${theme.cardBorder} shadow-sm ${message.isError ? 'border-red-500/50 bg-red-500/10' : ''}`}>
                      {/* AI Response Content with inline citations */}
                      <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>
                      <MarkdownRenderer 
                          content={message.content} 
                          isDark={isDark} 
                          sources={message.sources || []}
                          sourceContents={(() => {
                            // Use source_chunks from backend if available, otherwise fallback
                            const contentMap = {};
                            if (message.sourceChunks && message.sourceChunks.length > 0) {
                              message.sourceChunks.forEach(sc => {
                                contentMap[sc.source] = sc.chunk;
                              });
                            } else {
                              (message.sources || []).forEach(source => {
                                const doc = documents.find(d => d.filename === source || d.filename?.includes(source.split('_page_')[0]));
                                contentMap[source] = doc?.content?.substring(0, 500) || '';
                              });
                            }
                            return contentMap;
                          })()}
                          onCitationClick={(source, chunkContent) => {
                            const doc = documents.find(d => d.filename === source || d.filename?.includes(source.split('_page_')[0]));
                            if (doc) {
                              // Open in Sources panel, not modal
                              setLeftPanelCollapsed(false);
                              setSourcePreview(doc);
                              setSourceHighlight(chunkContent || source);
                            }
                          }}
                        />
                      </div>
                      
                      {/* Action Bar - Copy, Speaker, Regenerate */}
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
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className={`${theme.assistantMessage} ${theme.text} border ${theme.cardBorder} rounded-2xl px-4 py-3`}>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className={theme.textMuted}>Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <div className={`flex items-end gap-1 px-3 py-2 rounded-3xl border ${isDark ? 'bg-white/[0.03] border-white/10 backdrop-blur-xl' : 'bg-white/70 border-amber-100/50 backdrop-blur-xl'}`}>
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`p-2 rounded-full transition-all ${theme.hoverBg} ${theme.textMuted}`}
                title="Attach file"
              >
                <Plus size={20} strokeWidth={2} />
              </button>
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your documents..."
                className={`flex-1 resize-none bg-transparent outline-none py-2 px-2 max-h-[200px] text-sm ${theme.text} placeholder:${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                className={`p-2 rounded-full transition-all ${theme.hoverBg}
                  ${isVoiceEnabled ? 'text-amber-500' : theme.textMuted}`}
                title="Voice input"
              >
                <Mic size={20} strokeWidth={2} />
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading || (!inputMessage.trim() && selectedFiles.length === 0)}
                className={`p-2 rounded-full transition-all ${isDark ? 'bg-amber-500 text-white hover:bg-amber-400' : 'bg-amber-600 text-white hover:bg-amber-700'}
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Send size={20} strokeWidth={2} />
              </button>
            </div>
            <p className={`text-xs text-center mt-2 ${theme.textMuted} opacity-70`}>
              DocTalk may make mistakes. Please verify important information.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel Collapsed Bar */}
      {rightPanelCollapsed && (
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
      )}

      {/* Right Panel - Studio */}
      <ResizablePanel
        width={showNoteInput ? editorFixedWidth : rightPanelWidth}
        minWidth={150}
        maxWidth={showNoteInput ? editorFixedWidth : Math.max(150, Math.min(
          Math.floor(window.innerWidth * 0.35),
          window.innerWidth - (leftPanelCollapsed ? 48 : leftPanelWidth) - 450 - 32
        ))}
        onResize={showNoteInput ? () => {} : setRightPanelWidth}
        side="right"
        isDark={isDark}
        collapsed={rightPanelCollapsed}
      >
        <div className={`h-full flex flex-col ${theme.panelBg} backdrop-blur-xl rounded-2xl`}>
          {/* Show Editor at TOP when note input is open - Hide everything else */}
          {showNoteInput ? (
            <div className="flex-1 flex flex-col h-full">
              {/* Editor Header with breadcrumb and 3-dot menu */}
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
                    className={`text-sm ${theme.textSecondary} hover:text-amber-500 transition-colors`}
                  >
                    Studio
                  </button>
                  <ChevronRight size={14} className={theme.textMuted} />
                  <span className={`text-sm font-medium ${theme.text}`}>Note</span>
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
          {/* Studio Header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${theme.panelBorder}`}>
            <h2 className={`text-sm font-semibold tracking-wide uppercase ${theme.textSecondary}`}>Studio</h2>
            <button
              onClick={() => setRightPanelCollapsed(true)}
              className={`p-1.5 rounded-xl transition-all ${theme.hoverBg} ${theme.textSecondary}`}
              title="Collapse studio"
            >
              <PanelRight size={16} strokeWidth={2} />
            </button>
          </div>

          {/* Studio Tools Grid */}
          <div className="p-3 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              {studioTools.map((tool, index) => (
                <button
                  key={index}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border
                    ${theme.cardBg} ${theme.cardBorder} ${theme.hoverBg} transition-all hover:scale-[1.02]`}
                >
                  <tool.icon size={20} className={tool.color} strokeWidth={1.5} />
                  <span className={`text-xs text-center ${theme.textSecondary}`}>{tool.label}</span>
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
          </div>
            </>
          )}

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
        </div>
      </ResizablePanel>

      {/* Delete Source Confirmation Modal - Outside panels for proper z-index */}
      {showDeleteSourceConfirm !== null && (
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
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.md"
      />
    </div>
  );
};

export default ChatInterface;
