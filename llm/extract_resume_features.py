import sys
import json
import os
import uuid
import re
from dotenv import load_dotenv
from langchain.prompts import PromptTemplate
from langchain_groq import ChatGroq
from langchain.chains import LLMChain
import fitz  
import warnings
warnings.filterwarnings("ignore")

def extract_text_from_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    return text

def clean_text(text):
    text = text.encode("utf-8", "replace").decode("utf-8")
    text = text.replace("\u2019", "'").replace("\u2013", "-")
    return text.strip()

load_dotenv()
os.environ["GROQ_API_KEY"] = os.getenv("GROQ_API_KEY")

raw_input = sys.stdin.read()

if not raw_input.strip():
    print(json.dumps({
        "error": "LLM processing failed",
        "details": "No input received on stdin"
    }))
    sys.exit(1)

try:
    input_data = json.loads(raw_input)
    resume_path = input_data.get("resume_path")
    job_id = input_data.get("job_id")
except json.JSONDecodeError:
    print(json.dumps({"error": "Invalid JSON input"}))
    sys.exit(1)

if not job_id or not resume_path:
    print(json.dumps({"error": "Missing required fields"}))
    sys.exit(1)

full_path = os.path.abspath(resume_path)

if not os.path.isfile(full_path):
    print(json.dumps({
        "error": "File not found",
        "details": f"Resume file not found at {full_path}"
    }))
    sys.exit(1)

resume_text = extract_text_from_pdf(full_path)
resume_text = clean_text(resume_text)

prompt_template = PromptTemplate(
    input_variables=["resume_text"],
    template='''You are an AI assistant specialized in extracting and summarizing key information from Resume Texts. Given a Resume text data, analyze
it and return a structured summary in valid JSON format, capturing only the most essential details.

Resume Texts:
{resume_text}

Return the following output strictly in the JSON format:

"Full Name": "[Extracted Full Name of Candidate]",
"Email": "[Extracted Email Address of Candidate (if available)]",
"Phone Number": "[Extracted Phone Number of Candidate (if available)]",
"Education":[
     "Extracted Education 1 (Degree,Field,University,Location,Year)",
     "Extracted Education 2 (Degree,Field,University,Location,Year)",
     "Extracted Education 3 (Degree,Field,University,Location,Year)"
],
"Experiences": [
    "Experience 1 in any company with role and duration",
    "Experience 2 in any company with role and duration"
],
"Skills": [
    "Extracted technical or soft skill 1",
    "Extracted technical or soft skill 2"
],
"Core Qualifications": [
    "qualification 1",
    "qualification 2"
]

Guidelines:

Ensure the JSON output is valid and properly formatted.
Omit any section if the relevant information is not available.
Keep responses concise and free from unnecessary text.
IMPORTANT: Your response MUST ONLY be valid JSON with no explanation, comments, or additional text.
Return only the JSON object.'''
)

try:
    llm = ChatGroq(model_name="llama3-8b-8192")
    chain = LLMChain(llm=llm, prompt=prompt_template)
    raw_response = chain.run(resume_text=resume_text)

    json_match = re.search(r"\{.*\}", raw_response, re.DOTALL)
    if not json_match:
        raise ValueError("No JSON object found in the LLM response.")

    cleaned_json = json_match.group(0)
    parsed_response = json.loads(cleaned_json)

    print(json.dumps(parsed_response, indent=2)) 

except json.JSONDecodeError:
    print(json.dumps({
        "error": "LLM response is not valid JSON",
        "details": raw_response
    }))
    sys.exit(1)

except Exception as e:
    print(json.dumps({"error": "LLM processing failed", "details": str(e)}))
    sys.exit(1)