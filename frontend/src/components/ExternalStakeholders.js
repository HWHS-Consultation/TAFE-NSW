import React, { useState, useEffect, useRef } from 'react'; // Import useRef and useEffect
import { AIService } from '../services/aiService';
import { DataService } from '../services/supabase';
import { Send, Download, Save, MessageSquare, Users, Calendar, Target } from 'lucide-react';

const ExternalStakeholders = ({ onBack }) => {
  const [currentStep, setCurrentStep] = useState('intro');
  const [stakeholderInfo, setStakeholderInfo] = useState({
    name: '',
    role: '',
    department: '',
    email: ''
  });
  const [conversationHistory, setConversationHistory] = useState([]);
  const [userResponse, setUserResponse] = useState('');
  const [engagementPlan, setEngagementPlan] = useState({
    stakeholders: [],
    strategies: [],
    timeline: [],
    communications: []
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

  // Auto-scroll to bottom when conversation updates
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

    // Create initial context for the external stakeholder agent
    const context = {
      user_id: stakeholderInfo.email || stakeholderInfo.name.toLowerCase().replace(/\s+/g, '_'),
      department: stakeholderInfo.department,
      role: stakeholderInfo.role,
      name: stakeholderInfo.name,
      conversationHistory: []
    };

    try {
      // Send initial message to external stakeholder agent
      const aiResult = await aiService.sendExternalStakeholderMessage(
        `Hello, I'm ${stakeholderInfo.name}, ${stakeholderInfo.role} from ${stakeholderInfo.department}. I'd like to start external stakeholder engagement planning.`,
        context
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
        message: `G'day ${stakeholderInfo.name}! I'm Josh, your external stakeholder engagement specialist. I'm here to help you develop strategies for effective collaboration with partners outside TAFE NSW. Let's begin by understanding your key external relationships. What types of external stakeholders do you currently work with?`,
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
      // Create context with conversation history for external stakeholder agent
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

      const aiResult = await aiService.sendExternalStakeholderMessage(
        userResponse,
        context
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

      // Extract engagement plan elements
      extractEngagementElements(userResponse, aiResult.response, aiResult.data);

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

  const extractEngagementElements = (userMessage, aiResponse, agentData = null) => {
    const combined = userMessage + ' ' + aiResponse;
    const plan = { ...engagementPlan };

    // Use agent data if available from the backend
    if (agentData && agentData.conversation_stage) {
      console.log('External stakeholder engagement stage:', agentData.conversation_stage);
    }

    // Extract stakeholder groups
    if (combined.toLowerCase().includes('student') || combined.toLowerCase().includes('learner')) {
      const existing = plan.stakeholders.find(s => s.group === 'Students');
      if (!existing) {
        plan.stakeholders.push({
          group: 'Students',
          influence: 'high',
          interest: 'high',
          approach: 'Direct consultation and feedback sessions',
          priority: 'primary'
        });
      }
    }

    if (combined.toLowerCase().includes('staff') || combined.toLowerCase().includes('teacher')) {
      const existing = plan.stakeholders.find(s => s.group === 'Academic Staff');
      if (!existing) {
        plan.stakeholders.push({
          group: 'Academic Staff',
          influence: 'high',
          interest: 'medium',
          approach: 'Professional development sessions and workshops',
          priority: 'primary'
        });
      }
    }

    if (combined.toLowerCase().includes('industry') || combined.toLowerCase().includes('employer')) {
      const existing = plan.stakeholders.find(s => s.group === 'Industry Partners');
      if (!existing) {
        plan.stakeholders.push({
          group: 'Industry Partners',
          influence: 'medium',
          interest: 'high',
          approach: 'Partnership meetings and industry forums',
          priority: 'secondary'
        });
      }
    }

    // Extract engagement strategies
    if (combined.toLowerCase().includes('survey') || combined.toLowerCase().includes('feedback')) {
      const existing = plan.strategies.find(s => s.method === 'Surveys & Feedback');
      if (!existing) {
        plan.strategies.push({
          method: 'Surveys & Feedback',
          description: 'Online surveys and feedback collection mechanisms',
          audience: 'All stakeholders',
          frequency: 'Quarterly',
          resources: 'Survey platform, analysis tools'
        });
      }
    }

    if (combined.toLowerCase().includes('workshop') || combined.toLowerCase().includes('meeting')) {
      const existing = plan.strategies.find(s => s.method === 'Workshops & Meetings');
      if (!existing) {
        plan.strategies.push({
          method: 'Workshops & Meetings',
          description: 'Face-to-face consultation sessions',
          audience: 'Key stakeholders',
          frequency: 'Monthly',
          resources: 'Meeting facilities, facilitation support'
        });
      }
    }

    // Extract communication channels
    if (combined.toLowerCase().includes('email') || combined.toLowerCase().includes('newsletter')) {
      const existing = plan.communications.find(c => c.channel === 'Email Communications');
      if (!existing) {
        plan.communications.push({
          channel: 'Email Communications',
          purpose: 'Regular updates and announcements',
          frequency: 'Bi-weekly',
          audience: 'All stakeholders'
        });
      }
    }

    setEngagementPlan(plan);
  };

  const getInfluenceColor = (influence) => {
    switch (influence) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInterestColor = (interest) => {
    switch (interest) {
      case 'high': return 'bg-blue-100 text-blue-800';
      case 'medium': return 'bg-purple-100 text-purple-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const exportData = () => {
    // Get the last AI response from Josh
    const lastAiMessage = conversationHistory
      .filter(msg => msg.sender === 'ai')
      .pop();

    if (!lastAiMessage) {
      alert('No assessment data to export yet.');
      return;
    }

    const exportData = {
      stakeholder: stakeholderInfo,
      consultation_type: 'external_stakeholder',
      conversation: conversationHistory,
      engagement_plan: engagementPlan,
      session_id: sessionId,
      agent_type: 'josh_external_specialist',
      export_date: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `engagement-plan-${stakeholderInfo.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  if (currentStep === 'intro') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-purple-600" />
            External Stakeholder Engagement
          </h1>
          
          <div className="mb-8">
            <p className="text-gray-600 mb-4">
              This consultation will help you develop effective strategies for engaging with external stakeholders.
              Josh, our AI external engagement specialist, will guide you through identifying stakeholders, planning approaches, and developing sustainable partnerships.
            </p>
            
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <h3 className="font-medium text-teal-900 mb-2">Engagement Areas:</h3>
              <ul className="text-teal-800 text-sm space-y-1">
                <li>• Industry partner identification and relationship management</li>
                <li>• Community engagement strategies</li>
                <li>• Cross-sector collaboration opportunities</li>
                <li>• Partnership sustainability and growth planning</li>
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="your.email@tafe.nsw.edu.au"
              />
            </div>
          </div>

          <button
            onClick={startConversation}
            className="w-full bg-teal-500 text-white py-3 rounded-lg hover:bg-teal-600 font-medium"
          >
            Start External Stakeholder Planning
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
                <Users className="w-5 h-5 text-teal-600" />
                Planning with Josh
              </h2>
            </div>
            
            <div className="h-96 overflow-y-auto p-4 space-y-4" ref={messagesContainerRef}>
              {conversationHistory.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                    msg.sender === 'user' 
                      ? 'bg-teal-500 text-white' 
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    {msg.sender === 'ai' && (
                      <div className="text-xs text-gray-600 mb-1">Josh</div>
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
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600"></div>
                      <span className="text-sm text-gray-600">Josh is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="text-black p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userResponse}
                  onChange={(e) => setUserResponse(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUserResponse()}
                  placeholder="Describe your engagement needs..."
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  onClick={handleUserResponse}
                  disabled={isLoading || !userResponse.trim()}
                  className="px-4 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Engagement Plan Panel */}
        <div className="space-y-6">
          {/* Stakeholders */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Stakeholders
              </h3>
            </div>
            <div className="p-4">
              {engagementPlan.stakeholders.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  Stakeholder groups will be identified here.
                </p>
              ) : (
                <div className="space-y-3">
                  {engagementPlan.stakeholders.map((stakeholder, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <h4 className="font-medium text-gray-900 mb-2">{stakeholder.group}</h4>
                      <div className="flex gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs rounded ${getInfluenceColor(stakeholder.influence)}`}>
                          {stakeholder.influence} influence
                        </span>
                        <span className={`px-2 py-1 text-xs rounded ${getInterestColor(stakeholder.interest)}`}>
                          {stakeholder.interest} interest
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{stakeholder.approach}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Strategies */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Strategies</h3>
            </div>
            <div className="p-4">
              {engagementPlan.strategies.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  Engagement strategies will appear here.
                </p>
              ) : (
                <div className="space-y-3">
                  {engagementPlan.strategies.map((strategy, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <h4 className="font-medium text-gray-900 mb-1">{strategy.method}</h4>
                      <p className="text-sm text-gray-600 mb-2">{strategy.description}</p>
                      <div className="text-xs text-gray-500">
                        <div>Audience: {strategy.audience}</div>
                        <div>Frequency: {strategy.frequency}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Communications */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Communications</h3>
            </div>
            <div className="p-4">
              {engagementPlan.communications.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  Communication channels will be planned here.
                </p>
              ) : (
                <div className="space-y-3">
                  {engagementPlan.communications.map((comm, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <h4 className="font-medium text-gray-900 mb-1">{comm.channel}</h4>
                      <p className="text-sm text-gray-600 mb-2">{comm.purpose}</p>
                      <div className="text-xs text-gray-500">
                        <div>Frequency: {comm.frequency}</div>
                        <div>Audience: {comm.audience}</div>
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
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
              >
                <Download className="w-4 h-4" />
                Export Plan
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

export default ExternalStakeholders;
