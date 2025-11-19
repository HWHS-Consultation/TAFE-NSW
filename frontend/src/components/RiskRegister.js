import React, { useState, useEffect, useRef } from 'react'; // Import useRef and useEffect
import { AIService } from '../services/aiService';
import { DataService } from '../services/supabase';
import { Send, Download, Save, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const RiskRegister = ({ onBack }) => {
  const [currentStep, setCurrentStep] = useState('intro');
  const [stakeholderInfo, setStakeholderInfo] = useState({
    name: '',
    role: '',
    department: '',
    email: ''
  });
  const [conversationHistory, setConversationHistory] = useState([]);
  const [userResponse, setUserResponse] = useState('');
  const [identifiedRisks, setIdentifiedRisks] = useState([]);
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

    // Create initial context for the risk agent
    const context = {
      user_id: stakeholderInfo.email || stakeholderInfo.name.toLowerCase().replace(/\s+/g, '_'),
      department: stakeholderInfo.department,
      role: stakeholderInfo.role,
      name: stakeholderInfo.name,
      conversationHistory: []
    };

    try {
      // Send initial message to risk agent
      const aiResult = await aiService.generateResponse(
        `Hello, I'm ${stakeholderInfo.name}, ${stakeholderInfo.role} from ${stakeholderInfo.department}. I'd like to start a risk assessment.`,
        context,
        'alex'
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
        message: `Hello ${stakeholderInfo.name}! I'm Alex, your risk assessment specialist. I'll help you identify, assess, and develop mitigation strategies for operational and strategic risks in ${stakeholderInfo.department}. Let's begin by discussing any concerns or potential risks you're currently aware of in your department. What areas keep you awake at night?`,
        timestamp: new Date()
      };
      setConversationHistory([fallbackMessage]);
    }

    setIsLoading(false);
  };

  const handleUserResponse = async () => {
    if (!userResponse.trim() || isLoading) return;

    setIsLoading(true);
    
    const newConversation = [
      ...conversationHistory,
      { sender: 'user', message: userResponse, timestamp: new Date() }
    ];
    setConversationHistory(newConversation);

    try {
      // Create context with conversation history for risk agent
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
        'alex'
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

      // Extract risks from conversation
      extractRisks(userResponse, aiResult.response, aiResult.data);

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

  const extractRisks = (userMessage, aiResponse, agentData = null) => {
    const combined = userMessage + ' ' + aiResponse;
    const risks = [];

    // Use agent data if available from the backend
    if (agentData && agentData.conversation_stage) {
      console.log('Risk assessment stage:', agentData.conversation_stage);
    }

    // Risk detection patterns
    if (combined.toLowerCase().includes('staff') && (combined.toLowerCase().includes('shortage') || combined.toLowerCase().includes('turnover'))) {
      risks.push({
        title: 'Staff Retention Risk',
        description: 'High staff turnover or shortage affecting service delivery',
        category: 'Human Resources',
        likelihood: 7,
        impact: 8,
        riskScore: 56,
        mitigationStrategies: [
          'Implement staff retention programs',
          'Improve working conditions and benefits',
          'Develop succession planning'
        ],
        owner: stakeholderInfo.department,
        status: 'identified'
      });
    }

    if (combined.toLowerCase().includes('compliance') || combined.toLowerCase().includes('regulation')) {
      risks.push({
        title: 'Regulatory Compliance Risk',
        description: 'Risk of non-compliance with industry regulations',
        category: 'Compliance',
        likelihood: 5,
        impact: 9,
        riskScore: 45,
        mitigationStrategies: [
          'Regular compliance audits',
          'Staff training on regulations',
          'Update policies and procedures'
        ],
        owner: stakeholderInfo.department,
        status: 'identified'
      });
    }

    if (combined.toLowerCase().includes('technology') || combined.toLowerCase().includes('system')) {
      risks.push({
        title: 'Technology Failure Risk',
        description: 'Risk of system outages affecting operations',
        category: 'Technology',
        likelihood: 6,
        impact: 7,
        riskScore: 42,
        mitigationStrategies: [
          'Implement backup systems',
          'Regular system maintenance',
          'Disaster recovery planning'
        ],
        owner: stakeholderInfo.department,
        status: 'identified'
      });
    }

    // Add new risks to existing ones (avoid duplicates)
    const existingTitles = identifiedRisks.map(r => r.title);
    const newRisks = risks.filter(r => !existingTitles.includes(r.title));
    
    if (newRisks.length > 0) {
      setIdentifiedRisks([...identifiedRisks, ...newRisks]);
    }
  };

  const getRiskLevel = (score) => {
    if (score >= 60) return { level: 'Critical', color: 'bg-red-600', textColor: 'text-red-800', bgColor: 'bg-red-100' };
    if (score >= 40) return { level: 'High', color: 'bg-orange-500', textColor: 'text-orange-800', bgColor: 'bg-orange-100' };
    if (score >= 20) return { level: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-800', bgColor: 'bg-yellow-100' };
    return { level: 'Low', color: 'bg-green-500', textColor: 'text-green-800', bgColor: 'bg-green-100' };
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
          <h1>TAFE NSW Risk Assessment Report</h1>
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
          <h2>Morgan's Assessment</h2>
          <div>${lastAiMessage.message.replace(/\n/g, '<br>')}</div>
        </div>
      </body>
      </html>
    `;

    html2pdf().from(htmlContent).set({
      margin: 10,
      filename: 'TAFE-NSW-Risk-Assessment.pdf',
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    }).save();
    
  };

  if (currentStep === 'intro') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Shield className="w-8 h-8 text-red-600" />
            Risk Register & Assessment
          </h1>
          
          <div className="mb-8">
            <p className="text-gray-600 mb-4">
              This consultation will help identify, assess, and develop mitigation strategies for operational and strategic risks. 
              Alex, our AI risk specialist, will guide you through a comprehensive risk analysis.
            </p>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-medium text-red-900 mb-2">Risk Assessment Areas:</h3>
              <ul className="text-red-800 text-sm space-y-1">
                <li>• Operational risks and potential failures</li>
                <li>• Compliance and regulatory risks</li>
                <li>• Strategic and financial risks</li>
                <li>• Mitigation strategies and contingency planning</li>
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="your.email@tafe.nsw.edu.au"
              />
            </div>
          </div>

          <button
            onClick={startConversation}
            className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 font-medium"
          >
            Start Risk Assessment
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
                <AlertTriangle className="w-5 h-5" />
                Risk Assessment with Alex
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
                      ? 'bg-red-600 text-white' 
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    {msg.sender === 'ai' && (
                      <div className="text-xs text-gray-600 mb-2 font-medium">Alex</div>
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
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      <span className="text-sm text-gray-600">Alex is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Auto-scroll target */}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="text-black p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userResponse}
                  onChange={(e) => setUserResponse(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUserResponse()}
                  placeholder="Describe potential risks or concerns..."
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  onClick={handleUserResponse}
                  disabled={isLoading || !userResponse.trim()}
                  className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Register Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Risk Register</h3>
            </div>
            <div className="p-4">
              {identifiedRisks.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  Risks will be identified and catalogued here as we discuss potential concerns.
                </p>
              ) : (
                <div className="space-y-4">
                  {identifiedRisks.map((risk, index) => {
                    const riskLevel = getRiskLevel(risk.riskScore);
                    return (
                      <div key={index} className={`border rounded-lg p-4 ${riskLevel.bgColor}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900">{risk.title}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${riskLevel.color} text-white`}>
                            {riskLevel.level}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{risk.description}</p>
                        
                        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                          <div>
                            <span className="text-gray-500">Likelihood:</span>
                            <div className="bg-gray-200 rounded-full h-2 mt-1">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{width: `${risk.likelihood * 10}%`}}
                              ></div>
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Impact:</span>
                            <div className="bg-gray-200 rounded-full h-2 mt-1">
                              <div 
                                className="bg-red-600 h-2 rounded-full" 
                                style={{width: `${risk.impact * 10}%`}}
                              ></div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-xs">
                          <span className="text-gray-500">Category:</span>
                          <span className="ml-1 px-2 py-1 bg-gray-200 text-gray-700 rounded">
                            {risk.category}
                          </span>
                        </div>
                        
                        {risk.mitigationStrategies.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-medium text-gray-700 mb-1">Mitigation Strategies:</div>
                            <ul className="text-xs text-gray-600 space-y-1">
                              {risk.mitigationStrategies.map((strategy, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                  {strategy}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Actions Panel */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Actions</h3>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={exportData}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Download className="w-4 h-4" />
                Export Risk Register
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

export default RiskRegister;
