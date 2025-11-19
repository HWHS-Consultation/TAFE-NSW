# """
# Task Manager for the Strategic Consultant Agent.
# Handles consultation sessions and priority analysis.
# """

# import os
# import logging
# import uuid
# import re
# from typing import Dict, Any, Optional, List

# from google.adk.agents import Agent
# from google.adk.runners import Runner
# from google.adk.sessions import InMemorySessionService
# from google.adk.artifacts.in_memory_artifact_service import InMemoryArtifactService
# from google.genai import types as adk_types

# # Configure logging
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# # Define app name for the runner
# A2A_APP_NAME = "strategic_consultant_app"

# class TaskManager:
#     """Task Manager for the Strategic Consultant Agent."""
    
#     def __init__(self, agent: Agent):
#         """Initialize with an Agent instance and set up ADK Runner."""
#         logger.info(f"Initializing TaskManager for agent: {agent.name}")
#         self.agent = agent
        
#         # Initialize ADK services
#         self.session_service = InMemorySessionService()
#         self.artifact_service = InMemoryArtifactService()
        
#         # Create the runner
#         self.runner = Runner(
#             agent=self.agent,
#             app_name=A2A_APP_NAME,
#             session_service=self.session_service,
#             artifact_service=self.artifact_service
#         )
#         logger.info(f"ADK Runner initialized for app '{self.runner.app_name}'")

#     async def process_task(self, message: str, context: Dict[str, Any] = None, session_id: Optional[str] = None) -> Dict[str, Any]:
#         """
#         Process a strategic consultation request.
        
#         Args:
#             message: The user's message
#             context: Context containing user_id, department info, etc.
#             session_id: Session identifier
            
#         Returns:
#             Response dict with message and status
#         """
#         try:
#             # Extract context information
#             if not context:
#                 context = {}
            
#             user_id = context.get("user_id", "default_user")
#             department = context.get("department", "Unknown Department")
#             conversation_history = context.get("conversationHistory", []) # Same key as first file

#             # Build comprehensive system instruction using Riley's context
#             system_instruction = self._build_riley_context(
#                 current_message=message, 
#                 context=context, 
#                 department=department, 
#                 conversation_history=conversation_history
#             )
            
#             # Create or generate session
#             if not session_id:
#                 session_id = str(uuid.uuid4())
            
#             # Create session
#             try:
#                 await self.session_service.create_session(
#                     app_name=A2A_APP_NAME,
#                     user_id=user_id,
#                     session_id=session_id,
#                     state={}
#                 )
#             except Exception as e:
#                 logger.warning(f"Session creation issue: {e}")
            
#             # Create user message with comprehensive system instruction
#             # The system_instruction now includes the conversation history and current user message
#             request_content = adk_types.Content(
#                 role="user", # The ADK runner expects the new message to be from the user
#                 parts=[adk_types.Part(text=system_instruction)]
#             )
            
#             # Run the agent with the new message
#             events_async = self.runner.run_async(
#                 user_id=user_id,
#                 session_id=session_id,
#                 new_message=request_content # Pass the single new message
#             )
            
#             # Process response
#             final_message = "Hello! I'm Riley, your strategic consultant. How can I help you today?"
#             interactive_question_data = None
            
#             async for event in events_async:
#                 if event.is_final_response() and event.content and event.content.role == "model":
#                     if event.content.parts and event.content.parts[0].text:
#                         final_message = event.content.parts[0].text
#                         logger.info(f"Agent response: {final_message}")

#                         # Parse for interactive questions
#                         # parsed_interactive = self._parse_interactive_questions(final_message)
#                         # if parsed_interactive:
#                         #     interactive_question_data = parsed_interactive
#                         #     final_message = parsed_interactive.get("clean_message", "") # Use clean message for display
#                         #     logger.info(f"Parsed interactive question: {interactive_question_data}")

#             # Handle special cases like analysis completion (same as first file)
#             response_result = await self._handle_special_responses(
#                 final_message, message, context, user_id
#             )
            
#             if response_result:
#                 return response_result
            
#             response_data = {
#                 "message": final_message,
#                 "status": "success",
#                 "session_id": session_id,
#                 "data": {
#                     "conversation_stage": self._analyze_conversation_context(message, conversation_history),
#                     "department": department
#                 }
#             }
            
#             # Add interactive question data if present
#             if interactive_question_data:
#                 response_data["interactive_question_data"] = interactive_question_data
            
#             return response_data
            
#         except Exception as e:
#             logger.error(f"Error processing task: {e}")
#             return {
#                 "message": f"I apologize, but I encountered an error while processing your request: {str(e)}",
#                 "status": "error"
#             }
    
