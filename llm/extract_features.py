import sys
import json
import os
from dotenv import load_dotenv
from langchain.prompts import PromptTemplate
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
import chromadb
from chromadb.config import Settings
import re
def sanitize_metadata(meta):
    return {
        k: "; ".join(v) if isinstance(v, list) else v
        for k, v in meta.items()
    }

def clean_description(text):
    text = text.encode("utf-8", "replace").decode("utf-8")
    text = text.replace("â‚¹", "₹")  
    return text.strip()


load_dotenv()
os.environ["GROQ_API_KEY"] = os.getenv("GROQ_API_KEY")

try:
    input_data = json.loads(sys.stdin.read())
    job_description = input_data.get("description", "").strip()
    job_id = input_data.get("job_id")
except json.JSONDecodeError:
    print(json.dumps({"error": "Invalid JSON input"}))
    sys.exit(1)

if not job_id:
    print(json.dumps({"error": "Missing job_id argument"}))
    sys.exit(1)

if not job_description:
    print(json.dumps({"error": "Missing job description"}))
    sys.exit(1)

print(f"DEBUG: job_id = {job_id}", file=sys.stderr)
print(f"DEBUG: job_description = {repr(job_description)}", file=sys.stderr)

prompt_template = PromptTemplate(
    input_variables=["job_description"],
    template='''You are an AI assistant specialized in extracting and summarizing key information from job descriptions. Given a job description, analyze 
    it and return a structured summary in valid JSON format, capturing only the most essential details.
    Job Description:
    {job_description}
    Return the following output strictly in the JSON format:

    "Job Title": "[Extracted Job Title]",
    "Company Name": "[Extracted Company Name (if available)]",
    "Location": "[City, Country / Remote]",
    "Job Type": "[Full-time / Part-time / Contract / Internship]",
    "Key Responsibilities": [
        "Summarized primary duty 1",
        "Summarized primary duty 2",
        "Summarized primary duty 3"
    ],
    "Required Skills": [
        "Extracted technical or soft skill 1",
        "Extracted technical or soft skill 2"
    ],
    "Preferred Qualifications": [
        "Optional qualification 1 (if mentioned)",
        "Optional qualification 2 (if mentioned)"
    ],
    "Experience Required": "[Years of experience (if specified)]",
    "Salary Range": "[Salary details (if mentioned)]",
    "How to Apply": "[Application link or email (if available)]"

    Guidelines:

    Ensure the JSON output is valid and properly formatted.

    Omit any section if the relevant information is not available in the job description.

    Keep responses concise and free from unnecessary text. There should be no header and text 
    mentioning what you have done, it should just be pure JSON.
    IMPORTANT: Your response MUST ONLY be valid JSON with no explanation, comments, or additional text.
    Do not say anything before or after the JSON. Return only the JSON object.
'''
)

llm = ChatGroq(model_name="llama3-8b-8192")
chain = prompt_template | llm
job_description=clean_description(job_description)
try:
    response = chain.invoke({"job_description": job_description})
    output_text = response.content if hasattr(response, 'content') else str(response)
    result = json.loads(output_text)
except Exception as e:
    print(json.dumps({"error": "LLM processing failed", "details": str(e)}))
    sys.exit(1)

print(json.dumps(result))
