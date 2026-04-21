#!/usr/bin/env python3
"""
Run logos extraction on a transcript using Claude/GPT-4.
Validates the schema and saves structured output.
"""
import json
import os
import sys

# The extraction prompt (loaded from file)
PROMPT_FILE = "/opt/hermes/data/dreamapp/research/logos-extraction-prompt.md"
OUTPUT_DIR = "/opt/hermes/data/dreamapp/research/extracted"

os.makedirs(OUTPUT_DIR, exist_ok=True)

def load_prompt():
    with open(PROMPT_FILE) as f:
        content = f.read()
    # Extract just the prompt text between the code fences
    start = content.find("```") + 3
    end = content.rfind("```")
    return content[start:end].strip()

def load_transcript(path):
    with open(path) as f:
        return f.read()

def build_request(transcript_path, session_id):
    prompt = load_prompt()
    transcript = load_transcript(transcript_path)
    
    # Truncate if needed (keep first ~15K chars for single-session analysis)
    if len(transcript) > 15000:
        transcript = transcript[:15000] + "\n\n[TRANSCRIPT TRUNCATED - analyze what's available]"
    
    return {
        "prompt": prompt,
        "transcript": transcript,
        "session_id": session_id
    }

def save_result(session_id, result_json):
    output_path = os.path.join(OUTPUT_DIR, f"{session_id}.json")
    with open(output_path, 'w') as f:
        json.dump(result_json, f, indent=2)
    print(f"Saved: {output_path}")
    return output_path

def validate_schema(data):
    """Basic validation of required top-level keys."""
    required = ["meta", "phases", "questions", "beliefs_identified", 
                "resistance_moments", "breakthrough_markers", "emotional_arc",
                "logos_indicators", "session_dynamics"]
    
    missing = [k for k in required if k not in data]
    if missing:
        print(f"WARNING: Missing keys: {missing}")
        return False
    
    print(f"Schema valid. Found {len(data.get('questions', []))} questions, "
          f"{len(data.get('beliefs_identified', []))} beliefs, "
          f"{len(data.get('breakthrough_markers', []))} breakthroughs")
    return True

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 run-extraction.py <transcript.txt> [session_id]")
        print("\nThis script builds the API request. To actually run it,")
        print("use the hermes tools to call Claude/GPT-4 with the output.")
        sys.exit(1)
    
    transcript_path = sys.argv[1]
    session_id = sys.argv[2] if len(sys.argv) > 2 else os.path.basename(transcript_path).replace('.txt', '')
    
    request = build_request(transcript_path, session_id)
    
    # Save the request for inspection
    request_path = os.path.join(OUTPUT_DIR, f"{session_id}_request.json")
    with open(request_path, 'w') as f:
        json.dump(request, f, indent=2)
    
    print(f"Request built: {request_path}")
    print(f"Prompt length: {len(request['prompt'])} chars")
    print(f"Transcript length: {len(request['transcript'])} chars")
    print(f"\nTo run extraction, send the request to an LLM and save the result.")
