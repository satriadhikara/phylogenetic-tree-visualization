from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.models import SequenceInput, TreeOutput 
from Bio.Seq import Seq
from Bio.SeqRecord import SeqRecord
from Bio import SeqIO, AlignIO, Phylo
from Bio.Phylo._io import write 
from Bio.Align.Applications import ClustalwCommandline
from Bio.Phylo.TreeConstruction import DistanceCalculator, DistanceTreeConstructor, _DistanceMatrix
import tempfile
import subprocess 
import io 

def is_clustalw_installed():
    try:
        subprocess.run(["clustalw2", "-help"], capture_output=True) 
        return "clustalw2" 
    except FileNotFoundError:
        try:
            subprocess.run(["clustalw", "-help"], capture_output=True)
            return "clustalw" 
        except FileNotFoundError:
            return None 
    except Exception: 
        return None

def perform_msa(fasta_content: str) -> str:
    print("Performing MSA...")
    processed_fasta_content = fasta_content.replace('\\r\\n', '\n').replace('\\n', '\n')

    clustalw_exe_to_use = is_clustalw_installed()

    if not clustalw_exe_to_use:
        print(f"ClustalW (clustalw2 or clustalw) not found at expected paths or is not executable. Please ensure it's installed correctly by Homebrew.")
        raise RuntimeError(f"ClustalW not found or not executable.")

    with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".fasta") as infile:
        infile.write(processed_fasta_content) 
        infile_name = infile.name

    with tempfile.NamedTemporaryFile(mode="r", delete=False, suffix=".aln") as outfile:
        outfile_name = outfile.name

    try:    
        clustalw_cline = ClustalwCommandline(clustalw_exe_to_use, infile=infile_name, outfile=outfile_name, output="FASTA")
        print(f"Running ClustalW command: {str(clustalw_cline)}")
        
        stdout, stderr = clustalw_cline()
        print(f"ClustalW STDOUT: {stdout}")
        print(f"ClustalW STDERR: {stderr}")

        with open(outfile_name, "r") as f:
            aligned_fasta = f.read()
        
        if not aligned_fasta.strip():
            raise ValueError("MSA result is empty. Check ClustalW execution and input sequences.")

        try:
            alignment = AlignIO.read(io.StringIO(aligned_fasta), "fasta")
            if not alignment or len(alignment) == 0:
                raise ValueError("Parsed alignment is empty.")
        except Exception as e:
            print(f"Error parsing alignment: {e}")
            print(f"Problematic aligned FASTA content:\n{aligned_fasta}")
            raise ValueError(f"Could not parse the MSA output as FASTA. Error: {e}")

        return aligned_fasta

    except Exception as e:
        print(f"Error during MSA: {e}")
        raise
    finally:
        import os
        if 'infile_name' in locals() and os.path.exists(infile_name):
            os.remove(infile_name)
        if 'outfile_name' in locals() and os.path.exists(outfile_name):
            os.remove(outfile_name)


def calculate_distances(aligned_sequences_fasta: str) -> _DistanceMatrix:
    print("Calculating distances...")
    try:
        alignment_file = io.StringIO(aligned_sequences_fasta)
        alignment = AlignIO.read(alignment_file, "fasta")
        
        if not alignment:
            raise ValueError("Could not read alignment for distance calculation.")
        
        first_record = alignment[0]
        first_seq = str(first_record.seq).upper()
        is_dna = all(base in 'ATCGN-' for base in first_seq)
        
        try:
            if is_dna:
                calculator = DistanceCalculator('trans')
                print("Using transition model for DNA sequences")
            else:
                calculator = DistanceCalculator('blosum62')
                print("Using BLOSUM62 model for protein sequences")
            
            distance_matrix = calculator.get_distance(alignment)
            
        except Exception as model_error:
            print(f"Sequence-specific model failed: {model_error}. Falling back to identity model.")
            calculator = DistanceCalculator('identity')
            distance_matrix = calculator.get_distance(alignment)
        
        print(f"Distance Matrix names: {distance_matrix.names}")
        for i in range(len(distance_matrix.names)):
            for j in range(i + 1, len(distance_matrix.names)):
                distance = distance_matrix[i, j]
                print(f"Distance between {distance_matrix.names[i]} and {distance_matrix.names[j]}: {distance}")
        
        return distance_matrix
    except Exception as e:
        print(f"Error during distance calculation: {e}")
        raise

