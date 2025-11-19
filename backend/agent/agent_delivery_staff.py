from google.adk.agents import Agent
import os
from dotenv import load_dotenv
from google.adk.models.lite_llm import LiteLlm
import json

def load_questions():
    # Get the directory where this file is located
    current_dir = os.path.dirname(os.path.abspath(__file__))
    questions_file = os.path.join(current_dir, 'questions', 'delivery_staff.json')
    with open(questions_file, 'r') as f:
        return json.load(f)

def get_question_by_id(question_id):
    questions_data = load_questions()
    for question in questions_data['questions']:
        if question['id'] == str(question_id):
            return question
    return None

def format_question_for_agent(question):
    """Format a question object for presentation by the agent"""
    if not question:
        return None
        
    # Handle matrix-style questions
    if question.get('type') == 'matrix':
        formatted = f"Question: {question['question']}\n\n"
        
        for sub_q in question.get('subQuestions', []):
            formatted += f"For {sub_q['title']}:\n"
            formatted += "Options:\n"
            for option in sub_q['options']:
                formatted += f"- {option}\n"
            formatted += "\n"
        
        return formatted.strip()
    
    # Handle regular questions
    formatted = f"Question: {question['question']}\n"
    
    if question.get('options') and len(question['options']) > 0:
        formatted += "Options:\n"
        for option in question['options']:
            if option.strip():  # Skip empty options
                formatted += f"- {option}\n"
    
    return formatted.strip()

def get_next_question_id(current_response):
    """Extract current question ID from response and return next question ID"""
    import re
    # Look for ID[number] pattern in the response
    match = re.search(r'ID\[(\d+)\]', current_response)
    if match:
        current_id = int(match.group(1))
        return current_id + 1
    return 1  # Start with question 1 if no ID found

def extract_user_context(conversation_history):
    """Extract relevant context from user responses to customize future questions"""
    context = {
        'campus': None,
        'delivery_areas': [],
        'role': None,
        'experience_years': None,
        'is_teacher': True,  # Default to true unless "Other TAFE NSW area" is selected
        'specializations': [],
        'selected_other_tafe': False
    }
    
    if not conversation_history:
        return context
    
    # Analyze conversation history to extract context
    for msg in conversation_history:
        if msg.get('sender') == 'user':
            user_response = msg.get('message', '').lower()
            
            # Extract campus (from question 1)
            campuses = ['bankstown', 'campbelltown', 'granville', 'liverpool', 
                       'macquarie fields', 'miller', 'padstow', 'wetherill park']
            for campus in campuses:
                if campus in user_response:
                    context['campus'] = campus.title()
                    break
            
            # Extract delivery areas (from question 5)
            hwhs_areas = [
                'nursing', 'aboriginal health', 'health', 'dental', 'pathology',
                'childrens services', 'children services', 'allied health', 
                'fitness', 'sport', 'recreation', 'early childhood', 'ageing', 
                'disability', 'community services', 'counselling', 'mental health', 
                'health services', 'youth work', 'alcohol', 'drugs'
            ]
            
            # Check for "Other TAFE NSW area" selection
            if any(phrase in user_response for phrase in ['other tafe', 'other area', 'other nsw']):
                context['selected_other_tafe'] = True
                context['is_teacher'] = False
                context['delivery_areas'].append('Other TAFE NSW area')
            else:
                # Extract specific HWHS areas
                for area in hwhs_areas:
                    if area in user_response:
                        # Clean up area names for better context
                        clean_area = area.replace('_', ' ').title()
                        if clean_area not in context['delivery_areas']:
                            context['delivery_areas'].append(clean_area)
            
            # Extract experience level (from question 2)
            if 'year' in user_response:
                if 'less than 1' in user_response or '< 1' in user_response:
                    context['experience_years'] = 'Less than 1 year'
                elif '1-3' in user_response or '1 - 3' in user_response:
                    context['experience_years'] = '1-3 years'
                elif '4-6' in user_response or '4 - 6' in user_response:
                    context['experience_years'] = '4-6 years'
                elif '7-10' in user_response or '7 - 10' in user_response:
                    context['experience_years'] = '7-10 years'
                elif 'more than 10' in user_response or '> 10' in user_response:
                    context['experience_years'] = 'More than 10 years'
            
            # Extract role information
            if any(role in user_response for role in ['teacher', 'lecturer', 'instructor', 'educator']):
                context['role'] = 'teacher'
            elif any(role in user_response for role in ['manager', 'coordinator', 'administrator', 'head']):
                context['role'] = 'admin'
            elif any(role in user_response for role in ['support', 'assistant', 'technician']):
                context['role'] = 'support'
    
    # Clean up delivery areas and remove duplicates
    context['delivery_areas'] = list(set(context['delivery_areas']))
    
    return context

