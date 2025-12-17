import io
from typing import List, Dict
from PIL import Image
import pypdf
import docx
from azure.cognitiveservices.vision.computervision import ComputerVisionClient
from azure.cognitiveservices.vision.computervision.models import OperationStatusCodes
from msrest.authentication import CognitiveServicesCredentials
import time
from ..config import AZURE_VISION_ENDPOINT, AZURE_VISION_KEY

class DocumentProcessor:
    def __init__(self):
        if AZURE_VISION_ENDPOINT and AZURE_VISION_KEY:
            self.cv_client = ComputerVisionClient(
                AZURE_VISION_ENDPOINT,
                CognitiveServicesCredentials(AZURE_VISION_KEY)
            )
        else:
            self.cv_client = None
    
    async def process_file(self, file_content: bytes, filename: str) -> Dict[str, str]:
        file_ext = filename.lower().split('.')[-1]
        
        if file_ext == 'pdf':
            return self._extract_pdf_text(file_content, filename)
        elif file_ext == 'txt':
            return self._extract_txt_text(file_content, filename)
        elif file_ext == 'docx':
            return self._extract_docx_text(file_content, filename)
        elif file_ext in ['jpg', 'jpeg', 'png']:
            return await self._extract_image_text(file_content, filename)
        else:
            raise ValueError(f"Unsupported file type: {file_ext}")
    
    def _extract_pdf_text(self, content: bytes, filename: str) -> Dict[str, str]:
        try:
            pdf_reader = pypdf.PdfReader(io.BytesIO(content))
            text_data = {}
            
            for page_num, page in enumerate(pdf_reader.pages):
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    text_data[f"{filename}_page_{page_num + 1}"] = page_text
            
            # If no text was extracted, add a placeholder to avoid empty result
            if not text_data:
                text_data[f"{filename}_page_1"] = "This PDF appears to contain no extractable text. It might be an image-based PDF."
                
            return text_data
        except Exception as e:
            print(f"Error processing PDF: {e}")
            return {filename: f"Error processing PDF: {str(e)}. Please try another file."}
    
    def _extract_txt_text(self, content: bytes, filename: str) -> Dict[str, str]:
        text = content.decode('utf-8')
        return {filename: text}
    
    def _extract_docx_text(self, content: bytes, filename: str) -> Dict[str, str]:
        doc = docx.Document(io.BytesIO(content))
        text = '\n'.join([paragraph.text for paragraph in doc.paragraphs])
        return {filename: text}
    
    async def _extract_image_text(self, content: bytes, filename: str) -> Dict[str, str]:
        if not self.cv_client:
            raise ValueError("Azure Computer Vision not configured")
        
        read_response = self.cv_client.read_in_stream(
            io.BytesIO(content), raw=True
        )
        
        operation_id = read_response.headers["Operation-Location"].split("/")[-1]
        
        while True:
            read_result = self.cv_client.get_read_result(operation_id)
            if read_result.status not in ['notStarted', 'running']:
                break
            time.sleep(1)
        
        text = ""
        if read_result.status == OperationStatusCodes.succeeded:
            for text_result in read_result.analyze_result.read_results:
                for line in text_result.lines:
                    text += line.text + " "
        
        return {filename: text}