def construct_nj_tree(distance_matrix: _DistanceMatrix) -> str:
    print("Constructing tree...")
    try:
        constructor = DistanceTreeConstructor()
        tree = constructor.nj(distance_matrix)

        for internal_node in tree.get_nonterminals():
            internal_node.name = None

        newick_tree_buffer = io.StringIO()
        write(tree, newick_tree_buffer, "newick") 
        newick_tree_str = newick_tree_buffer.getvalue().strip()

        print(f"Newick Tree:\n{newick_tree_str}")
        return newick_tree_str
    except Exception as e:
        print(f"Error during tree construction: {e}")
        raise

app = FastAPI(title="Bioinformatics Tree Builder API")

origins = [
    "http://localhost:3000", 
    "http://127.0.0.1:3000",
    "https://phylogenetic-tree-visualization.vercel.app",
    "http://kds-frontend-g3qoci-177c0a-145-79-10-132.traefik.me"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)

@app.get("/")
async def read_root():
    return {"message": "Welcome to the Bioinformatics Phylogenetic Tree API"}

@app.post("/api/process-sequences-text/", response_model=TreeOutput)
async def process_sequences_text_input(data: SequenceInput):
    if not data.sequences_fasta:
        raise HTTPException(status_code=400, detail="No sequence data provided.")

    print(f"Received FASTA content:\n{data.sequences_fasta[:200]}...") 

    try:
        aligned_sequences = perform_msa(data.sequences_fasta)
        if not aligned_sequences: 
            return TreeOutput(message="MSA failed", error="MSA returned no result.")

        distance_matrix = calculate_distances(aligned_sequences)
        if not distance_matrix: 
            return TreeOutput(message="Distance calculation failed", error="Distance calculation returned no result.")

        newick_tree_result = construct_nj_tree(distance_matrix)
        if not newick_tree_result: 
            return TreeOutput(message="Tree construction failed", error="Tree construction returned no result.")

        return TreeOutput(
            message="Phylogenetic tree constructed successfully (placeholder).",
            newick_tree=newick_tree_result
        )
    except Exception as e:
        print(f"Error during processing: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/api/process-sequences-file/", response_model=TreeOutput)
async def process_sequences_file_upload(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")
    if not file.filename.endswith((".fasta", ".fa", ".fna", ".fas")):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a FASTA file (.fasta, .fa, .fna, .fas).")

    try:
        fasta_content_bytes = await file.read()
        fasta_content_str = fasta_content_bytes.decode("utf-8")
        print(f"Received FASTA file: {file.filename}, size: {len(fasta_content_str)} bytes")

        aligned_sequences = perform_msa(fasta_content_str)
        if not aligned_sequences:
            return TreeOutput(message="MSA failed", error="MSA returned no result.")

        distance_matrix = calculate_distances(aligned_sequences)
        if not distance_matrix:
            return TreeOutput(message="Distance calculation failed", error="Distance calculation returned no result.")

        newick_tree_result = construct_nj_tree(distance_matrix)
        if not newick_tree_result:
            return TreeOutput(message="Tree construction failed", error="Tree construction returned no result.")

        return TreeOutput(
            message=f"Phylogenetic tree constructed successfully from {file.filename} (placeholder).",
            newick_tree=newick_tree_result
        )
    except Exception as e:
        print(f"Error processing file {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error while processing file: {str(e)}")
    finally:
        await file.close()

