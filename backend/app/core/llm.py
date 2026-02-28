import json
from groq import Groq
from app.core.config import settings

# Initialize Groq Client
client = Groq(api_key=settings.GROQ_API_KEY)

def generate_json_response(prompt: str, system_prompt: str) -> dict:
    """Forces the LLM to return strict JSON."""
    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt + "\n\nIMPORTANT: Output ONLY valid raw JSON. No markdown blocks like ```json."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"},
        )
        return json.loads(completion.choices[0].message.content)
    except Exception as e:
        print(f"LLM Error: {e}")
        return {}