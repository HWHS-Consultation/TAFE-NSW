import OpenAI from 'openai';

let openai;
// const BACKEND_URL = "http://127.0.0.1:8004";
// const BACKEND_URL = "https://tafe-nsw-consultation-platform-backend.onrender.com";
const BACKEND_URL = "https://tafe-nsw-production-2d23.up.railway.app";

export class AIService {
  async sendPriorityDiscoveryMessage(userMessage, context) { // Add context parameter
    try {
      const payload = { 
        message: userMessage, 
        context: context 
      };
      
      // Add session_id if available
      if (context && context.session_id) {
        payload.session_id = context.session_id;
      }

      const response = await fetch(`${BACKEND_URL}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        response: data.message,
        insights: [], // Backend agent doesn't provide insights in this format
        followUpQuestions: [], // Backend agent doesn't provide follow-up questions in this format
        data: data.data,
        sessionId: data.session_id,
        interactive_question_data: data.interactive_question_data || null // Pass through interactive data
      };
    } catch (error) {
      console.error('Backend API Error:', error);
      return {
        response: "I'm having trouble connecting to the priority discovery agent right now. Please try again later.",
        insights: [],
        followUpQuestions: []
      };
    }
  }

  async generateResponse(userMessage, context, persona = 'riley', options = {}) {
    if (persona === 'riley') {
      return this.sendPriorityDiscoveryMessage(userMessage, context); // Remove streaming logic
    }
    
    if (persona === 'morgan') {
      return this.sendCapacityAssessmentMessage(userMessage, context);
    }
    
    if (persona === 'alex') {
      return this.sendRiskAssessmentMessage(userMessage, context);
    }
    
    if (persona === 'jordan') {
      return this.sendEngagementPlanningMessage(userMessage, context);
    }

    // Original OpenAI logic for other personas
    if (!openai) { // Initialize OpenAI only if not already initialized
      openai = new OpenAI({
        apiKey: process.env.REACT_APP_OPENAI_API_KEY,
        // dangerouslyAllowBrowser: true // Removed as it's not a standard or recommended practice
      });
    }

    const systemPrompt = this.getPersonaPrompt(persona, context);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const aiResponse = response.choices[0].message.content;
      const insights = this.extractInsights(userMessage, aiResponse);

      return {
        response: aiResponse,
        insights: insights,
        followUpQuestions: this.generateFollowUp(userMessage, context)
      };
    } catch (error) {
      console.error('AI API Error:', error);
      return {
        response: "I'm having trouble connecting right now. Could you please try rephrasing your response?",
        insights: [],
        followUpQuestions: []
      };
    }
  }

  async sendCapacityAssessmentMessage(userMessage, context) {
    try {
      const response = await fetch(`${BACKEND_URL}/capacity_agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage, context: context }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        response: data.message,
        insights: [], // Backend agent doesn't provide insights in this format
        followUpQuestions: [], // Backend agent doesn't provide follow-up questions in this format
        data: data.data,
        sessionId: data.session_id
      };
    } catch (error) {
      console.error('Capacity Agent API Error:', error);
      return {
        response: "I'm having trouble connecting to the capacity assessment agent right now. Please try again later.",
        insights: [],
        followUpQuestions: []
      };
    }
  }

  async sendRiskAssessmentMessage(userMessage, context) {
    try {
      const response = await fetch(`${BACKEND_URL}/risk_agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage, context: context }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        response: data.message,
        insights: [], // Backend agent doesn't provide insights in this format
        followUpQuestions: [], // Backend agent doesn't provide follow-up questions in this format
        data: data.data,
        sessionId: data.session_id
      };
    } catch (error) {
      console.error('Risk Agent API Error:', error);
      return {
        response: "I'm having trouble connecting to the risk assessment agent right now. Please try again later.",
        insights: [],
        followUpQuestions: []
      };
    }
  }

  async sendEngagementPlanningMessage(userMessage, context) {
    try {
      const response = await fetch(`${BACKEND_URL}/engagement_agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage, context: context }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        response: data.message,
        insights: [], // Backend agent doesn't provide insights in this format
        followUpQuestions: [], // Backend agent doesn't provide follow-up questions in this format
        data: data.data,
        sessionId: data.session_id
      };
    } catch (error) {
      console.error('Engagement Agent API Error:', error);
      return {
        response: "I'm having trouble connecting to the engagement planning agent right now. Please try again later.",
        insights: [],
        followUpQuestions: []
      };
    }
  }

  async sendDeliveryStaffMessage(userMessage, context) {
    try {
      const payload = { 
        message: userMessage, 
        context: context 
      };
      
      // Add session_id if available
      if (context && context.sessionId) {
        payload.session_id = context.sessionId;
      }

      const response = await fetch(`${BACKEND_URL}/delivery_staff_agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        response: data.message,
        insights: [], // Backend agent doesn't provide insights in this format
        followUpQuestions: [], // Backend agent doesn't provide follow-up questions in this format
        data: data.data,
        sessionId: data.session_id
      };
    } catch (error) {
      console.error('Delivery Staff Agent API Error:', error);
      return {
        response: "I'm having trouble connecting to the delivery staff agent right now. Please try again later.",
        insights: [],
        followUpQuestions: []
      };
    }
  }

  async sendExternalStakeholderMessage(userMessage, context) {
    try {
      const payload = { 
        message: userMessage, 
        context: context 
      };
      
      // Add session_id if available
      if (context && context.sessionId) {
        payload.session_id = context.sessionId;
      }

      const response = await fetch(`${BACKEND_URL}/external_stakeholder_agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        response: data.message,
        insights: [], // Backend agent doesn't provide insights in this format
        followUpQuestions: [], // Backend agent doesn't provide follow-up questions in this format
        data: data.data,
        sessionId: data.session_id
      };
    } catch (error) {
      console.error('External Stakeholder Agent API Error:', error);
      return {
        response: "I'm having trouble connecting to the external stakeholder agent right now. Please try again later.",
        insights: [],
        followUpQuestions: []
      };
    }
  }

  getPersonaPrompt(persona, context) {
    const personas = {
      riley: `You are Riley, a strategic priority consultant for TAFE NSW.
You help identify and prioritise strategic initiatives for the Health, Wellbeing & Human Services faculty.
Be warm, strategic, and ask thoughtful follow-up questions.
The stakeholder is a ${context.role} in ${context.department}.
Use Australian English and focus on practical, implementable solutions.`,

      morgan: `You are Morgan, a capacity analysis specialist for TAFE NSW.
You help assess current capacity and identify optimization opportunities.
Be analytical, data-driven, and thorough in your analysis.
The stakeholder is a ${context.role} in ${context.department}.`,

      alex: `You are Alex, a risk assessment specialist for TAFE NSW.
You help identify, assess, and mitigate operational and strategic risks.
Be thorough, systematic, and focus on practical risk management strategies.
The stakeholder is a ${context.role} in ${context.department}.`,

      jordan: `You are Jordan, a stakeholder engagement specialist for TAFE NSW.
You help develop comprehensive engagement strategies and communication plans.
Be collaborative, inclusive, and focus on building strong stakeholder relationships.
The stakeholder is a ${context.role} in ${context.department}.`,

      riva: `You are Riva, a delivery specialist for TAFE NSW.
You help with project delivery planning, resource allocation, timeline management, and risk identification.
Be professional, practical, and focused on operational delivery solutions.
The stakeholder is a ${context.role} in ${context.department}.
Use Australian English and focus on actionable delivery strategies.`
    };

    return personas[persona] || personas.riley;
  }

  extractInsights(userMessage, aiResponse) {
    const insights = [];
    const message = userMessage.toLowerCase();

    // Simple keyword-based insights
    if (message.includes('staff') || message.includes('recruitment')) {
      insights.push({
        type: 'pattern',
        message: 'Staffing concerns are commonly reported across departments in the health sector.',
        confidence: 0.8
      });
    }

    if (message.includes('student') || message.includes('placement')) {
      insights.push({
        type: 'opportunity',
        message: 'Student placement challenges often indicate partnership development opportunities.',
        confidence: 0.7
      });
    }

    if (message.includes('technology') || message.includes('system')) {
      insights.push({
        type: 'trend',
        message: 'Technology infrastructure is a recurring theme in stakeholder feedback.',
        confidence: 0.75
      });
    }

    return insights;
  }

  generateFollowUp(userMessage, context) {
    const followUps = [
      "Can you tell me more about the specific challenges you're facing?",
      "What would an ideal solution look like from your perspective?",
      "Are there any resource constraints we should consider?",
      "How does this impact your day-to-day operations?",
      "What support would you need to address this effectively?"
    ];

    return [followUps[Math.floor(Math.random() * followUps.length)]];
  }
}

