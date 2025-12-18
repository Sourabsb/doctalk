import google.generativeai as genai
from typing import List, Dict, Optional
from ..config import GEMINI_API_KEY

class GeminiClient:
    def __init__(self):
        if GEMINI_API_KEY:
            genai.configure(api_key=GEMINI_API_KEY)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        else:
            raise ValueError("Gemini API key not configured")
    
    async def generate_response(
        self, 
        query: str, 
        context_docs: List[Dict], 
        chat_history: List[Dict],
        hybrid_context: Optional[str] = None
    ) -> Dict[str, any]:
        # Check if this is a summarization request
        is_summary_request = any(word in query.lower() for word in [
            'summarize', 'summary', 'summarise', 'sumary', 'brief', 
            'overview', 'gist', 'main points', 'key points', 'highlights'
        ])
        
        context_text = self._format_context(context_docs)
        history_text = self._format_history(chat_history)
        
        # Include hybrid context if provided (relevant past Q&A from chat history)
        if hybrid_context:
            enhanced_context = f"""{context_text}

RELEVANT PAST CONVERSATIONS:
{hybrid_context}"""
        else:
            enhanced_context = context_text
        
        if is_summary_request:
            prompt = f"""You are DocTalk AI, a helpful document assistant. The user is asking for a summary of the uploaded documents.

DOCUMENT CONTEXT (from all uploaded files):
{enhanced_context}

RECENT CONVERSATION:
{history_text}

USER REQUEST: {query}

INSTRUCTIONS FOR SUMMARIZATION:
- Provide a comprehensive summary covering ALL uploaded documents
- Organize by file/document if multiple files are present
- Include key information, main topics, and important details from each document
- Structure the summary clearly with headings or sections for each file
- Mention specific file names when discussing content from each document
- Provide an overall conclusion that ties together insights from all documents
- Be thorough but concise - capture the essence of all uploaded materials
- Respond in clear English by default. Only switch to another language if the user explicitly requests it or if the entire conversation context is clearly anchored in that language
- When documents are in another language than the user’s prompt, briefly note that you translated the content
- Stay safe and factual. If a request violates policy or you are unsure of the translation, politely ask for clarification instead of refusing outright

FORMAT:
# Summary of Uploaded Documents

## [Filename 1]
- Key points and main content

## [Filename 2] 
- Key points and main content

## Overall Summary
- Combined insights and conclusions

COMPREHENSIVE SUMMARY:"""
        else:
            prompt = f"""You are DocTalk AI, a helpful and conversational document assistant. You have access to uploaded documents and can remember previous conversations in this session.

DOCUMENT CONTEXT (relevant sections from uploaded files):
{enhanced_context}

RECENT CONVERSATION (for continuity):
{history_text}

USER QUESTION: {query}

INSTRUCTIONS:
- Be conversational and natural - this is a chat, not a formal Q&A
- If the user refers to previous parts of the conversation (e.g., "explain that more", "what did you mean by...", "tell me more"), use the conversation history to understand context
- Analyze which file(s) contain relevant information for the question
- When the documents contain relevant facts, cite them with explicit file names ("According to [filename]...")
- If only part of the answer is in the documents, combine it with your own knowledge and clearly label which portion is from the uploaded files and which is general knowledge
- If none of the uploaded files mention the topic, still answer using your own knowledge, but explicitly mention that the information is outside the provided documents
- Keep responses conversational, well structured, and cite sources clearly whenever document content is referenced
- Format multiple sources like: "According to file1.pdf, X is Y. Meanwhile, from general knowledge, Z is W."
- Respond in English by default. Switch to another language only if the user explicitly asks for it or the conversation has clearly established an alternate preferred language
- If you rely on document passages written in another language, translate them fluently and mention that you translated them
- Follow safety best practices. If a translation seems ambiguous or the request is potentially unsafe, ask for clarification instead of refusing without context

ANSWER (be conversational, use document citations when relevant, remember past conversations):"""
        
        try:
            response = self.model.generate_content(prompt)
            sources = self._extract_sources(context_docs)
            source_chunks = self._extract_source_chunks(context_docs)
            
            return {
                "response": response.text,
                "sources": sources,
                "source_chunks": source_chunks
            }
        except Exception as e:
            raise ValueError(f"Failed to generate response: {str(e)}")
    
    def _format_context(self, context_docs: List[Dict]) -> str:
        formatted = []
        for i, doc in enumerate(context_docs, 1):
            source = doc.get('metadata', {}).get('source', 'Unknown')
            content = doc.get('page_content', '')
            formatted.append(f"FILE: {source}\nCONTENT: {content}\n---")
        return "\n\n".join(formatted)
    
    def _format_history(self, chat_history: List[Dict]) -> str:
        if not chat_history:
            return "No previous conversation."

        formatted = []
        for message in chat_history[-10:]:
            role = message.get("role", "user").capitalize()
            content = message.get("content", "")
            formatted.append(f"{role}: {content}")
        return "\n".join(formatted)
    
    def _extract_sources(self, context_docs: List[Dict]) -> List[str]:
        sources = set()
        for doc in context_docs:
            source = doc.get('metadata', {}).get('source', 'Unknown')
            sources.add(source)
        return list(sources)
    
    def _extract_source_chunks(self, context_docs: List[Dict]) -> List[Dict]:
        """Extract source name with its chunk content for citations"""
        source_chunks = []
        seen_sources = set()
        for doc in context_docs:
            source = doc.get('metadata', {}).get('source', 'Unknown')
            content = doc.get('page_content', '')
            # Only include first (most relevant) chunk per source
            if source not in seen_sources and content:
                source_chunks.append({
                    "source": source,
                    "chunk": content[:800]  # Limit chunk size for tooltip
                })
                seen_sources.add(source)
        return source_chunks
