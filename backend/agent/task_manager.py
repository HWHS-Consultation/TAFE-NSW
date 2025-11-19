"""
Task Manager for the Strategic Consultant Agent.
Handles consultation sessions and priority analysis with proper stage tracking.
"""

from datetime import datetime
import os
import logging
import uuid
import re
from typing import Dict, Any, Optional, List

from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.artifacts.in_memory_artifact_service import InMemoryArtifactService
from google.genai import types as adk_types
from supabase import create_client, Client


# from supabase import create_client, Client



# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define app name for the runner
A2A_APP_NAME = "strategic_consultant_app"

# def save_to_db():
#     SUPABASE_URL = "https://jcaxnxltkvaaukybtiix.supabase.co"
#     SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjYXhueGx0a3ZhYXVreWJ0aWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNzExNzMsImV4cCI6MjA2ODg0NzE3M30.8dp7uWhI_S3_4yRJYECeOtAq7v3epJ8Q7mYuf-FNvZ4"

#     supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

#     # Insert a new row
#     data = {"name": "John Doe", "age": 30}
#     response = supabase.table("dummy_table").insert(data).execute()
#     print("Insert response:", response)

#     # Fetch all rows
#     rows = supabase.table("dummy_table").select("*").execute()
#     print("Table rows:", rows)

class ConsultationStageTracker:
    """Tracks the detailed progress through Riley's consultation process."""
    
    # Define all consultation stages in order
    CONSULTATION_STAGES = {
        "initial_engagement": {
            "order": 1,
            "description": "Initial greeting and setup",
            "next_stage": "role_context_gathering"
        },
        "role_context_gathering": {
            "order": 2,
            "description": "Gathering stakeholder role context (5 questions)",
            "questions": [
                "years have you been in your current position",
                "years with tafe nsw",
                "direct reports",
                "internal stakeholders",
                "external stakeholders"
            ],
            "next_stage": "performance_data_gathering"
        },
        "performance_data_gathering": {
            "order": 3,
            "description": "Understanding performance data familiarity",
            "questions": [
                "familiar are you with the performance metrics",
                "additional data would be helpful"
            ],
            "next_stage": "operational_challenges"
        },
        "operational_challenges": {
            "order": 4,
            "description": "Current operational challenges assessment",
            "questions": [
                "rate the following challenges",
                "top 3 operational challenges"
            ],
            "next_stage": "strategic_priorities"
        },
        "strategic_priorities": {
            "order": 5,
            "description": "Strategic vision and priorities",
            "questions": [
                "ideal world",
                "rank your top 5 investment priorities",
                "biggest opportunities for growth"
            ],
            "next_stage": "capacity_constraints"
        },
        "capacity_constraints": {
            "order": 6,
            "description": "Capacity utilization and constraints",
            "questions": [
                "current student capacity",
                "prevents you from operating at full capacity",
                "additional resources would you need"
            ],
            "next_stage": "risk_assessment"
        },
        "risk_assessment": {
            "order": 7,
            "description": "Risk assessment and concerns",
            "questions": [
                "rate your level of concern about these potential risks",
                "specific risks are you most concerned"
            ],
            "next_stage": "success_factors"
        },
        "success_factors": {
            "order": 8,
            "description": "Critical success factors",
            "questions": [
                "needs to be in place for a strategic roadmap"
            ],
            "next_stage": "industry_context"
        },
        "industry_context": {
            "order": 9,
            "description": "Industry context and additional information",
            "questions": [
                "industry trends or changes",
                "innovative approaches or best practices",
                "anything else you'd like us to know"
            ],
            "next_stage": "strategic_analysis"
        },
        "strategic_analysis": {
            "order": 10,
            "description": "Comprehensive strategic analysis and recommendations",
            "next_stage": "consultation_complete"
        },
        "consultation_complete": {
            "order": 11,
            "description": "Consultation completed"
        }
    }
    
    @classmethod
    def analyze_conversation_stage(cls, current_message: str, history: List[Dict]) -> Dict[str, Any]:
        """Analyze conversation to determine current stage and progress."""
        
        message_lower = current_message.lower()
        history_length = len(history)
        
        # Check for completion signals
        if cls._is_consultation_complete(message_lower, history):
            return {
                "stage": "consultation_complete",
                "progress": 100,
                "next_action": "farewell",
                "questions_asked": [],
                "questions_remaining": []
            }
        
        # Initial engagement
        if history_length == 0 or any(keyword in message_lower for keyword in ["hello", "hi", "start", "begin"]):
            return {
                "stage": "initial_engagement",
                "progress": 0,
                "next_action": "start_role_context",
                "questions_asked": [],
                "questions_remaining": cls.CONSULTATION_STAGES["role_context_gathering"]["questions"]
            }
        
        # Analyze questions asked in conversation history
        questions_asked = cls._extract_questions_asked(history)
        
        # Determine current stage based on questions asked
        current_stage = cls._determine_current_stage(questions_asked)
        stage_info = cls.CONSULTATION_STAGES[current_stage]
        
        # Calculate progress
        total_questions = sum(len(stage.get("questions", [])) for stage in cls.CONSULTATION_STAGES.values())
        progress = (len(questions_asked) / total_questions) * 100 if total_questions > 0 else 0
        
        # Determine next action
        next_action = cls._determine_next_action(current_stage, questions_asked)
        
        # Get remaining questions for current stage
        questions_remaining = cls._get_remaining_questions(current_stage, questions_asked)
        
        return {
            "stage": current_stage,
            "progress": progress,
            "next_action": next_action,
            "questions_asked": questions_asked,
            "questions_remaining": questions_remaining,
            "stage_description": stage_info["description"]
        }
    
    @classmethod
    def _is_consultation_complete(cls, message_lower: str, history: List[Dict]) -> bool:
        """Check if consultation is complete."""
        if not history:
            return False
            
        # Look for analysis in recent AI messages
        for msg in reversed(history[-3:]):
            if msg.get('sender') == 'ai':
                ai_message = msg.get('message', '').lower()
                if any(phrase in ai_message for phrase in [
                    "strategic analysis", "recommendations", "roadmap outline",
                    "next steps", "implementation", "priority matrix"
                ]):
                    # If AI provided analysis and user is thanking/acknowledging
                    if any(phrase in message_lower for phrase in [
                        "thanks", "thank you", "great", "perfect", "excellent", "helpful"
                    ]):
                        return True
        return False
    
    @classmethod
    def _extract_questions_asked(cls, history: List[Dict]) -> List[str]:
        """Extract questions that have been asked from conversation history."""
        questions_asked = []
        
        # Get all question patterns from all stages
        all_questions = []
        for stage_name, stage_info in cls.CONSULTATION_STAGES.items():
            if "questions" in stage_info:
                all_questions.extend(stage_info["questions"])
        
        # Check which questions have been asked
        for msg in history:
            if msg.get('sender') == 'ai':
                ai_message = msg.get('message', '').lower()
                for question_pattern in all_questions:
                    if question_pattern in ai_message and question_pattern not in questions_asked:
                        questions_asked.append(question_pattern)
        
        return questions_asked
    
    @classmethod
    def _determine_current_stage(cls, questions_asked: List[str]) -> str:
        """Determine current stage based on questions asked."""
        
        # Check each stage in order
        for stage_name, stage_info in cls.CONSULTATION_STAGES.items():
            if "questions" not in stage_info:
                continue
                
            stage_questions = stage_info["questions"]
            questions_completed = sum(1 for q in stage_questions if q in questions_asked)
            
            # If not all questions in this stage are completed, this is the current stage
            if questions_completed < len(stage_questions):
                return stage_name
        
        # All questions completed - ready for analysis
        return "strategic_analysis"
    
    @classmethod
    def _determine_next_action(cls, current_stage: str, questions_asked: List[str]) -> str:
        """Determine what action should be taken next."""
        
        stage_info = cls.CONSULTATION_STAGES.get(current_stage, {})
        
        if current_stage == "strategic_analysis":
            return "provide_analysis"
        elif current_stage == "consultation_complete":
            return "farewell"
        elif "questions" in stage_info:
            # Find next question to ask in current stage
            for question in stage_info["questions"]:
                if question not in questions_asked:
                    return f"ask_next_question: {question}"
            # All questions in current stage completed
            return f"move_to_next_stage: {stage_info.get('next_stage', 'strategic_analysis')}"
        else:
            return "continue_conversation"
    
    @classmethod
    def _get_remaining_questions(cls, current_stage: str, questions_asked: List[str]) -> List[str]:
        """Get remaining questions for the current stage."""
        stage_info = cls.CONSULTATION_STAGES.get(current_stage, {})
        
        if "questions" not in stage_info:
            return []
        
        return [q for q in stage_info["questions"] if q not in questions_asked]


