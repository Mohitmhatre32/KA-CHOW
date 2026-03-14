"""
LLM Client — single Groq client instance shared across all agents.
Provides typed helpers so agents don't need to handle Groq internals.
"""
import json
import re
from typing import Any, Dict, Optional
from groq import Groq
from app.core.config import settings

# ── Singleton client ──────────────────────────────────────────────────────────
client = Groq(api_key=settings.GROQ_API_KEY)


def generate_text(
    user_prompt: str,
    system_prompt: str = "You are a helpful AI assistant.",
    model: Optional[str] = None,
    max_tokens: int = 2048,
    temperature: float = 0.4,
) -> str:
    """
    Simple text completion via Groq.
    Returns the assistant message content as a plain string.
    """
    resp = client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        model=model or settings.LLM_MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return resp.choices[0].message.content or ""


def generate_json(
    user_prompt: str,
    system_prompt: str = "You are a helpful AI assistant. Always respond with valid JSON.",
    model: Optional[str] = None,
    max_tokens: int = 4096,
    temperature: float = 0.1,  # low temp → more deterministic JSON
) -> Dict[str, Any]:
    """
    Text completion that guarantees a parsed dict back.
    Strips markdown fences and tries multiple cleaning strategies before giving up.
    """
    raw = generate_text(user_prompt, system_prompt, model, max_tokens, temperature)
    return _parse_json(raw)


# ── JSON parsing helpers ──────────────────────────────────────────────────────

def _parse_json(text: str) -> Dict[str, Any]:
    """Clean LLM output and parse as JSON. Raises ValueError on total failure."""
    text = text.strip()

    # 1. Strip markdown code fences
    if "```" in text:
        match = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
        if match:
            text = match.group(1).strip()

    # 2. Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 3. Find the first {...} or [...] block
    brace_match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
    if brace_match:
        try:
            return json.loads(brace_match.group(1))
        except json.JSONDecodeError:
            pass

    # 4. Fix un-escaped newlines inside string values (common LLM error)
    lines = text.splitlines()
    cleaned, in_str = [], False
    for line in lines:
        unescaped_quotes = line.count('"') - line.count('\\"')
        if unescaped_quotes % 2 != 0:
            in_str = not in_str
        cleaned.append(line + ("\\n" if in_str else ""))
    try:
        return json.loads(" ".join(cleaned))
    except json.JSONDecodeError:
        pass

    raise ValueError(f"LLM did not return parseable JSON. Raw output (first 300c): {text[:300]}")
