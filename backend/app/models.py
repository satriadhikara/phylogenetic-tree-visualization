from pydantic import BaseModel
from typing import List, Optional

class SequenceInput(BaseModel):
    sequences_fasta: str 

class TreeOutput(BaseModel):
    message: str
    newick_tree: Optional[str] = None 
    error: Optional[str] = None