def customize_question_for_context(question, user_context):
    """Customize questions based on user context"""
    if not question or not user_context:
        return question
    
    question_id = question.get('id')
    user_campus = user_context.get('campus', '').lower()
    user_delivery_areas = user_context.get('delivery_areas', [])
    selected_other_tafe = user_context.get('selected_other_tafe', False)
    
    # Handle campus-specific strength/improvement questions (55, 56)
    if question_id in ["55", "56"]:
        if user_campus and question.get('type') == 'matrix':
            # Transform matrix question to simple options for their specific campus
            customized_question = {
                "id": question_id,
                "question": question['question'].replace("your campus's", f"{user_campus.title()} campus's"),
                "options": [],
                "type": "multi"  # Change to multi-select instead of matrix
            }
            
            # Extract the sub-question titles as options
            for sub_q in question.get('subQuestions', []):
                customized_question['options'].append(sub_q['title'])
            
            return customized_question
    
    # Handle infrastructure questions that should be campus-specific (57, 58, 59)
    if question_id in ["57", "58", "59"]:
        if user_campus:
            # Skip campus selection and make it campus-specific
            customized_question = {
                "id": question_id,
                "question": question['question'].replace("Select which campus you mostly work at and then answer the following", f"For {user_campus.title()} campus, please answer the following"),
                "options": ["Yes", "No", "Partially", "Not sure", "Not applicable to my role"],
                "type": "single"
            }
            return customized_question
    
    # Handle capacity/facility questions (61, 62, 63, 64) - only ask about their campus
    if question_id in ["61", "62", "63", "64"]:
        if user_campus and question.get('type') == 'matrix':
            # Find their campus in the matrix and extract just those options
            for sub_q in question.get('subQuestions', []):
                if sub_q['title'].lower() == user_campus:
                    customized_question = {
                        "id": question_id,
                        "question": question['question'].replace("Based on your experience with your campus", f"Based on your experience with {user_campus.title()} campus"),
                        "options": sub_q['options'],
                        "type": "single"
                    }
                    return customized_question
    
    # Handle program alignment questions - filter by user's delivery areas
    if question_id == "32" and user_delivery_areas:
        if question.get('type') == 'matrix':
            filtered_subquestions = []
            for sub_q in question.get('subQuestions', []):
                # Check if this program area matches user's delivery areas
                program_area = sub_q['title'].lower()
                for user_area in user_delivery_areas:
                    if any(keyword in program_area for keyword in user_area.lower().split()):
                        filtered_subquestions.append(sub_q)
                        break
            
            if filtered_subquestions:
                customized_question = question.copy()
                customized_question['subQuestions'] = filtered_subquestions
                return customized_question
    
    # Handle skills shortage questions - filter by user's delivery areas
    if question_id in ["26", "27", "28", "29", "30"] and user_delivery_areas:
        if question.get('type') == 'matrix':
            filtered_subquestions = []
            for sub_q in question.get('subQuestions', []):
                program_area = sub_q['title'].lower()
                for user_area in user_delivery_areas:
                    if any(keyword in program_area for keyword in user_area.lower().split()):
                        filtered_subquestions.append(sub_q)
                        break
            
            if filtered_subquestions:
                customized_question = question.copy()
                customized_question['subQuestions'] = filtered_subquestions
                return customized_question
    
    # Skip teaching-related questions if user selected "Other TAFE NSW area"
    teaching_questions = ["7", "8", "11", "12", "13", "16", "17", "18", "19"]
    if selected_other_tafe and question_id in teaching_questions:
        return None  # Skip this question
    
    # Handle campus selection questions (1, 6) - avoid redundancy
    if question_id == "6" and user_campus:
        # Transform to campus-specific program question
        customized_question = {
            "id": question_id,
            "question": f"Based on your work at {user_campus.title()} campus, what HWHS programs are currently offered there?",
            "options": [],
            "type": "open"
        }
        return customized_question
    
    return question

