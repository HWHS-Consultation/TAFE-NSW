import React, { useState, useEffect, useRef } from 'react';
import { AIService } from '../services/aiService';
import { DataService } from '../services/supabase';
import { Send, Download, Save, Users, BarChart3, TrendingUp } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const CapacityAssessment = ({ onBack }) => {
  const [currentStep, setCurrentStep] = useState('intro');
  const [stakeholderInfo, setStakeholderInfo] = useState({
    name: '',
    role: '',
    department: '',
    email: ''
  });
  const [conversationHistory, setConversationHistory] = useState([]);
  const [userResponse, setUserResponse] = useState('');
  const [capacityAnalysis, setCapacityAnalysis] = useState({
    currentCapacity: null,
    optimalCapacity: null,
    gaps: [],
    opportunities: [],
    recommendations: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null); // Add session tracking
  
  const messagesEndRef = useRef(null); // Create ref for auto-scroll
  const messagesContainerRef = useRef(null);

  const aiService = new AIService();
  const dataService = new DataService();

  // Message formatting component
  const FormattedMessage = ({ message }) => {
    if (!message) return null;

    // Convert escaped \n to real newlines
    const text = message.replace(/\\n/g, '\n');

    // Function to handle inline formatting: bold (**text**) and italic (*text*)
    const formatInlineText = (str) => {
      const parts = str.split(/(\*\*.*?\*\*|\*.*?\*)/g);
      return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={index}>{part.slice(1, -1)}</em>;
        }
        return part;
      });
    };

    // Split into paragraphs by double newlines
    const paragraphs = text.split(/\n\n+/);

    return (
      <div className="space-y-3">
        {paragraphs.map((para, pIndex) => {
          // Detect numbered heading (e.g., "1. Address Instructor Staffing Gap:")
          const headingMatch = para.match(/^(\d+)\.\s+(.+)/s);
          if (headingMatch) {
            const number = headingMatch[1];
            const restText = headingMatch[2];

            // Split restText by sub-bullets (* or -)
            const lines = restText.split('\n').map(l => l.trim()).filter(Boolean);
            const mainText = [];
            const bullets = [];

            lines.forEach(line => {
              if (line.startsWith('*') || line.startsWith('-')) {
                bullets.push(line.replace(/^[\*\-\s]+/, ''));
              } else {
                mainText.push(line);
              }
            });

            return (
              <div key={pIndex} className="mb-4">
                <p className="font-bold text-gray-900 mb-2">
                  {number}. {formatInlineText(mainText.join(' '))}
                </p>
                {bullets.length > 0 && (
                  <ul className="list-disc ml-6 space-y-1">
                    {bullets.map((b, idx) => (
                      <li key={idx} className="text-sm">
                        {formatInlineText(b)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }

          // Detect normal bulleted list paragraph
          if (para.startsWith('*') || para.startsWith('-')) {
            const items = para.split('\n').map(l => l.replace(/^[\*\-\s]+/, '').trim());
            return (
              <ul key={pIndex} className="list-disc ml-6 space-y-1">
                {items.map((item, idx) => (
                  <li key={idx} className="text-sm">{formatInlineText(item)}</li>
                ))}
              </ul>
            );
          }

          // Regular paragraph
          return (
            <p key={pIndex} className="leading-relaxed text-gray-900">
              {formatInlineText(para)}
            </p>
          );
        })}
      </div>
    );
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversationHistory]);

  const startConversation = async () => {
    if (!stakeholderInfo.name || !stakeholderInfo.role || !stakeholderInfo.department) {
      alert('Please fill in all required fields');
      return;
    }

    setCurrentStep('conversation');
    setIsLoading(true);

    // Create initial context for the capacity agent
    const context = {
      user_id: stakeholderInfo.email || stakeholderInfo.name.toLowerCase().replace(/\s+/g, '_'),
      department: stakeholderInfo.department,
      role: stakeholderInfo.role,
      name: stakeholderInfo.name,
      conversationHistory: []
    };

    try {
      // Send initial message to capacity agent
      const aiResult = await aiService.generateResponse(
        `Hello, I'm ${stakeholderInfo.name}, ${stakeholderInfo.role} from ${stakeholderInfo.department}. I'd like to start a capacity assessment.`,
        context,
        'morgan'
      );

      setSessionId(aiResult.sessionId);

      const welcomeMessage = {
        sender: 'ai',
        message: aiResult.response,
        timestamp: new Date()
      };
      setConversationHistory([welcomeMessage]);

    } catch (error) {
      console.error('Error starting conversation:', error);
      const fallbackMessage = {
        sender: 'ai',
        message: `Hi ${stakeholderInfo.name}! I'm Morgan, your capacity analysis specialist. I'll help you assess your current capacity and identify optimization opportunities for ${stakeholderInfo.department}. Let's start by understanding your current situation. Can you tell me about your team size and the main functions your department handles?`,
        timestamp: new Date()
      };
      setConversationHistory([fallbackMessage]);
    }

    setIsLoading(false);
  };

  const handleUserResponse = async () => {
    setUserResponse('');
    if (!userResponse.trim() || isLoading) return;

    setIsLoading(true);
    
    const newConversation = [
      ...conversationHistory,
      { sender: 'user', message: userResponse, timestamp: new Date() }
    ];
    setConversationHistory(newConversation);

    try {
      // Create context with conversation history for capacity agent
      const context = {
        user_id: stakeholderInfo.email || stakeholderInfo.name.toLowerCase().replace(/\s+/g, '_'),
        department: stakeholderInfo.department,
        role: stakeholderInfo.role,
        name: stakeholderInfo.name,
        conversationHistory: newConversation.map(msg => ({
          sender: msg.sender,
          message: msg.message
        }))
      };

      const aiResult = await aiService.generateResponse(
        userResponse,
        context,
        'morgan'
      );

      // Update session ID if provided
      if (aiResult.sessionId) {
        setSessionId(aiResult.sessionId);
      }

      const updatedConversation = [
        ...newConversation,
        {
          sender: 'ai',
          message: aiResult.response,
          timestamp: new Date(),
          insights: aiResult.insights,
          data: aiResult.data
        }
      ];
      setConversationHistory(updatedConversation);

      // Analyze capacity from conversation
      analyzeCapacity(userResponse, aiResult.response, aiResult.data);

    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorConversation = [
        ...newConversation,
        {
          sender: 'ai',
          message: "I apologize, but I'm having trouble processing your response right now. Could you please try again?",
          timestamp: new Date()
        }
      ];
      setConversationHistory(errorConversation);
    }

    setUserResponse('');
    setIsLoading(false);
  };

  const analyzeCapacity = (userMessage, aiResponse, agentData = null) => {
    const combined = userMessage + ' ' + aiResponse;
    const analysis = { ...capacityAnalysis };

    // Use agent data if available from the backend
    if (agentData && agentData.conversation_stage) {
      // The backend agent provides structured data about the assessment stage
      console.log('Assessment stage:', agentData.conversation_stage);
    }

    // Extract capacity insights from conversation content
    if (combined.toLowerCase().includes('understaffed') || combined.toLowerCase().includes('overloaded')) {
      const newGap = {
        area: 'Staffing Levels',
        description: 'Current staffing levels appear insufficient for workload demands',
        impact: 'high',
        priority: 9
      };
      
      // Avoid duplicates
      if (!analysis.gaps.some(gap => gap.area === newGap.area)) {
        analysis.gaps.push(newGap);
      }
    }

    if (combined.toLowerCase().includes('training') || combined.toLowerCase().includes('skills')) {
      const newOpportunity = {
        area: 'Skills Development',
        description: 'Opportunity to enhance staff capabilities through targeted training',
        potential: 'medium',
        effort: 'low'
      };
      
      if (!analysis.opportunities.some(opp => opp.area === newOpportunity.area)) {
        analysis.opportunities.push(newOpportunity);
      }
    }

    if (combined.toLowerCase().includes('process') || combined.toLowerCase().includes('workflow')) {
      const newRecommendation = {
        title: 'Process Optimization',
        description: 'Review and streamline current workflows for efficiency gains',
        timeframe: '3-6 months',
        impact: 'medium'
      };
      
      if (!analysis.recommendations.some(rec => rec.title === newRecommendation.title)) {
        analysis.recommendations.push(newRecommendation);
      }
    }

    // Additional capacity analysis based on Morgan's specializations
    if (combined.toLowerCase().includes('resource allocation') || combined.toLowerCase().includes('utilization')) {
      const newOpportunity = {
        area: 'Resource Optimization',
        description: 'Opportunities identified for better resource allocation and utilization',
        potential: 'high',
        effort: 'medium'
      };
      
      if (!analysis.opportunities.some(opp => opp.area === newOpportunity.area)) {
        analysis.opportunities.push(newOpportunity);
      }
    }

    setCapacityAnalysis(analysis);
  };

  const exportData = () => {
    // Get the last AI response from Morgan
    const lastAiMessage = conversationHistory
      .filter(msg => msg.sender === 'ai')
      .pop();

    if (!lastAiMessage) {
      alert('No assessment data to export yet.');
      return;
    }

    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Capacity Assessment Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .header { border-bottom: 2px solid #16a34a; padding-bottom: 10px; margin-bottom: 20px; }
          .stakeholder-info { background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; color: black; }
          .assessment-content { margin-bottom: 20px; color: black; }
          h1 { color: #16a34a; }
          h2 { color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
          .timestamp { color: #6b7280; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>TAFE NSW Capacity Assessment Report</h1>
          <p class="timestamp">Generated on: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="stakeholder-info">
          <h2>Stakeholder Information</h2>
          <p><strong>Name:</strong> ${stakeholderInfo.name}</p>
          <p><strong>Role:</strong> ${stakeholderInfo.role}</p>
          <p><strong>Department:</strong> ${stakeholderInfo.department}</p>
          ${stakeholderInfo.email ? `<p><strong>Email:</strong> ${stakeholderInfo.email}</p>` : ''}
        </div>
        
        <div class="assessment-content">
          <h2>Alex's Assessment</h2>
          <div>${lastAiMessage.message.replace(/\n/g, '<br>')}</div>
        </div>
      </body>
      </html>
    `;

    html2pdf().from(htmlContent).set({
      margin: 10,
      filename: 'TAFE-NSW-Capacity-Assessment.pdf',
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    }).save();
    
  };

  if (currentStep === 'intro') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Users className="w-8 h-8 text-green-600" />
            Capacity Assessment
          </h1>
          
          <div className="mb-8">
            <p className="text-gray-600 mb-4">
              This consultation will help assess your department's current capacity and identify optimization opportunities. 
              Morgan, our AI specialist, will guide you through a comprehensive analysis.
            </p>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-900 mb-2">Assessment Areas:</h3>
              <ul className="text-green-800 text-sm space-y-1">
                <li>• Current staffing levels and workload distribution</li>
                <li>• Skills gaps and development opportunities</li>
                <li>• Process efficiency and workflow optimization</li>
                <li>• Resource allocation and utilization</li>
              </ul>
            </div>
          </div>

          <div className="text-black grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={stakeholderInfo.name}
                onChange={(e) => setStakeholderInfo({...stakeholderInfo, name: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter your full name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role/Position *
              </label>
              <input
                type="text"
                value={stakeholderInfo.role}
                onChange={(e) => setStakeholderInfo({...stakeholderInfo, role: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g., Department Manager, Team Leader"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department *
              </label>
              <select
                value={stakeholderInfo.department}
                onChange={(e) => setStakeholderInfo({...stakeholderInfo, department: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select Department</option>
                <option value="Health & Community Services">Health & Community Services</option>
                <option value="Human Services">Human Services</option>
                <option value="Nursing & Midwifery">Nursing & Midwifery</option>
                <option value="Allied Health">Allied Health</option>
                <option value="Mental Health">Mental Health</option>
                <option value="Aged Care">Aged Care</option>
                <option value="Disability Services">Disability Services</option>
                <option value="Administration">Administration</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={stakeholderInfo.email}
                onChange={(e) => setStakeholderInfo({...stakeholderInfo, email: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="your.email@tafe.nsw.edu.au"
              />
            </div>
          </div>

          <button
            onClick={startConversation}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium"
          >
            Start Capacity Assessment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Analysis with Morgan
              </h2>
            </div>
            
            <div 
              className="h-96 overflow-y-auto p-4 space-y-4" 
              ref={messagesContainerRef}
            >
              {conversationHistory.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                    msg.sender === 'user' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    {msg.sender === 'ai' && (
                      <div className="text-xs text-gray-600 mb-2 font-medium">Morgan</div>
                    )}
                    <div className="text-sm">
                      {msg.sender === 'ai' ? (
                        <FormattedMessage message={msg.message} />
                      ) : (
                        msg.message
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                      <span className="text-sm text-gray-600">Morgan is analyzing...</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Auto-scroll target */}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="p-4 text-black border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userResponse}
                  onChange={(e) => setUserResponse(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUserResponse()}
                  placeholder="Describe your capacity challenges..."
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  onClick={handleUserResponse}
                  disabled={isLoading || !userResponse.trim()}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Panel */}
        <div className="space-y-6">
          {/* Capacity Gaps */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Capacity Gaps</h3>
            </div>
            <div className="p-4">
              {capacityAnalysis.gaps.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  Capacity gaps will be identified through our analysis.
                </p>
              ) : (
                <div className="space-y-3">
                  {capacityAnalysis.gaps.map((gap, index) => (
                    <div key={index} className="border border-red-200 rounded-lg p-3 bg-red-50">
                      <h4 className="font-medium text-red-900 mb-1">{gap.area}</h4>
                      <p className="text-sm text-red-700 mb-2">{gap.description}</p>
                      <div className="flex justify-between text-xs">
                        <span className={`px-2 py-1 rounded ${
                          gap.impact === 'high' ? 'bg-red-200 text-red-800' : 
                          gap.impact === 'medium' ? 'bg-yellow-200 text-yellow-800' : 
                          'bg-green-200 text-green-800'
                        }`}>
                          {gap.impact} impact
                        </span>
                        <span className="text-gray-600">Priority: {gap.priority}/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Opportunities */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Opportunities</h3>
            </div>
            <div className="p-4">
              {capacityAnalysis.opportunities.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  Optimization opportunities will appear here.
                </p>
              ) : (
                <div className="space-y-3">
                  {capacityAnalysis.opportunities.map((opp, index) => (
                    <div key={index} className="border border-green-200 rounded-lg p-3 bg-green-50">
                      <h4 className="font-medium text-green-900 mb-1">{opp.area}</h4>
                      <p className="text-sm text-green-700 mb-2">{opp.description}</p>
                      <div className="flex justify-between text-xs">
                        <span className={`px-2 py-1 rounded ${
                          opp.potential === 'high' ? 'bg-green-200 text-green-800' : 
                          'bg-yellow-200 text-yellow-800'
                        }`}>
                          {opp.potential} potential
                        </span>
                        <span className="text-gray-600">{opp.effort} effort</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Actions</h3>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={exportData}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4" />
                Export Assessment
              </button>
              
              <button
                onClick={onBack}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CapacityAssessment;