class TaskManager:
    """Task Manager for the Strategic Consultant Agent."""
    
    def __init__(self, agent: Agent):
        """Initialize with an Agent instance and set up ADK Runner."""
        logger.info(f"Initializing TaskManager for agent: {agent.name}")
        self.agent = agent
        
        # Initialize ADK services
        self.session_service = InMemorySessionService()
        self.artifact_service = InMemoryArtifactService()
        
        # Create the runner
        self.runner = Runner(
            agent=self.agent,
            app_name=A2A_APP_NAME,
            session_service=self.session_service,
            artifact_service=self.artifact_service
        )
        logger.info(f"ADK Runner initialized for app '{self.runner.app_name}'")

    def get_supabase_client(self) -> Optional[Client]:
        """Initialize and return Supabase client."""
        try:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_ANON_KEY")
            
            if not supabase_url or not supabase_key:
                logger.error("Supabase credentials not found in environment variables")
                return None
            
            return create_client(supabase_url, supabase_key)
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            return None

    async def save_priority_plan_to_db(self, plan_text: str, context: Dict[str, Any], session_id: str) -> bool:
        """Save priority plan to Supabase database with essential fields only."""
        try:
            supabase = self.get_supabase_client()
            if not supabase:
                logger.error("Failed to get Supabase client")
                return False
            
            # Prepare minimal data for database - using same table as engagement plans
            db_data = {
                "email": context.get("email", ""),
                "name": context.get("name", ""),
                "role": context.get("role", ""),
                "department": context.get("department", ""),
                "plan": plan_text,  # Save the full plan text as generated by Alex
                "created_at": datetime.utcnow().isoformat(),
                "consultation_type": "priority_discovery"
            }
            
            # Insert into database (using same table as engagement plans for now)
            result = supabase.table("consultation_data").insert(db_data).execute()

            if result.data:
                logger.info(f"Risk assessment plan saved successfully for user: {context.get('email', 'unknown')}")
                return True
            else:
                logger.error(f"Failed to save risk assessment plan: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Error saving risk assessment plan to database: {e}")
            return False

    async def process_task(self, message: str, context: Dict[str, Any] = None, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Process a strategic consultation request with proper stage tracking."""
        try:
            # Extract context information
            if not context:
                context = {}
            
            user_id = context.get("user_id", "default_user")
            department = context.get("department", "Unknown Department")
            conversation_history = context.get("conversationHistory", [])

            logger.info(f"User ID: {user_id}, Department: {department}, Conversation History: {conversation_history}")

            # Analyze conversation stage using enhanced tracker
            stage_analysis = ConsultationStageTracker.analyze_conversation_stage(message, conversation_history)
            
            # # Build comprehensive system instruction
            # system_instruction = self._build_riley_context(
            #     current_message=message, 
            #     context=context, 
            #     department=department, 
            #     conversation_history=conversation_history,
            #     stage_analysis=stage_analysis
            # )
            
            # Create or generate session
            if not session_id:
                session_id = str(uuid.uuid4())
            
            # Create session
            try:
                await self.session_service.create_session(
                    app_name=A2A_APP_NAME,
                    user_id=user_id,
                    session_id=session_id,
                    state={}
                )
            except Exception as e:
                logger.warning(f"Session creation issue: {e}")
            
            user_name = context.get('name', 'there')
            user_role = context.get('role', 'unknown role')

            # Create user message with comprehensive system instruction
            request_content = adk_types.Content(
                role="user",
                parts=[adk_types.Part(text=f"{conversation_history}\nUser's Name: {user_name}\nUser's Role: {user_role}\nUser's Department: {department}\nCurrent Message: {message}")]
            )

            logger.info(f"CONVERSATION HISTORY: {conversation_history}")

            # Run the agent
            events_async = self.runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=request_content
            )
            
            # Process response
            final_message = "Hello! I'm Riley, your strategic consultant. How can I help you today?"
            
            async for event in events_async:
                if event.is_final_response() and event.content and event.content.role == "model":
                    if event.content.parts and event.content.parts[0].text:
                        final_message = event.content.parts[0].text
                        logger.info(f"Agent response: {final_message}")

                        # Check if plan was generated
                        if "[PLAN_GENERATED]" in final_message:
                            final_message = final_message.replace("[PLAN_GENERATED]", "").strip()
                            
                            # Save plan to database if context and email are available
                            if context and context.get("email"):
                                try:
                                    plan_saved = await self.save_priority_plan_to_db(final_message, context, session_id)
                                    if plan_saved:
                                        logger.info(f"Priority plan saved for user: {context.get('email')}")
                                    else:
                                        logger.error(f"Failed to save priority plan for user: {context.get('email')}")
                                except Exception as save_error:
                                    logger.error(f"Error during plan saving: {save_error}")
                                    plan_saved = False
                            else:
                                logger.warning("No email provided in context - plan not saved to database")


            # Handle special cases
            response_result = await self._handle_special_responses(
                final_message, message, context, user_id, stage_analysis
            )
            
            if response_result:
                return response_result
            
            response_data = {
                "message": final_message,
                "status": "success",
                "session_id": session_id,
                "data": {
                    "conversation_stage": stage_analysis["stage"],
                    "progress": stage_analysis["progress"],
                    "next_action": stage_analysis["next_action"],
                    "department": department,
                    "stage_description": stage_analysis.get("stage_description", "")
                }
            }
            
            return response_data
            
        except Exception as e:
            logger.error(f"Error processing task: {e}")
            return {
                "message": f"I apologize, but I encountered an error while processing your request: {str(e)}",
                "status": "error"
            }
    
    def _build_riley_context(self, current_message: str, context: Dict, department: str, 
                           conversation_history: List[Dict], stage_analysis: Dict) -> str:
        """Build comprehensive context for Riley's response with stage-specific guidance."""
        
        # Extract stakeholder information from context
        user_name = context.get('name', 'there')
        user_role = context.get('role', 'unknown role')
        user_department = context.get('department', department)
        
        # Format conversation history
        formatted_history = self._format_conversation_history(conversation_history)
        
        # Get stage-specific guidance
        stage_guidance = self._get_stage_specific_guidance(stage_analysis)
        
        return f"""
RILEY'S CONSULTATION CONTEXT:

STAKEHOLDER INFORMATION:
- Name: {user_name}
- Role: {user_role}
- Department: {user_department}
- User ID: {context.get('user_id', 'unknown')}

CURRENT CONSULTATION STATUS:
- Stage: {stage_analysis['stage']}
- Progress: {stage_analysis['progress']:.1f}%
- Next Action: {stage_analysis['next_action']}
- Stage Description: {stage_analysis.get('stage_description', '')}
- Questions Asked: {len(stage_analysis['questions_asked'])}
- Questions Remaining in Current Stage: {len(stage_analysis['questions_remaining'])}

CONVERSATION HISTORY:
{formatted_history}

STAGE-SPECIFIC GUIDANCE FOR RILEY:
{stage_guidance}

TAFE NSW CONTEXT TO CONSIDER:
- TAFE NSW is Australia's largest vocational education provider
- Focus on industry-relevant training and student outcomes
- Strategic priorities include digital transformation, industry partnerships, and future skills
- Operates across multiple faculties with diverse departmental needs
- Subject to ASQA requirements and government policy frameworks

RILEY'S RESPONSE GUIDELINES:
1. Use the stakeholder's actual name ({user_name}) in your responses
2. Follow the stage-specific guidance above EXACTLY
3. Ask ONLY ONE question per response during data gathering stages
4. Be systematic and follow the structured consultation process
5. Do NOT skip ahead or provide analysis until ALL context is gathered
6. Keep responses conversational but professionally focused
7. Build on previous conversation threads

CURRENT USER MESSAGE: "{current_message}"

Respond as Riley would, following the stage-specific guidance above:
"""
    
    def _get_stage_specific_guidance(self, stage_analysis: Dict) -> str:
        """Get detailed guidance for Riley based on the current stage."""
        
        stage = stage_analysis['stage']
        next_action = stage_analysis['next_action']
        questions_remaining = stage_analysis['questions_remaining']
        
        guidance_map = {
            "initial_engagement": """
RILEY MUST:
- Welcome them warmly using their actual name
- Acknowledge their role and department
- Start with the first role context question: "How many years have you been in your current position?"
- Do NOT provide any analysis or skip to other sections
            """,
            
            "role_context_gathering": f"""
RILEY MUST:
- Continue with role context questions in EXACT order
- Ask ONE question at a time from remaining questions: {questions_remaining}
- Do NOT proceed to performance data until ALL 5 role context questions are answered
- Do NOT provide analysis yet
- Next specific action: {next_action}
            """,
            
            "performance_data_gathering": f"""
RILEY MUST:
- Ask performance data questions in order
- Remaining questions: {questions_remaining}
- Ask about performance metrics familiarity first, then additional data needs
- Do NOT move to operational challenges until both performance questions are answered
- Next specific action: {next_action}
            """,
            
            "operational_challenges": f"""
RILEY MUST:
- Ask about operational challenges
- Remaining questions: {questions_remaining}
- First ask rating of challenges (1-5 scale), then ask about top 3 pain points
- Do NOT move to strategic priorities until both operational questions are answered
- Next specific action: {next_action}
            """,
            
            "strategic_priorities": f"""
RILEY MUST:
- Ask about strategic vision and priorities
- Remaining questions: {questions_remaining}
- Ask about ideal future state, then investment priorities, then growth opportunities
- Do NOT move to capacity constraints until all strategic questions are answered
- Next specific action: {next_action}
            """,
            
            "capacity_constraints": f"""
RILEY MUST:
- Ask about capacity utilization and constraints
- Remaining questions: {questions_remaining}
- Ask about current capacity, then constraints, then resource requirements
- Do NOT move to risk assessment until all capacity questions are answered
- Next specific action: {next_action}
            """,
            
            "risk_assessment": f"""
RILEY MUST:
- Ask about risks and concerns
- Remaining questions: {questions_remaining}
- Ask about risk ratings, then specific risk concerns
- Do NOT move to success factors until both risk questions are answered
- Next specific action: {next_action}
            """,
            
            "success_factors": f"""
RILEY MUST:
- Ask about critical success factors
- Remaining questions: {questions_remaining}
- Ask what needs to be in place for strategic roadmap success
- Do NOT move to industry context until success factors question is answered
- Next specific action: {next_action}
            """,
            
            "industry_context": f"""
RILEY MUST:
- Ask final context questions
- Remaining questions: {questions_remaining}
- Ask about industry trends, best practices, and anything else they'd like to share
- Do NOT provide analysis until ALL industry context questions are answered
- Next specific action: {next_action}
            """,
            
            "strategic_analysis": """
RILEY MUST NOW PROVIDE COMPREHENSIVE STRATEGIC ANALYSIS:
- ALL context gathering is complete
- Provide strategic analysis with:
  1. Stakeholder Profile Summary
  2. Current State Analysis
  3. Strategic Priority Matrix (High/Low Impact vs High/Low Effort)
  4. Risk Assessment Summary
  5. Resource Allocation Recommendations
  6. Strategic Roadmap Outline
  7. Next Steps and Implementation
- Use frameworks like Eisenhower Matrix, Impact/Effort grid
- Score priorities on importance and urgency (1-10)
- Be comprehensive and actionable
            """,
            
            "consultation_complete": """
RILEY MUST:
- Acknowledge the thanks/farewell graciously
- Provide a brief, warm closing statement
- NOT repeat analysis or action plans
- Keep response short and professional
- Thank them for their time and input
            """
        }
        
        return guidance_map.get(stage, "Continue systematic consultation process")
    
    def _format_conversation_history(self, history: List[Dict]) -> str:
        """Format conversation history for context."""
        if not history:
            return "No previous conversation history."
        
        formatted = []
        for msg in history[-5:]:  # Last 5 messages for context
            sender = "USER" if msg.get('sender') == 'user' else "MODEL"
            message = msg.get('message', '')
            formatted.append(f"{sender}: {message}")
        
        return "\n".join(formatted)
    
    async def _handle_special_responses(self, response: str, user_message: str, 
                                      context: Dict, user_id: str, stage_analysis: Dict) -> Optional[Dict]:
        """Handle special response cases."""
        
        # Check if analysis was completed
        if stage_analysis['stage'] == 'strategic_analysis' and any(phrase in response.lower() for phrase in [
            "strategic analysis", "priority matrix", "roadmap", "recommendations"
        ]):
            logger.info("Strategic analysis provided")
            return {
                "message": response,
                "status": "success",
                "data": {
                    "analysis_completed": True,
                    "stage": "STRATEGIC_ANALYSIS_COMPLETE",
                    "progress": 100
                }
            }
        
        # Handle consultation completion
        if stage_analysis['stage'] == 'consultation_complete':
            return {
                "message": response,
                "status": "success",
                "data": {
                    "consultation_complete": True,
                    "stage": "CONSULTATION_COMPLETE",
                    "progress": 100
                }
            }
        
        return None




class TaskManager_CapacityAgent:
    """Minimal Task Manager for running tasks with the Capacity Analyst Agent."""

    def __init__(self, agent):
        logger.info(f"Initializing TaskManager for agent: CapacityAgentApp")
        self.agent = agent

        # Initialize services
        self.session_service = InMemorySessionService()
        self.artifact_service = InMemoryArtifactService()

        # Runner
        self.runner = Runner(
            agent=self.agent,
            app_name="CapacityAgentApp",
            session_service=self.session_service,
            artifact_service=self.artifact_service
        )
        logger.info(f"ADK Runner initialized for app '{self.runner.app_name}'")

    def get_supabase_client(self) -> Optional[Client]:
        """Initialize and return Supabase client."""
        try:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_ANON_KEY")
            
            if not supabase_url or not supabase_key:
                logger.error("Supabase credentials not found in environment variables")
                return None
            
            return create_client(supabase_url, supabase_key)
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            return None

    async def save_capacity_plan_to_db(self, plan_text: str, context: Dict[str, Any], session_id: str) -> bool:
        """Save capacity plan to Supabase database with essential fields only."""
        try:
            supabase = self.get_supabase_client()
            if not supabase:
                logger.error("Failed to get Supabase client")
                return False
            
            # Prepare minimal data for database - using same table as engagement plans
            db_data = {
                "email": context.get("email", ""),
                "name": context.get("name", ""),
                "role": context.get("role", ""),
                "department": context.get("department", ""),
                "plan": plan_text,  # Save the full plan text as generated by Alex
                "created_at": datetime.utcnow().isoformat(),
                "consultation_type": "capacity_assessment"
            }
            
            # Insert into database (using same table as engagement plans for now)
            result = supabase.table("consultation_data").insert(db_data).execute()
            
            if result.data:
                logger.info(f"Risk assessment plan saved successfully for user: {context.get('email', 'unknown')}")
                return True
            else:
                logger.error(f"Failed to save risk assessment plan: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Error saving risk assessment plan to database: {e}")
            return False

    async def process_task(self, message: str, context: Optional[Dict[str, Any]] = None, session_id: Optional[str] = None) -> Dict[str, Any]:
        try:
            # Create session if not exists
            # Create or generate session
            if not session_id:
                session_id = str(uuid.uuid4())

            conversation_history = context.get("conversationHistory", [])

            logger.info(f"CONVERSATION HISTORY: {conversation_history}")

            # Create session
            try:
                await self.session_service.create_session(
                    app_name="CapacityAgentApp", # Use the correct app_name for CapacityAgent
                    user_id="default_user",
                    session_id=session_id,
                    state={}
                )
            except Exception as e:
                logger.warning(f"Session creation issue for CapacityAgent: {e}")

            # Build request
            request_content = adk_types.Content(
                role="user",
                parts=[adk_types.Part(text=f"{conversation_history}")]
            )
            # Run agent
            events_async = self.runner.run_async(
                user_id="default_user",
                session_id=session_id,
                new_message=request_content
            )

            final_message = "No response generated."

            async for event in events_async:
                if event.is_final_response() and event.content and event.content.role == "model":
                    if event.content.parts and event.content.parts[0].text:
                        final_message = event.content.parts[0].text
                        logger.info(f"Agent response: {final_message}")

                        # Check if plan was generated
                        if "[PLAN_GENERATED]" in final_message:
                            final_message = final_message.replace("[PLAN_GENERATED]", "").strip()
                            
                            # Save plan to database if context and email are available
                            if context and context.get("email"):
                                try:
                                    plan_saved = await self.save_capacity_plan_to_db(final_message, context, session_id)
                                    if plan_saved:
                                        logger.info(f"Capacity plan saved for user: {context.get('email')}")
                                    else:
                                        logger.error(f"Failed to save capacity plan for user: {context.get('email')}")
                                except Exception as save_error:
                                    logger.error(f"Error during plan saving: {save_error}")
                                    plan_saved = False
                            else:
                                logger.warning("No email provided in context - plan not saved to database")


            return {
                "message": final_message,
                "status": "success",
                "session_id": session_id
            }

        except Exception as e:
            logger.error(f"Error processing task: {e}")
            return {
                "message": f"Error: {str(e)}",
                "status": "error"
            }


class TaskManager_RiskAgent:
    """Minimal Task Manager for running tasks with the Risk Analyst Agent."""

    def __init__(self, agent):
        logger.info(f"Initializing TaskManager for agent: RiskAgentApp")
        self.agent = agent

        # Initialize services
        self.session_service = InMemorySessionService()
        self.artifact_service = InMemoryArtifactService()

        # Runner
        self.runner = Runner(
            agent=self.agent,
            app_name="RiskAgentApp",
            session_service=self.session_service,
            artifact_service=self.artifact_service
        )
        logger.info(f"ADK Runner initialized for app '{self.runner.app_name}'")
    
    
    def get_supabase_client(self) -> Optional[Client]:
        """Initialize and return Supabase client."""
        try:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_ANON_KEY")
            
            if not supabase_url or not supabase_key:
                logger.error("Supabase credentials not found in environment variables")
                return None
            
            return create_client(supabase_url, supabase_key)
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            return None

    async def save_risk_plan_to_db(self, plan_text: str, context: Dict[str, Any], session_id: str) -> bool:
        """Save risk assessment plan to Supabase database with essential fields only."""
        try:
            supabase = self.get_supabase_client()
            if not supabase:
                logger.error("Failed to get Supabase client")
                return False
            
            # Prepare minimal data for database - using same table as engagement plans
            db_data = {
                "email": context.get("email", ""),
                "name": context.get("name", ""),
                "role": context.get("role", ""),
                "department": context.get("department", ""),
                "plan": plan_text,  # Save the full plan text as generated by Alex
                "created_at": datetime.utcnow().isoformat(),
                "consultation_type": "risk_register"
            }
            
            # Insert into database (using same table as engagement plans for now)
            result = supabase.table("consultation_data").insert(db_data).execute()
            
            if result.data:
                logger.info(f"Risk assessment plan saved successfully for user: {context.get('email', 'unknown')}")
                return True
            else:
                logger.error(f"Failed to save risk assessment plan: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Error saving risk assessment plan to database: {e}")
            return False

    async def process_task(self, message: str, context: Optional[Dict[str, Any]] = None, session_id: Optional[str] = None) -> Dict[str, Any]:
        try:
            # Create session if not exists
            # Create or generate session
            if not session_id:
                session_id = str(uuid.uuid4())

            conversation_history = context.get("conversationHistory", [])

            logger.info(f"CONVERSATION HISTORY: {conversation_history}")
            logger.info(f"CONTEXT: {context}")  # Add this to debug context

            # Create session
            try:
                await self.session_service.create_session(
                    app_name="RiskAgentApp", # Use the correct app_name for RiskAgent
                    user_id="default_user",
                    session_id=session_id,
                    state={}
                )
            except Exception as e:
                logger.warning(f"Session creation issue for RiskAgent: {e}")

            # Build request
            request_content = adk_types.Content(
                role="user",
                parts=[adk_types.Part(text=f"{conversation_history}")]
            )
            # Run agent
            events_async = self.runner.run_async(
                user_id="default_user",
                session_id=session_id,
                new_message=request_content
            )

            final_message = "No response generated."
            plan_saved = False

            async for event in events_async:
                if event.is_final_response() and event.content and event.content.role == "model":
                    if event.content.parts and event.content.parts[0].text:
                        final_message = event.content.parts[0].text
                        logger.info(f"Agent response: {final_message}")

                        if "[PLAN_GENERATED]" in final_message:
                            final_message = final_message.replace("[PLAN_GENERATED]", "").strip()
                            
                            # Save plan to database if context and email are available
                            if context and context.get("email"):
                                try:
                                    plan_saved = await self.save_risk_plan_to_db(final_message, context, session_id)
                                    if plan_saved:
                                        logger.info(f"Risk assessment plan saved for user: {context.get('email')}")
                                    else:
                                        logger.error(f"Failed to save risk assessment plan for user: {context.get('email')}")
                                except Exception as save_error:
                                    logger.error(f"Error during plan saving: {save_error}")
                                    plan_saved = False
                            else:
                                logger.warning("No email provided in context - plan not saved to database")
                                logger.warning(f"Context received: {context}")  # Debug log

            return {
                "message": final_message,
                "status": "success",
                "session_id": session_id,
                "plan_saved": plan_saved,
                "data": {
                    "plan_generated": "[PLAN_GENERATED]" in (event.content.parts[0].text if event.content and event.content.parts else ""),
                    "plan_saved": plan_saved
                }
            }

        except Exception as e:
            logger.error(f"Error processing task: {e}")
            return {
                "message": f"Error: {str(e)}",
                "status": "error",
                "plan_saved": False
            }


class TaskManager_EngagementAgent:
    """Minimal Task Manager for running tasks with the Engagement Planner Agent."""

    def __init__(self, agent):
        logger.info(f"Initializing TaskManager for agent: EngagementPlannerApp")
        self.agent = agent

        # Initialize services
        self.session_service = InMemorySessionService()
        self.artifact_service = InMemoryArtifactService()

        # Runner
        self.runner = Runner(
            agent=self.agent,
            app_name="EngagementPlannerApp",
            session_service=self.session_service,
            artifact_service=self.artifact_service
        )
        logger.info(f"ADK Runner initialized for app '{self.runner.app_name}'")

    def get_supabase_client(self) -> Optional[Client]:
        """Initialize and return Supabase client."""
        try:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_ANON_KEY")
            
            if not supabase_url or not supabase_key:
                logger.error("Supabase credentials not found in environment variables")
                return None
            
            return create_client(supabase_url, supabase_key)
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            return None

    async def save_plan_to_db(self, plan_text: str, context: Dict[str, Any], session_id: str) -> bool:
        """Save engagement plan to Supabase database with essential fields only."""
        try:
            supabase = self.get_supabase_client()
            if not supabase:
                logger.error("Failed to get Supabase client")
                return False
            
            # Prepare minimal data for database
            db_data = {
                "email": context.get("email", ""),
                "name": context.get("name", ""),
                "role": context.get("role", ""),
                "department": context.get("department", ""),
                "plan": plan_text,  # Save the full plan text as generated by Jordan
                "created_at": datetime.utcnow().isoformat(),
                "consultation_type": "engagement_planning"
            }
            
            # Insert into database
            result = supabase.table("consultation_data").insert(db_data).execute()

            if result.data:
                consultation_id = result.data[0]['id']
                logger.info(f"Engagement plan saved successfully for user: {context.get('email', 'unknown')} with ID: {consultation_id}")
                return consultation_id
            else:
                logger.error(f"Failed to save engagement plan: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Error saving engagement plan to database: {e}")
            return False

    async def save_chat_history_to_db(self, conversation_history: List[Dict], consultation_id: int, email: str) -> bool:
        """Save conversation chat history to Supabase database."""
        try:
            supabase = self.get_supabase_client()
            if not supabase:
                logger.error("Failed to get Supabase client for chat history")
                return False
            
            if not conversation_history:
                logger.warning("No conversation history to save")
                return True
            
            # Prepare chat history data for batch insert
            chat_records = []
            for index, msg in enumerate(conversation_history):
                sender = msg.get('sender', 'unknown')
                message = msg.get('message', '')
                timestamp = msg.get('timestamp', datetime.utcnow().isoformat())
                
                # Map sender types (frontend might use different naming)
                if sender in ['user', 'human']:
                    sender = 'user'
                elif sender in ['ai', 'bot', 'agent', 'jordan']:
                    sender = 'ai'
                else:
                    sender = 'user'  # Default fallback
                
                chat_record = {
                    "consultation_id": consultation_id,
                    "email": email,
                    "sender": sender,
                    "message": message,
                    "message_order": index + 1,
                    "created_at": timestamp
                }
                chat_records.append(chat_record)
            
            # Batch insert chat history
            if chat_records:
                result = supabase.table("chat_history").insert(chat_records).execute()
                
                if result.data:
                    logger.info(f"Chat history saved successfully: {len(chat_records)} messages for consultation {consultation_id}")
                    return True
                else:
                    logger.error(f"Failed to save chat history: {result}")
                    return False
            else:
                logger.warning("No valid chat records to save")
                return True
                
        except Exception as e:
            logger.error(f"Error saving chat history to database: {e}")
            return False

    async def process_task(self, message: str, context: Optional[Dict[str, Any]] = None, session_id: Optional[str] = None) -> Dict[str, Any]:
        try:
            # Create session if not exists
            if not session_id:
                session_id = str(uuid.uuid4())

            conversation_history = context.get("conversationHistory", []) if context else []

            logger.info(f"CONVERSATION HISTORY: {conversation_history}")

            # Create session
            try:
                await self.session_service.create_session(
                    app_name="EngagementPlannerApp",
                    user_id="default_user",
                    session_id=session_id,
                    state={}
                )
            except Exception as e:
                logger.warning(f"Session creation issue for EngagementPlanner: {e}")

            # Build request
            request_content = adk_types.Content(
                role="user",
                parts=[adk_types.Part(text=f"{conversation_history}")]
            )
            
            # Run agent
            events_async = self.runner.run_async(
                user_id="default_user",
                session_id=session_id,
                new_message=request_content
            )

            final_message = "No response generated."
            plan_saved = False
            consultation_id = None

            async for event in events_async:
                if event.is_final_response() and event.content and event.content.role == "model":
                    if event.content.parts and event.content.parts[0].text:
                        final_message = event.content.parts[0].text
                        logger.info(f"Agent response: {final_message}")
                        
                        # Check if plan was generated
                        if "[PLAN_GENERATED]" in final_message:
                            final_message = final_message.replace("[PLAN_GENERATED]", "").strip()
                            
                            # Save plan to database if context and email are available
                            if context and context.get("email"):
                                try:
                                    consultation_id = await self.save_plan_to_db(final_message, context, session_id)
                                    if consultation_id:
                                        plan_saved = True
                                        logger.info(f"Engagement plan saved for user: {context.get('email')} with ID: {consultation_id}")
                                        
                                        # Save chat history after plan is saved successfully
                                        chat_saved = await self.save_chat_history_to_db(
                                            conversation_history, 
                                            consultation_id, 
                                            context.get("email")
                                        )
                                        
                                        if chat_saved:
                                            logger.info(f"Chat history saved successfully for consultation {consultation_id}")
                                        else:
                                            logger.error(f"Failed to save chat history for consultation {consultation_id}")
                                    else:
                                        logger.error(f"Failed to save engagement plan for user: {context.get('email')}")
                                        plan_saved = False
                                except Exception as save_error:
                                    logger.error(f"Error during plan/chat saving: {save_error}")
                                    plan_saved = False
                            else:
                                logger.warning("No email provided in context - plan and chat history not saved to database")

            return {
                "message": final_message,
                "status": "success",
                "session_id": session_id,
                "plan_saved": plan_saved,
                "consultation_id": consultation_id,
                "data": {
                    "plan_generated": "[PLAN_GENERATED]" in (event.content.parts[0].text if event.content and event.content.parts else ""),
                    "plan_saved": plan_saved,
                    "chat_history_saved": plan_saved  # Chat history is saved when plan is saved
                }
            }

        except Exception as e:
            logger.error(f"Error processing task: {e}")
            return {
                "message": f"Error: {str(e)}",
                "status": "error",
                "plan_saved": False,
                "consultation_id": None
            }


class TaskManager_EngagementAgent:
    """Minimal Task Manager for running tasks with the Engagement Planner Agent."""

    def __init__(self, agent):
        logger.info(f"Initializing TaskManager for agent: EngagementPlannerApp")
        self.agent = agent

        # Initialize services
        self.session_service = InMemorySessionService()
        self.artifact_service = InMemoryArtifactService()

        # Runner
        self.runner = Runner(
            agent=self.agent,
            app_name="EngagementPlannerApp",
            session_service=self.session_service,
            artifact_service=self.artifact_service
        )
        logger.info(f"ADK Runner initialized for app '{self.runner.app_name}'")

    def get_supabase_client(self) -> Optional[Client]:
        """Initialize and return Supabase client."""
        try:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_ANON_KEY")
            
            if not supabase_url or not supabase_key:
                logger.error("Supabase credentials not found in environment variables")
                return None
            
            return create_client(supabase_url, supabase_key)
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            return None

    async def save_plan_to_db(self, plan_text: str, context: Dict[str, Any], session_id: str) -> bool:
        """Save engagement plan to Supabase database with essential fields only."""
        try:
            supabase = self.get_supabase_client()
            if not supabase:
                logger.error("Failed to get Supabase client")
                return False
            
            # Prepare minimal data for database
            db_data = {
                "email": context.get("email", ""),
                "name": context.get("name", ""),
                "role": context.get("role", ""),
                "department": context.get("department", ""),
                "plan": plan_text,  # Save the full plan text as generated by Jordan
                "created_at": datetime.utcnow().isoformat(),
                "consultation_type": "engagement_planning"
            }
            
            # Insert into database
            result = supabase.table("consultation_data").insert(db_data).execute()

            if result.data:
                consultation_id = result.data[0]['id']
                logger.info(f"Engagement plan saved successfully for user: {context.get('email', 'unknown')} with ID: {consultation_id}")
                return consultation_id
            else:
                logger.error(f"Failed to save engagement plan: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Error saving engagement plan to database: {e}")
            return False

    async def save_chat_history_to_db(self, conversation_history: List[Dict], consultation_id: int, email: str) -> bool:
        """Save conversation chat history to Supabase database."""
        try:
            supabase = self.get_supabase_client()
            if not supabase:
                logger.error("Failed to get Supabase client for chat history")
                return False
            
            if not conversation_history:
                logger.warning("No conversation history to save")
                return True
            
            # Prepare chat history data for batch insert
            chat_records = []
            for index, msg in enumerate(conversation_history):
                sender = msg.get('sender', 'unknown')
                message = msg.get('message', '')
                timestamp = msg.get('timestamp', datetime.utcnow().isoformat())
                
                # Map sender types (frontend might use different naming)
                if sender in ['user', 'human']:
                    sender = 'user'
                elif sender in ['ai', 'bot', 'agent', 'jordan']:
                    sender = 'ai'
                else:
                    sender = 'user'  # Default fallback
                
                chat_record = {
                    "consultation_id": consultation_id,
                    "email": email,
                    "sender": sender,
                    "message": message,
                    "message_order": index + 1,
                    "created_at": timestamp
                }
                chat_records.append(chat_record)
            
            # Batch insert chat history
            if chat_records:
                result = supabase.table("chat_history").insert(chat_records).execute()
                
                if result.data:
                    logger.info(f"Chat history saved successfully: {len(chat_records)} messages for consultation {consultation_id}")
                    return True
                else:
                    logger.error(f"Failed to save chat history: {result}")
                    return False
            else:
                logger.warning("No valid chat records to save")
                return True
                
        except Exception as e:
            logger.error(f"Error saving chat history to database: {e}")
            return False

    async def process_task(self, message: str, context: Optional[Dict[str, Any]] = None, session_id: Optional[str] = None) -> Dict[str, Any]:
        try:
            # Create session if not exists
            if not session_id:
                session_id = str(uuid.uuid4())

            conversation_history = context.get("conversationHistory", []) if context else []

            logger.info(f"CONVERSATION HISTORY: {conversation_history}")

            # Create session
            try:
                await self.session_service.create_session(
                    app_name="EngagementPlannerApp",
                    user_id="default_user",
                    session_id=session_id,
                    state={}
                )
            except Exception as e:
                logger.warning(f"Session creation issue for EngagementPlanner: {e}")

            # Build request
            request_content = adk_types.Content(
                role="user",
                parts=[adk_types.Part(text=f"{conversation_history}")]
            )
            
            # Run agent
            events_async = self.runner.run_async(
                user_id="default_user",
                session_id=session_id,
                new_message=request_content
            )

            final_message = "No response generated."
            plan_saved = False
            consultation_id = None

            async for event in events_async:
                if event.is_final_response() and event.content and event.content.role == "model":
                    if event.content.parts and event.content.parts[0].text:
                        final_message = event.content.parts[0].text
                        logger.info(f"Agent response: {final_message}")
                        
                        # Check if plan was generated
                        if "[PLAN_GENERATED]" in final_message:
                            final_message = final_message.replace("[PLAN_GENERATED]", "").strip()
                            
                            # Save plan to database if context and email are available
                            if context and context.get("email"):
                                try:
                                    consultation_id = await self.save_plan_to_db(final_message, context, session_id)
                                    if consultation_id:
                                        plan_saved = True
                                        logger.info(f"Engagement plan saved for user: {context.get('email')} with ID: {consultation_id}")
                                        
                                        # Save chat history after plan is saved successfully
                                        chat_saved = await self.save_chat_history_to_db(
                                            conversation_history, 
                                            consultation_id, 
                                            context.get("email")
                                        )
                                        
                                        if chat_saved:
                                            logger.info(f"Chat history saved successfully for consultation {consultation_id}")
                                        else:
                                            logger.error(f"Failed to save chat history for consultation {consultation_id}")
                                    else:
                                        logger.error(f"Failed to save engagement plan for user: {context.get('email')}")
                                        plan_saved = False
                                except Exception as save_error:
                                    logger.error(f"Error during plan/chat saving: {save_error}")
                                    plan_saved = False
                            else:
                                logger.warning("No email provided in context - plan and chat history not saved to database")

            return {
                "message": final_message,
                "status": "success",
                "session_id": session_id,
                "plan_saved": plan_saved,
                "consultation_id": consultation_id,
                "data": {
                    "plan_generated": "[PLAN_GENERATED]" in (event.content.parts[0].text if event.content and event.content.parts else ""),
                    "plan_saved": plan_saved,
                    "chat_history_saved": plan_saved  # Chat history is saved when plan is saved
                }
            }

        except Exception as e:
            logger.error(f"Error processing task: {e}")
            return {
                "message": f"Error: {str(e)}",
                "status": "error",
                "plan_saved": False,
                "consultation_id": None
            }
        

class TaskManager_ExternalStakeholderAgent:
    """Minimal Task Manager for running tasks with the External Stakeholder Agent."""

    def __init__(self, agent):
        logger.info(f"Initializing TaskManager for agent: ExternalStakeholderAgent")
        self.agent = agent

        # Initialize services
        self.session_service = InMemorySessionService()
        self.artifact_service = InMemoryArtifactService()

        # Runner
        self.runner = Runner(
            agent=self.agent,
            app_name="ExternalStakeholderAgentApp",
            session_service=self.session_service,
            artifact_service=self.artifact_service
        )
        logger.info(f"ADK Runner initialized for app '{self.runner.app_name}'")

    def get_supabase_client(self) -> Optional[Client]:
        """Initialize and return Supabase client."""
        try:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_ANON_KEY")
            
            if not supabase_url or not supabase_key:
                logger.error("Supabase credentials not found in environment variables")
                return None
            
            return create_client(supabase_url, supabase_key)
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            return None

    async def save_plan_to_db(self, plan_text: str, context: Dict[str, Any], session_id: str) -> bool:
        """Save Exter plan to Supabase database with essential fields only."""
        try:
            supabase = self.get_supabase_client()
            if not supabase:
                logger.error("Failed to get Supabase client")
                return False
            
            # Prepare minimal data for database
            db_data = {
                "email": context.get("email", ""),
                "name": context.get("name", ""),
                "role": context.get("role", ""),
                "department": context.get("department", ""),
                "plan": plan_text,  # Save the full plan text as generated by Jordan
                "created_at": datetime.utcnow().isoformat(),
                "consultation_type": "external_stakeholder"
            }
            
            # Insert into database
            result = supabase.table("consultation_data").insert(db_data).execute()

            if result.data:
                consultation_id = result.data[0]['id']
                logger.info(f"External Stakeholder plan saved successfully for user: {context.get('email', 'unknown')} with ID: {consultation_id}")
                return consultation_id
            else:
                logger.error(f"Failed to save external stakeholder plan: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Error saving external stakeholder plan to database: {e}")
            return False

    async def save_chat_history_to_db(self, conversation_history: List[Dict], consultation_id: int, email: str) -> bool:
        """Save conversation chat history to Supabase database."""
        try:
            supabase = self.get_supabase_client()
            if not supabase:
                logger.error("Failed to get Supabase client for chat history")
                return False
            
            if not conversation_history:
                logger.warning("No conversation history to save")
                return True
            
            # Prepare chat history data for batch insert
            chat_records = []
            for index, msg in enumerate(conversation_history):
                sender = msg.get('sender', 'unknown')
                message = msg.get('message', '')
                timestamp = msg.get('timestamp', datetime.utcnow().isoformat())
                
                # Map sender types (frontend might use different naming)
                if sender in ['user', 'human']:
                    sender = 'user'
                elif sender in ['ai', 'bot', 'agent', 'jordan']:
                    sender = 'ai'
                else:
                    sender = 'user'  # Default fallback
                
                chat_record = {
                    "consultation_id": consultation_id,
                    "email": email,
                    "sender": sender,
                    "message": message,
                    "message_order": index + 1,
                    "created_at": timestamp
                }
                chat_records.append(chat_record)
            
            # Batch insert chat history
            if chat_records:
                result = supabase.table("chat_history").insert(chat_records).execute()
                
                if result.data:
                    logger.info(f"Chat history saved successfully: {len(chat_records)} messages for consultation {consultation_id}")
                    return True
                else:
                    logger.error(f"Failed to save chat history: {result}")
                    return False
            else:
                logger.warning("No valid chat records to save")
                return True
                
        except Exception as e:
            logger.error(f"Error saving chat history to database: {e}")
            return False

    async def process_task(self, message: str, context: Optional[Dict[str, Any]] = None, session_id: Optional[str] = None) -> Dict[str, Any]:
        try:
            # Create session if not exists
            if not session_id:
                session_id = str(uuid.uuid4())

            conversation_history = context.get("conversationHistory", []) if context else []

            logger.info(f"CONVERSATION HISTORY: {conversation_history}")

            # Create session
            try:
                await self.session_service.create_session(
                    app_name="ExternalStakeholderAgentApp",
                    user_id="default_user",
                    session_id=session_id,
                    state={}
                )
            except Exception as e:
                logger.warning(f"Session creation issue for ExternalStakeholderAgent: {e}")

            # Build request
            request_content = adk_types.Content(
                role="user",
                parts=[adk_types.Part(text=f"{conversation_history}")]
            )
            
            # Run agent
            events_async = self.runner.run_async(
                user_id="default_user",
                session_id=session_id,
                new_message=request_content
            )

            final_message = "No response generated."
            plan_saved = False
            consultation_id = None

            async for event in events_async:
                if event.is_final_response() and event.content and event.content.role == "model":
                    if event.content.parts and event.content.parts[0].text:
                        final_message = event.content.parts[0].text
                        logger.info(f"Agent response: {final_message}")
                        
                        # Check if plan was generated
                        if "[PLAN_GENERATED]" in final_message:
                            final_message = final_message.replace("[PLAN_GENERATED]", "").strip()
                            
                            # Save plan to database if context and email are available
                            if context and context.get("email"):
                                try:
                                    consultation_id = await self.save_plan_to_db(final_message, context, session_id)
                                    if consultation_id:
                                        plan_saved = True
                                        logger.info(f"Engagement plan saved for user: {context.get('email')} with ID: {consultation_id}")
                                        
                                        # Save chat history after plan is saved successfully
                                        chat_saved = await self.save_chat_history_to_db(
                                            conversation_history, 
                                            consultation_id, 
                                            context.get("email")
                                        )
                                        
                                        if chat_saved:
                                            logger.info(f"Chat history saved successfully for consultation {consultation_id}")
                                        else:
                                            logger.error(f"Failed to save chat history for consultation {consultation_id}")
                                    else:
                                        logger.error(f"Failed to save external stakeholder plan for user: {context.get('email')}")
                                        plan_saved = False
                                except Exception as save_error:
                                    logger.error(f"Error during plan/chat saving: {save_error}")
                                    plan_saved = False
                            else:
                                logger.warning("No email provided in context - plan and chat history not saved to database")

            return {
                "message": final_message,
                "status": "success",
                "session_id": session_id,
                "plan_saved": plan_saved,
                "consultation_id": consultation_id,
                "data": {
                    "plan_generated": "[PLAN_GENERATED]" in (event.content.parts[0].text if event.content and event.content.parts else ""),
                    "plan_saved": plan_saved,
                    "chat_history_saved": plan_saved  # Chat history is saved when plan is saved
                }
            }

        except Exception as e:
            logger.error(f"Error processing task: {e}")
            return {
                "message": f"Error: {str(e)}",
                "status": "error",
                "plan_saved": False,
                "consultation_id": None
            }

         
# class TaskManager_DeliveryStaffAgent:
#     """Minimal Task Manager for running tasks with the Delivery Staff Agent."""
#     def __init__(self, agent):
#         logger.info(f"Initializing TaskManager for agent: DeliveryStaffAgent")
#         self.agent = agent

#         # Initialize services
#         self.session_service = InMemorySessionService()
#         self.artifact_service = InMemoryArtifactService()

#         # Runner
#         self.runner = Runner(
#             agent=self.agent,
#             app_name="DeliveryStaffAgentApp",
#             session_service=self.session_service,
#             artifact_service=self.artifact_service
#         )
#         logger.info(f"ADK Runner initialized for app '{self.runner.app_name}'")

#     def get_supabase_client(self) -> Optional[Client]:
#         """Initialize and return Supabase client."""
#         try:
#             supabase_url = os.getenv("SUPABASE_URL")
#             supabase_key = os.getenv("SUPABASE_ANON_KEY")
            
#             if not supabase_url or not supabase_key:
#                 logger.error("Supabase credentials not found in environment variables")
#                 return None
            
#             return create_client(supabase_url, supabase_key)
#         except Exception as e:
#             logger.error(f"Failed to initialize Supabase client: {e}")
#             return None

#     async def save_plan_to_db(self, plan_text: str, context: Dict[str, Any], session_id: str) -> bool:
#         """Save Exter plan to Supabase database with essential fields only."""
#         try:
#             supabase = self.get_supabase_client()
#             if not supabase:
#                 logger.error("Failed to get Supabase client")
#                 return False
            
#             # Prepare minimal data for database
#             db_data = {
#                 "email": context.get("email", ""),
#                 "name": context.get("name", ""),
#                 "role": context.get("role", ""),
#                 "department": context.get("department", ""),
#                 "plan": plan_text,  # Save the full plan text as generated by Jordan
#                 "created_at": datetime.utcnow().isoformat(),
#                 "consultation_type": "delivery_staff"
#             }
            
#             # Insert into database
#             result = supabase.table("consultation_data").insert(db_data).execute()

#             if result.data:
#                 consultation_id = result.data[0]['id']
#                 logger.info(f"Delivery Staff plan saved successfully for user: {context.get('email', 'unknown')} with ID: {consultation_id}")
#                 return consultation_id
#             else:
#                 logger.error(f"Failed to save delivery staff plan: {result}")
#                 return False
                
#         except Exception as e:
#             logger.error(f"Error saving delivery staff plan to database: {e}")
#             return False

#     async def save_chat_history_to_db(self, conversation_history: List[Dict], consultation_id: int, email: str) -> bool:
#         """Save conversation chat history to Supabase database."""
#         try:
#             supabase = self.get_supabase_client()
#             if not supabase:
#                 logger.error("Failed to get Supabase client for chat history")
#                 return False
            
#             if not conversation_history:
#                 logger.warning("No conversation history to save")
#                 return True
            
#             # Prepare chat history data for batch insert
#             chat_records = []
#             for index, msg in enumerate(conversation_history):
#                 sender = msg.get('sender', 'unknown')
#                 message = msg.get('message', '')
#                 timestamp = msg.get('timestamp', datetime.utcnow().isoformat())
                
#                 # Map sender types (frontend might use different naming)
#                 if sender in ['user', 'human']:
#                     sender = 'user'
#                 elif sender in ['ai', 'bot', 'agent', 'jordan']:
#                     sender = 'ai'
#                 else:
#                     sender = 'user'  # Default fallback
                
#                 chat_record = {
#                     "consultation_id": consultation_id,
#                     "email": email,
#                     "sender": sender,
#                     "message": message,
#                     "message_order": index + 1,
#                     "created_at": timestamp
#                 }
#                 chat_records.append(chat_record)
            
#             # Batch insert chat history
#             if chat_records:
#                 result = supabase.table("chat_history").insert(chat_records).execute()
                
#                 if result.data:
#                     logger.info(f"Chat history saved successfully: {len(chat_records)} messages for consultation {consultation_id}")
#                     return True
#                 else:
#                     logger.error(f"Failed to save chat history: {result}")
#                     return False
#             else:
#                 logger.warning("No valid chat records to save")
#                 return True
                
#         except Exception as e:
#             logger.error(f"Error saving chat history to database: {e}")
#             return False

#     async def process_task(self, message: str, context: Optional[Dict[str, Any]] = None, session_id: Optional[str] = None) -> Dict[str, Any]:
#         try:
#             # Create session if not exists
#             if not session_id:
#                 session_id = str(uuid.uuid4())

#             conversation_history = context.get("conversationHistory", []) if context else []

#             logger.info(f"CONVERSATION HISTORY: {conversation_history}")

#             # Create session
#             try:
#                 await self.session_service.create_session(
#                     app_name="DeliveryStaffAgentApp",
#                     user_id="default_user",
#                     session_id=session_id,
#                     state={}
#                 )
#             except Exception as e:
#                 logger.warning(f"Session creation issue for DeliveryStaffAgent: {e}")

#             # Build request
#             request_content = adk_types.Content(
#                 role="user",
#                 parts=[adk_types.Part(text=f"{conversation_history}")]
#             )
            
#             # Run agent
#             events_async = self.runner.run_async(
#                 user_id="default_user",
#                 session_id=session_id,
#                 new_message=request_content
#             )

#             final_message = "No response generated."
#             plan_saved = False
#             consultation_id = None

#             async for event in events_async:
#                 if event.is_final_response() and event.content and event.content.role == "model":
#                     if event.content.parts and event.content.parts[0].text:
#                         final_message = event.content.parts[0].text
#                         logger.info(f"Agent response: {final_message}")
                        
#                         # Check if plan was generated
#                         if "[PLAN_GENERATED]" in final_message:
#                             final_message = final_message.replace("[PLAN_GENERATED]", "").strip()
                            
#                             # Save plan to database if context and email are available
#                             if context and context.get("email"):
#                                 try:
#                                     consultation_id = await self.save_plan_to_db(final_message, context, session_id)
#                                     if consultation_id:
#                                         plan_saved = True
#                                         logger.info(f"Delivery Staff plan saved for user: {context.get('email')} with ID: {consultation_id}")

#                                         # Save chat history after plan is saved successfully
#                                         chat_saved = await self.save_chat_history_to_db(
#                                             conversation_history, 
#                                             consultation_id, 
#                                             context.get("email")
#                                         )
                                        
#                                         if chat_saved:
#                                             logger.info(f"Chat history saved successfully for consultation {consultation_id}")
#                                         else:
#                                             logger.error(f"Failed to save chat history for consultation {consultation_id}")
#                                     else:
#                                         logger.error(f"Failed to save external stakeholder plan for user: {context.get('email')}")
#                                         plan_saved = False
#                                 except Exception as save_error:
#                                     logger.error(f"Error during plan/chat saving: {save_error}")
#                                     plan_saved = False
#                             else:
#                                 logger.warning("No email provided in context - plan and chat history not saved to database")

#             return {
#                 "message": final_message,
#                 "status": "success",
#                 "session_id": session_id,
#                 "plan_saved": plan_saved,
#                 "consultation_id": consultation_id,
#                 "data": {
#                     "plan_generated": "[PLAN_GENERATED]" in (event.content.parts[0].text if event.content and event.content.parts else ""),
#                     "plan_saved": plan_saved,
#                     "chat_history_saved": plan_saved  # Chat history is saved when plan is saved
#                 }
#             }

#         except Exception as e:
#             logger.error(f"Error processing task: {e}")
#             return {
#                 "message": f"Error: {str(e)}",
#                 "status": "error",
#                 "plan_saved": False,
#                 "consultation_id": None
#             }

