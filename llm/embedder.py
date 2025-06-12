from sentence_transformers import SentenceTransformer
import sys
import json

model = SentenceTransformer('all-MiniLM-L6-v2')

def main():
    data = json.loads(sys.stdin.read())
    job_text = data.get("job_text", "")
    resume_text = data.get("resume_text", "")

    job_embedding = model.encode(job_text).tolist()
    resume_embedding = model.encode(resume_text).tolist()

    print(json.dumps({
        "job_embedding": job_embedding,
        "resume_embedding": resume_embedding
    }))

if __name__ == "__main__":
    main()