#     def _build_riley_context(self, current_message: str, context: Dict, department: str, conversation_history: List[Dict]) -> str:
#         """Build comprehensive context for Riley's response."""
        
#         # Extract stakeholder information from context
#         user_name = context.get('name', 'there')
#         user_role = context.get('role', 'unknown role')
#         user_department = context.get('department', department)
        
#         # Analyze conversation stage and user needs
#         conversation_stage = self._analyze_conversation_context(current_message, conversation_history)
#         strategic_focus = self._identify_strategic_focus(current_message, conversation_history)
        
#         # Format conversation history
#         formatted_history = self._format_conversation_history(conversation_history)
        
#         # Get Riley's strategic questioning approach
#         questioning_strategy = self._get_strategic_questioning_approach(conversation_stage, strategic_focus)
        
#         # Add progression trigger
#         progression_guidance = ""
#         if conversation_stage == "analysis_phase":
#             progression_guidance = """
    
# CRITICAL: ALL CONTEXT QUESTIONS COMPLETED. Riley must now START ANALYSIS. Say something like:
# "Thank you for providing all that context, {user_name}! Based on our conversation, I can see several strategic priorities emerging. Let me provide you with my analysis..."

# Then provide:
# 1. Summary of priorities discussed
# 2. Strategic analysis with scores (Importance/Urgency out of 10)
# 3. Categorization by themes
# 4. Recommendations for next steps
# """
#         elif conversation_stage == "role_context_gathering":
#             progression_guidance = """

# CRITICAL: CONTINUE ROLE CONTEXT QUESTIONS. Do NOT provide analysis yet. Ask the next role context question in sequence.
# """
#         elif conversation_stage == "performance_data_gathering":
#             progression_guidance = """

# CRITICAL: ASK PERFORMANCE DATA QUESTIONS. Do NOT provide analysis yet. Ask about performance metrics familiarity.
# """

#         return f"""
# RILEY'S CONSULTATION CONTEXT:

# STAKEHOLDER INFORMATION:
# - Name: {user_name}
# - Role: {user_role}
# - Department: {user_department}
# - User ID: {context.get('user_id', 'unknown')}

# CURRENT SITUATION:
# - Conversation Stage: {conversation_stage}
# - Strategic Focus Area: {strategic_focus}

# CONVERSATION HISTORY:
# {formatted_history}

# RILEY'S STRATEGIC APPROACH FOR THIS RESPONSE:
# {questioning_strategy}

# TAFE NSW CONTEXT TO CONSIDER:
# - TAFE NSW is Australia's largest vocational education provider
# - Focus on industry-relevant training and student outcomes
# - Strategic priorities include digital transformation, industry partnerships, and future skills
# - Operates across multiple faculties with diverse departmental needs
# - Subject to ASQA requirements and government policy frameworks

# RILEY'S RESPONSE GUIDELINES:
# 1. Use the stakeholder's actual name ({user_name}) in your responses
# 2. Acknowledge what the user has shared
# 3. Use strategic thinking to identify underlying priorities
# 4. Ask 1 probing question on each response that help uncover strategic insights
# 5. Reference TAFE NSW context when relevant
# 6. Keep response conversational but professionally focused
# 7. Build on previous conversation threads
# 8. Challenge assumptions constructively when appropriate

# Remember: You are Riley having a strategic conversation with {user_name}, who works as {user_role} in {user_department}. Be warm, curious, and genuinely interested in helping them discover their priorities.

# CURRENT USER MESSAGE: "{current_message}"

# Respond as Riley would in this consultation context, using {user_name}'s actual name:

# {progression_guidance}
# """
    
#     # Replace the _analyze_conversation_context method in your task_manager.py:

#     def _analyze_conversation_context(self, current_message: str, history: List[Dict]) -> str:
#         """Analyze the conversation to determine current stage."""
        
#         message_lower = current_message.lower()
#         history_length = len(history)
        
#         # Initialize last_ai_message outside the if block
#         last_ai_message = ""
        
#         # Check if consultation is complete based on previous messages
#         if history_length > 0:
#             for msg in reversed(history):
#                 if msg.get('sender') == 'ai':
#                     last_ai_message = msg.get('message', '').lower()
#                     break
            
#             # If the last AI message contained analysis/action plan and user is saying thanks/goodbye
#             if (any(phrase in last_ai_message for phrase in ["action plan", "strategic analysis", "recommendations for next steps", "pleasure helping"]) 
#                 and any(phrase in message_lower for phrase in ["thanks", "thank you", "bye", "goodbye", "see you", "great", "perfect", "excellent"])):
#                 return "consultation_complete"

