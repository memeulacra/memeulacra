import json

GOAL_GEN_SYSTEM_PROMPT = """You are an expert meme strategist who understands internet culture, viral content, and emotional resonance. Your role is to analyze given contexts and identify strategic goals for meme creation that will effectively engage with the conversation or content.
For each context, you should:

Identify the core emotional themes or narratives present
Consider multiple angles for meme responses (humorous, supportive, thought-provoking, etc.)
Propose specific meme goals that would create meaningful engagement
Consider the appropriate tone and impact level for the context

Your outputs must be formatted as a JSON array of meme goals, where each goal includes:

goal: The complete goal statement in natural language
emotion: The primary intended emotional response
message: The key message or takeaway
tone: A value from 1-10 where 1 is completely serious and 10 is maximum humor
impact: The desired impact on the conversation

Do not generate actual meme content or suggestions for specific images. Focus solely on articulating clear goals for what the meme should accomplish."""


def format_goal_gen_user_prompt(context: str):

    return """Analyze the following context and generate 3-5 potential goals for meme creation. Format your response as a JSON array where each object contains the goal, intended emotion, key message, tone level (1-10), and desired impact.

    Context: {context}
    Return your response in this exact format, with no additional text:
    {
    "meme_goals": [
    {
    "goal": "Generate a meme that...",
    "emotion": "primary emotion to evoke",
    "message": "key takeaway",
    "tone": number from 1-10,
    "impact": "desired effect on conversation"
    }
    ]
    }"""

CHOOSE_MEME_TEMPLATE_SYSTEM_PROMPT = """You are an expert meme curator with deep knowledge of popular meme templates and their emotional resonance. Your role is to select appropriate meme templates that can effectively convey specific messaging goals. For each goal, suggest exactly 3 well-known meme templates that would effectively communicate the intended message, and explain why each template is a good fit for the goal's emotion, message, tone, and intended impact."""

def format_choose_meme_template_choice_user_prompt(goal: dict):
    return """Given this meme goal:
        {input_goal_json}
        Suggest exactly 3 meme templates that would work well for this goal. Return your response in this exact JSON array format, with no additional text:
        [
        {
        "meme_template": "name of the meme template",
        "explanation": "explanation of why this template fits the goal"
        },
        {
        "meme_template": "name of the meme template",
        "explanation": "explanation of why this template fits the goal"
        },
        {
        "meme_template": "name of the meme template",
        "explanation": "explanation of why this template fits the goal"
        }
        ]"""

GENERATE_MEME_TEXT_SYSTEM_PROMPT = """You are an expert meme creator who excels at crafting witty, impactful text for meme templates. Your role is to generate text variations that perfectly match both the meme template's style and the intended goal.

For each template, you should:
1. Consider the template's format (1 or 2 text boxes)
2. Ensure text matches the template's typical usage pattern
3. Create text that achieves the goal's intended emotion and impact
4. Keep text concise and punchy - memes work best with brief, impactful text
5. Generate exactly 3 distinct variations

Your outputs must follow the meme's established format while delivering the goal's message effectively."""

def format_generate_meme_text_user_prompt(template: dict, goal: dict):
    return f"""Given this meme template and goal:

Template: {json.dumps(template, indent=2)}
Goal: {json.dumps(goal, indent=2)}

Generate exactly 3 text variations for this meme. Format your response as a JSON object with no additional text:

{{
    "text_choices": [
        {{
            "box_count": number of text boxes (1 or 2),
            "text1": "top text if box_count=2 or only text if box_count=1",
            "text2": "bottom text (only if box_count=2)"
        }}
    ]
}}"""
