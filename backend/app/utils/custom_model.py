import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from transformers import AutoTokenizer


class TransformerEncoderLayer(nn.Module):
    """Custom Transformer Encoder Layer"""
    
    def __init__(self, d_model=256, nhead=8, dim_feedforward=1024, dropout=0.1):
        super().__init__()
        self.self_attn = nn.MultiheadAttention(d_model, nhead, dropout=dropout, batch_first=True)
        self.linear1 = nn.Linear(d_model, dim_feedforward)
        self.dropout = nn.Dropout(dropout)
        self.linear2 = nn.Linear(dim_feedforward, d_model)
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.dropout1 = nn.Dropout(dropout)
        self.dropout2 = nn.Dropout(dropout)
    
    def forward(self, src, src_mask=None):
        src2 = self.self_attn(src, src, src, key_padding_mask=src_mask)[0]
        src = src + self.dropout1(src2)
        src = self.norm1(src)
        src2 = self.linear2(self.dropout(F.relu(self.linear1(src))))
        src = src + self.dropout2(src2)
        src = self.norm2(src)
        return src


class DocTalkEmbeddingModel(nn.Module):
    """Custom embedding model"""
    
    def __init__(self, model_path):
        super().__init__()
        
        checkpoint = torch.load(f"{model_path}/model.pt", map_location='cpu')
        config = checkpoint['config']
        
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        
        self.token_embedding = nn.Embedding(config['vocab_size'], config['d_model'], padding_idx=0)
        self.positional_embedding = nn.Embedding(config['max_seq_length'], config['d_model'])
        
        self.encoder_layers = nn.ModuleList([
            TransformerEncoderLayer(config['d_model'], config['nhead'], 
                                  config['dim_feedforward'], config['dropout'])
            for _ in range(config['num_layers'])
        ])
        
        self.projection = nn.Sequential(
            nn.Linear(config['d_model'], config['embedding_dim']),
            nn.LayerNorm(config['embedding_dim']),
            nn.Tanh()
        )
        
        self.dropout = nn.Dropout(config['dropout'])
        
        self.load_state_dict(checkpoint['model_state_dict'])
        self.eval()
        
        self.max_seq_length = config['max_seq_length']
        self.embedding_dim = config['embedding_dim']
        self.d_model = config['d_model']
    
    def mean_pooling(self, token_embeddings, attention_mask):
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, dim=1)
        sum_mask = torch.clamp(input_mask_expanded.sum(dim=1), min=1e-9)
        return sum_embeddings / sum_mask
    
    def forward(self, input_ids, attention_mask):
        batch_size, seq_len = input_ids.shape
        
        token_emb = self.token_embedding(input_ids)
        positions = torch.arange(seq_len, device=input_ids.device).unsqueeze(0).expand(batch_size, -1)
        pos_emb = self.positional_embedding(positions)
        embeddings = self.dropout(token_emb + pos_emb)
        
        padding_mask = (attention_mask == 0)
        for layer in self.encoder_layers:
            embeddings = layer(embeddings, src_mask=padding_mask)
        
        pooled = self.mean_pooling(embeddings, attention_mask)
        final_embeddings = self.projection(pooled)
        return F.normalize(final_embeddings, p=2, dim=1)
    
    def encode(self, texts, batch_size=32):
        """Encode texts to embeddings"""
        self.eval()
        all_embeddings = []
        
        with torch.no_grad():
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i+batch_size]
                encoded = self.tokenizer(
                    batch,
                    padding=True,
                    truncation=True,
                    max_length=self.max_seq_length,
                    return_tensors='pt'
                )
                embeddings = self.forward(encoded['input_ids'], encoded['attention_mask'])
                all_embeddings.append(embeddings.cpu().numpy())
        
        return np.vstack(all_embeddings)