#         # Count questions asked by checking AI messages for question patterns
#         ai_questions_asked = 0
#         context_questions = [
#             "years have you been in your current position",
#             "years with tafe nsw",
#             "direct reports",
#             "internal stakeholders",
#             "external stakeholders"
#         ]
        
#         for msg in history:
#             if msg.get('sender') == 'ai':
#                 ai_msg = msg.get('message', '').lower()
#                 for question in context_questions:
#                     if question in ai_msg:
#                         ai_questions_asked += 1
#                         break
        
#         # Performance data question patterns
#         performance_questions = [
#             "familiar are you with the performance metrics",
#             "performance metrics for your area",
#             "additional data would be helpful"
#         ]
        
#         performance_questions_asked = 0
#         for msg in history:
#             if msg.get('sender') == 'ai':
#                 ai_msg = msg.get('message', '').lower()
#                 for question in performance_questions:
#                     if question in ai_msg:
#                         performance_questions_asked += 1
#                         break

#         # Determine stage based on questions asked
#         if history_length == 0 or any(keyword in message_lower for keyword in ["hello", "hi", "start", "begin"]):
#             return "initial_engagement"
#         elif ai_questions_asked < 5:  # Need all 5 role context questions first
#             return "role_context_gathering"
#         elif ai_questions_asked >= 5 and performance_questions_asked < 2:  # Then performance data questions
#             return "performance_data_gathering"
#         elif performance_questions_asked >= 2:  # Only after all context questions
#             return "analysis_phase"
#         else:
#             return "role_context_gathering"  # Default back to context gathering
            
#     def _identify_strategic_focus(self, current_message: str, history: List[Dict]) -> str:
#         """Identify the strategic focus area from the conversation."""
        
#         combined_text = current_message.lower()
#         if history:
#             combined_text += " " + " ".join([msg.get('message', '').lower() for msg in history[-3:]])
        
#         if any(keyword in combined_text for keyword in ["student", "learner", "enrollment", "completion"]):
#             return "student_outcomes"
#         elif any(keyword in combined_text for keyword in ["industry", "employer", "partnership", "workplace"]):
#             return "industry_engagement"
#         elif any(keyword in combined_text for keyword in ["digital", "technology", "online", "system"]):
#             return "digital_transformation"
#         elif any(keyword in combined_text for keyword in ["staff", "teacher", "faculty", "workforce"]):
#             return "workforce_development"
#         elif any(keyword in combined_text for keyword in ["quality", "compliance", "asqa", "standard"]):
#             return "quality_assurance"
#         elif any(keyword in combined_text for keyword in ["budget", "resource", "funding", "cost"]):
#             return "resource_management"
#         else:
#             return "strategic_planning"
    
#     def _get_strategic_questioning_approach(self, stage: str, focus: str) -> str:
#         """Get Riley's strategic questioning approach based on context."""
        
#         stage_approaches = {
#             "initial_engagement": """
#             Riley should:
#             - Welcome them warmly using their actual name
#             - Acknowledge their role and department
#             - Start with the first role context question: "How many years have you been in your current position?"
#             """,
#             "role_context_gathering": """
#             Riley should:
#             - Continue with the role context questions in order
#             - Ask ONE question at a time from the sequence:
#               1. Years in current position
#               2. Years with TAFE NSW overall  
#               3. Number of direct reports
#               4. Key internal stakeholders
#               5. Key external stakeholders
#             - Do NOT proceed to performance data until ALL 5 questions are answered
#             - Do NOT provide analysis yet
#             """,
#             "performance_data_gathering": """
#             Riley should:
#             - After ALL role context questions, ask about performance data familiarity
#             - Ask: "Now I'd like to understand your relationship with performance data. How familiar are you with the performance metrics for your area?" with checkbox options
#             - Then ask: "What additional data would be most helpful for you in your role?"
#             - Do NOT provide analysis until BOTH performance questions are answered
#             """,
#             "analysis_phase": """
#             Riley should:
#             - NOW provide strategic analysis based on all gathered context
#             - Summarize the priorities discussed
#             - Provide strategic analysis using frameworks (Eisenhower Matrix, Impact/Effort)
#             - Score priorities on importance (1-10) and urgency (1-10)
#             - Categorize by themes (Student Outcomes, Digital Transformation, etc.)
#             """,
#             "consultation_complete": """
#             Riley should:
#             - Acknowledge the thanks/farewell graciously
#             - Provide a brief, warm closing statement
#             - NOT repeat analysis or action plans
#             - Keep response short and professional
#             """
#         }
        
