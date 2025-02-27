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


def format_goal_gen_user_prompt(context: str, num_goals: int = 3):

    return f"""Analyze the following context and generate exactly {num_goals} potential goals for meme creation. Format your response as a JSON array where each object contains the goal, intended emotion, key message, tone level (1-10), and desired impact.

    Context: {context}
    Return your response in this exact format, with no additional text:
    {{
    "meme_goals": [
    {{
    "goal": "Generate a meme that...",
    "emotion": "primary emotion to evoke",
    "message": "key takeaway",
    "tone": number from 1-10,
    "impact": "desired effect on conversation"
    }}
    ]
    }}"""

CHOOSE_MEME_TEMPLATE_SYSTEM_PROMPT = """You are an expert meme curator with deep knowledge of popular meme templates and their emotional resonance. Your role is to select appropriate meme templates that can effectively convey specific messaging goals. For each goal, suggest exactly 3 well-known meme templates that would effectively communicate the intended message, and explain why each template is a good fit for the goal's emotion, message, tone, and intended impact."""

def format_choose_meme_template_choice_user_prompt(goal: dict):
    return f"""Given this meme goal:
        {json.dumps(goal, indent=2)}
        Suggest exactly 3 meme templates that would work well for this goal. Return your response in this exact JSON array format, with no additional text:
        [
        {{
        "meme_template": "name of the meme template",
        "explanation": "explanation of why this template fits the goal"
        }},
        {{
        "meme_template": "name of the meme template",
        "explanation": "explanation of why this template fits the goal"
        }},
        {{
        "meme_template": "name of the meme template",
        "explanation": "explanation of why this template fits the goal"
        }}
        ]"""

GENERATE_MEME_TEXT_SYSTEM_PROMPT = """You are an expert meme creator who excels at crafting witty, impactful text for meme templates. Your role is to generate text variations that perfectly match both the meme template's style, the intended goal, and the original context.

For each template, you should:
1. Consider the template's format (number of text boxes as indicated by text_box_count)
2. If text box coordinates and labels are provided, generate text that fits each labeled box
3. Ensure text matches the template's typical usage pattern
4. Create text that achieves the goal's intended emotion and impact
5. Keep text concise and punchy - memes work best with brief, impactful text
6. Ensure the text relates back to the original context while achieving the goal
7. Study the provided successful examples to understand what resonates with users
8. Learn from less successful examples to avoid common pitfalls
9. Generate exactly 3 distinct variations that incorporate these insights

When analyzing examples:
- Look for patterns in successful memes' text structure and tone
- Note how successful memes balance humor with message delivery
- Identify what makes certain memes less effective
- Consider how text length and complexity affects engagement

When text box labels are provided:
- Pay close attention to the labels that describe what each text box represents
- Generate text that is appropriate for the described element (e.g., "boyfriend in the center" vs "girlfriend being ignored")
- Ensure the text for each box makes sense in relation to the other boxes
- Keep the narrative coherent across all text boxes

Your outputs must follow the meme's established format while delivering both the goal's message and maintaining relevance to the original context, informed by real engagement data from similar memes."""

def format_generate_meme_text_user_prompt(template: dict, goal: dict, context: str, examples: dict = None, num_variations: int = 3):
    examples_section = ""
    if examples and (examples.get('most_liked') or examples.get('most_disliked')):
        examples_section = "\nLearn from these examples:\n\nHighly Successful Examples:\n"
        for ex in examples.get('most_liked', []):
            text_boxes = [ex.get(f'text_box_{i}') for i in range(1, 6) if ex.get(f'text_box_{i}')]
            examples_section += f"- Thumbs up: {ex.get('thumbs_up', 0)}\n  Text: {' | '.join(text_boxes)}\n"
        
        examples_section += "\nLess Successful Examples to Learn From:\n"
        for ex in examples.get('most_disliked', []):
            text_boxes = [ex.get(f'text_box_{i}') for i in range(1, 6) if ex.get(f'text_box_{i}')]
            examples_section += f"- Thumbs down: {ex.get('thumbs_down', 0)}\n  Text: {' | '.join(text_boxes)}\n"

    # Add text box coordinates information if available
    text_box_info = ""
    if template.get('text_box_coordinates') and template.get('text_box_count', 0) > 0:
        text_box_info = "\nText Box Information:\n"
        for box in template['text_box_coordinates']:
            text_box_info += f"- Box {box.get('id')}: {box.get('label', 'No label')}\n"

    return f"""Given this meme template, goal, and original context:

Template: {json.dumps(template, indent=2)}
Goal: {json.dumps(goal, indent=2)}
Original Context: {context}{examples_section}{text_box_info}

Generate exactly {num_variations} text variation(s) for this meme that relate to both the goal and the original context. Use insights from the successful examples while avoiding patterns from less successful ones.

{"For each text box, generate text that fits the description in the label." if text_box_info else ""}

Format your response as a JSON object with no additional text:

{{
    "text_choices": [
        {{
            "box_count": {template.get('text_box_count', 2)},
            {"".join([f'"text{box.get("id")}": "text for {box.get("label", f"box {box.get("id")}")}",' for box in template.get('text_box_coordinates', [])]).rstrip(',') if template.get('text_box_coordinates') else '"text1": "top text if box_count=2 or only text if box_count=1",\n            "text2": "bottom text (only if box_count=2)"'}
        }}
    ]
}}"""