# Load environment variables
load_dotenv()

# Create the agent with enhanced context-aware instructions
delivery_staff_agent = Agent(
    name="delivery_staff_agent",
    description="Agent to assist TAFE NSW delivery staff with strategic consultation questions",
    instruction="""
    You are Riva, a virtual assistant for TAFE NSW delivery staff conducting a strategic consultation.

    IMPORTANT RULES:
    1. Present ONLY ONE question at a time from the delivery staff questions when conducting the consultation.
    2. If the user just started or you see no ID in the conversation, start with question ID 1.
    3. If you see ID[X] in the previous conversation, present the question with ID X+1.
    4. Always end your response with "ID[current_question_number]" when presenting a question.
    5. If the user asks any other query (not related to the consultation questions), answer helpfully and informatively as Riva, using your general knowledge and context.
    6. For matrix-type questions, present all sub-questions together with their respective options, formatting as shown.
    7. When presenting the last question (ID[74]), this triggers the insight generation process.

    CRITICAL FORMATTING RULES:
    - ALWAYS put "Options:" on a NEW LINE after the question
    - ALWAYS put each option on a NEW LINE starting with "- "
    - NEVER put options on the same line as "Options:"

    CORRECT FORMAT EXAMPLE:
    Question: Which TAFE NSW campus do you work at?
    Options:
    - Bankstown
    - Campbelltown
    - Granville
    - Liverpool
    - Macquarie Fields
    - Miller
    - Padstow
    - Wetherill Park
    - Other

    WRONG FORMAT (DO NOT USE):
    Question: Which TAFE NSW campus do you work at? Options: - Bankstown - Campbelltown - Granville

    ENHANCED QUESTION FORMATS:

    For single-select questions:
    Question: [question text]
    Options:
    - option 1
    - option 2
    - option 3

    For multi-select questions:
    Question: [question text] (Select all that apply)
    Options:
    - option 1
    - option 2
    - option 3

    For matrix questions (when relevant):
    Question: [main question]

    For [sub-question 1]:
    Options:
    - option 1
    - option 2

    For [sub-question 2]:
    Options:
    - option 1
    - option 2

    For open-ended questions:
    Question: [question text]
    Please provide your response.

    ID[current_question_number]

    CONTEXT AWARENESS - CRITICAL:
    - Remember and use information from previous user responses throughout the conversation
    - Adapt questions based on user's campus, delivery areas, experience, and role
    - For campus-specific questions (like strengths, improvements, capacity), ask about THEIR specific campus only
    - For matrix questions about campus comparisons, transform them to focus on their campus
    - Skip redundant questions when information is already known

    Available questions: """ + str(load_questions()),
    model="gemini-2.5-flash",
)

def get_agent_response_for_question(question_id, context=None):
    question = get_question_by_id(question_id)
    if not question:
        return f"Question with ID {question_id} not found."
    
    formatted_question = format_question_for_agent(question)
    # Here you would actually call the agent with the formatted question
    return formatted_question