#         focus_context = {
#             "student_outcomes": "Consider student success metrics, completion rates, industry readiness",
#             "industry_engagement": "Think about employer satisfaction, job placement rates, industry feedback", 
#             "digital_transformation": "Focus on technology adoption, digital literacy, system integration",
#             "workforce_development": "Consider staff capabilities, professional development, change management",
#             "quality_assurance": "Think about compliance requirements, standards, continuous improvement",
#             "resource_management": "Focus on budget optimization, resource allocation, efficiency",
#             "strategic_planning": "Consider broader organizational alignment and future direction"
#         }
        
#         return f"{stage_approaches.get(stage, 'Continue systematic context gathering - do not analyze yet')}\n\nFocus Context: {focus_context.get(focus, 'General strategic thinking')}"    
    
#     def _format_conversation_history(self, history: List[Dict]) -> str:
#         """Format conversation history for context."""
#         if not history:
#             return "No previous conversation history."
        
#         # Format exactly like the first file - using 'USER' and 'MODEL' labels
#         formatted = []
#         for msg in history[-5:]:  # Last 5 messages for context
#             sender = "USER" if msg.get('sender') == 'user' else "MODEL"
#             message = msg.get('message', '')
#             formatted.append(f"{sender}: {message}")
        
#         return "\n".join(formatted)
    
#     async def _handle_special_responses(self, response: str, user_message: str, 
#                                       context: Dict, user_id: str) -> Optional[Dict]:
#         """Handle special response cases like analysis completion or action plan generation."""
        
#         # Check if analysis was completed
#         if "priority_analysis_tool" in response or "analysis_result" in response.lower():
#             logger.info("Priority analysis completed")
#             return {
#                 "message": response,
#                 "status": "success",
#                 "data": {
#                     "analysis_completed": True,
#                     "stage": "ANALYSIS_COMPLETE"
#                 }
#             }
        
#         # Check if action plan was generated
#         if "generate_action_plan_tool" in response or "action_plan" in response.lower():
#             logger.info("Action plan generated")
#             return {
#                 "message": response,
#                 "status": "success",
#                 "data": {
#                     "action_plan_generated": True,
#                     "stage": "ACTION_PLAN_COMPLETE"
#                 }
#             }
        
#         # Handle consultation completion
#         if any(phrase in response.lower() for phrase in ["consultation complete", "summary", "next steps"]):
#             return {
#                 "message": response,
#                 "status": "success",
#                 "data": {
#                     "consultation_complete": True,
#                     "follow_up_recommended": True
#                 }
#             }
        
#         return None

#     def _parse_interactive_questions(self, message: str) -> Optional[Dict[str, Any]]:
#         """Parse interactive questions from agent response."""

#         # First, check if the message is HTML
#         if message.startswith("<!DOCTYPE html>"):
#             return {
#                 "type": "html",
#                 "html": message
#             }
        
#         # Look for [RADIO_BUTTONS] tags
#         radio_pattern = r'\[RADIO_BUTTONS\](.*?)\[/RADIO_BUTTONS\]'
#         radio_match = re.search(radio_pattern, message, re.DOTALL)
        
#         if radio_match:
#             # Extract the options between the tags
#             options_text = radio_match.group(1).strip()
            
#             # Parse individual options (lines starting with -)
#             options = []
#             for line in options_text.split('\n'):
#                 line = line.strip()
#                 if line.startswith('-'):
#                     option = line[1:].strip()  # Remove the dash and trim
#                     if option:
#                         options.append(option)
            
#             if options:
#                 # Extract the question text (everything before [RADIO_BUTTONS])
#                 question_text = message[:radio_match.start()].strip()
                
#                 # Clean up the question text - remove quotes if present
#                 if question_text.startswith('"') and question_text.endswith('"'):
#                     question_text = question_text[1:-1]
                
#                 # Extract the last sentence that ends with a question mark as the actual question
#                 question_sentences = question_text.split('.')
#                 actual_question = ""
#                 for sentence in reversed(question_sentences):
#                     sentence = sentence.strip()
#                     if sentence.endswith('?'):
#                         actual_question = sentence
#                         break
                
#                 # If no question mark found, use a default format
#                 if not actual_question:
#                     actual_question = "Please select one of the following options:"
                
#                 # Remove the radio buttons section from the main message
#                 clean_message = message.replace(radio_match.group(0), '').strip()
                
#                 return {
#                     "type": "choice",  # Changed from "radio" to "choice" to match frontend expectations
#                     "question": actual_question,
#                     "options": options,
#                     "clean_message": clean_message
#                 }
        
#         return None