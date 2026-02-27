import React, { useState, useRef, useCallback } from 'react'
import { uploadFiles } from '../utils/api'

// Shadcn components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

// Lucide icons
import { Upload, X, Cloud, Lock, ArrowRight, Loader2, Check, AlertCircle, Sparkles, Brain, Cpu } from 'lucide-react'

const UploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const [files, setFiles] = useState([])
  const [conversationTitle, setConversationTitle] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [llmMode, setLlmMode] = useState('local')
  const [embeddingModel, setEmbeddingModel] = useState('custom')
  const fileInputRef = useRef(null)

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    setFiles(prev => [...prev, ...droppedFiles])
  }, [])

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    setFiles(prev => [...prev, ...selectedFiles])
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setIsProcessing(true)
    setError(null)
    try {
      const response = await uploadFiles(files, conversationTitle.trim(), llmMode, embeddingModel)
      onUploadSuccess(response.conversation_id)
      setFiles([])
      setConversationTitle('')
      setLlmMode('local')
      setEmbeddingModel('custom')
      onClose()
    } catch (error) {
      console.error('Upload failed:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Upload failed. Please check your files and try again.'
      setError(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      setFiles([])
      setConversationTitle('')
      setError(null)
      setLlmMode('local')
      setEmbeddingModel('custom')
      onClose()
    }
  }

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    return ext?.toUpperCase() || 'FILE'
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-card border-border">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-primary flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-xl text-foreground">Add sources</DialogTitle>
              <DialogDescription className="text-muted-foreground">Upload documents to analyze with AI</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="max-h-[60vh]">
          <div className="p-6 space-y-6">
            {/* Drop Zone */}
            <div
              className={`
                relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300
                ${dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
              />

              <div className="space-y-4">
                <div className={`
                  w-16 h-16 rounded-xl mx-auto flex items-center justify-center transition-all
                  ${dragActive ? 'bg-primary/20' : 'bg-muted'}
                `}>
                  <Upload className={`w-8 h-8 transition-all ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground mb-3">
                    {dragActive ? 'Drop files here' : 'Drag & drop your files'}
                  </p>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Browse files
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Supported formats: <span className="font-medium text-foreground">PDF, DOC, DOCX, TXT</span>
                </p>
              </div>
            </div>

            {/* LLM Mode Selection */}
            <div className="grid grid-cols-2 gap-4">
              {/* Local Option */}
              <button
                onClick={() => setLlmMode('local')}
                className={`
                  p-4 rounded-lg border text-left transition-all flex items-center gap-4
                  ${llmMode === 'local'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-card hover:bg-muted/30'
                  }
                `}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${llmMode === 'local' ? 'bg-primary/20' : 'bg-muted'
                  }`}>
                  <Lock className={`w-5 h-5 ${llmMode === 'local' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">Local (Ollama)</p>
                    <Badge variant="secondary" className="text-xs">Private</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Run AI on your device</p>
                </div>
                {llmMode === 'local' && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </button>

              {/* Cloud Option */}
              <button
                onClick={() => setLlmMode('api')}
                className={`
                  p-4 rounded-lg border text-left transition-all flex items-center gap-4
                  ${llmMode === 'api'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-card hover:bg-muted/30'
                  }
                `}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${llmMode === 'api' ? 'bg-blue-500/20' : 'bg-muted'
                  }`}>
                  <Cloud className={`w-5 h-5 ${llmMode === 'api' ? 'text-blue-500' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">Cloud API</p>
                    <Badge variant="secondary" className="text-xs">Fast</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Faster processing</p>
                </div>
                {llmMode === 'api' && (
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            </div>

            {/* Embedding Model Selection */}
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Embedding Model</p>
              <div className="grid grid-cols-2 gap-4">
                {/* Custom DocTalk Option */}
                <button
                  onClick={() => setEmbeddingModel('custom')}
                  className={`
                    p-4 rounded-lg border text-left transition-all flex items-center gap-4
                    ${embeddingModel === 'custom'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/30'
                    }
                  `}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${embeddingModel === 'custom' ? 'bg-purple-500/20' : 'bg-muted'
                    }`}>
                    <Brain className={`w-5 h-5 ${embeddingModel === 'custom' ? 'text-purple-500' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">DocTalk</p>
                      <Badge variant="secondary" className="text-xs">Custom</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Custom trained model</p>
                  </div>
                  {embeddingModel === 'custom' && (
                    <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>

                {/* All-MiniLM Option */}
                <button
                  onClick={() => setEmbeddingModel('allminilm')}
                  className={`
                    p-4 rounded-lg border text-left transition-all flex items-center gap-4
                    ${embeddingModel === 'allminilm'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/30'
                    }
                  `}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${embeddingModel === 'allminilm' ? 'bg-emerald-500/20' : 'bg-muted'
                    }`}>
                    <Cpu className={`w-5 h-5 ${embeddingModel === 'allminilm' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">All-MiniLM</p>
                      <Badge variant="secondary" className="text-xs">Standard</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Pre-trained model</p>
                  </div>
                  {embeddingModel === 'allminilm' && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Files List */}
            {files.length > 0 && (
              <div className="space-y-4">
                {/* Title Input */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Notebook title <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    value={conversationTitle}
                    onChange={(e) => setConversationTitle(e.target.value)}
                    placeholder="e.g. Project Research Notes"
                    className="bg-background border-input"
                  />
                </div>

                {/* File List */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Selected files ({files.length})
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="group flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">
                              {getFileIcon(file.name)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground truncate max-w-[240px]">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeFile(index)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="p-6 pt-4 border-t border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            {files.length > 0
              ? `${files.length} source${files.length > 1 ? 's' : ''} ready to upload`
              : 'Upload files to get started'
            }
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={files.length === 0 || isProcessing}
              className="gap-2 min-w-[140px]"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Create notebook
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default UploadModal
