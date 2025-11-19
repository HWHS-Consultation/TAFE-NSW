import React, { useState, useEffect, useRef } from 'react';
import { AIService } from '../services/aiService';
import { DataService } from '../services/supabase';
import { Send, Download, Save, ClipboardList, Users, Calendar, CheckCircle, Clock } from 'lucide-react';

const DeliveryStaff = ({ onBack }) => {
  const [currentStep, setCurrentStep] = useState('intro');
  const [staffInfo, setStaffInfo] = useState({
    name: '',
    role: '',
    department: '',
    email: ''
  });
  const [conversationHistory, setConversationHistory] = useState([]);
  const [userResponse, setUserResponse] = useState('');
  const [deliveryPlan, setDeliveryPlan] = useState({
    projects: [],
    resources: [],
    timeline: [],
    risks: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const aiService = new AIService();
  const dataService = new DataService();

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversationHistory]);

  const startConversation = async () => {
    if (!staffInfo.name || !staffInfo.role || !staffInfo.department) {
      alert('Please fill in all required fields');
      return;
    }

    setCurrentStep('conversation');
    // Changes in the startConversation function
    const welcomeMessage = {
      sender: 'ai',
      message: `G'day ${staffInfo.name}! I'm Riva, your delivery specialist. I'm here to help you plan and optimize project delivery for ${staffInfo.department}.

    Let's start by understanding your current projects and delivery challenges. Could you tell me about the key projects you're currently working on or planning to deliver soon?`,
      timestamp: new Date()
    };
    setConversationHistory([welcomeMessage]);
  };

  const handleUserResponse = async () => {
    if (!userResponse.trim() || isLoading) return;

    const userMessage = userResponse;
    setUserResponse('');
    setIsLoading(true);

    // Add user message to conversation
    setConversationHistory(prev => [...prev, {
      sender: 'user',
      message: userMessage,
      timestamp: new Date()
    }]);

    try {
      let aiResult;
      if (sessionId) {
        // Use delivery specialist agent if session exists
        const response = await aiService.sendDeliveryStaffMessage({
          userMessage,
          sessionId,
          context: {
            conversationHistory: conversationHistory,
            deliveryPlan: deliveryPlan,
            staffInfo: staffInfo
          }
        });
        
        aiResult = {
          response: response.message,
          insights: response.insights || []
        };
      } else {
        // Fallback to original service
        aiResult = await aiService.generateResponse(
          userMessage,
          staffInfo,
          'riva'
        );
      }

      const updatedConversation = [
        ...conversationHistory,
        { sender: 'user', message: userMessage, timestamp: new Date() },
        {
          sender: 'ai',
          message: aiResult.response,
          timestamp: new Date(),
          insights: aiResult.insights
        }
      ];
      setConversationHistory(updatedConversation);

      // Extract delivery plan elements
      extractDeliveryElements(userMessage, aiResult.response);

    } catch (error) {
      console.error('Error getting AI response:', error);
      setConversationHistory(prev => [...prev, {
        sender: 'ai',
        message: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date()
      }]);
    }

    setIsLoading(false);
  };

  const extractDeliveryElements = (userMessage, aiResponse) => {
    const combined = userMessage + ' ' + aiResponse;
    const plan = { ...deliveryPlan };

    // Extract project information
    if (combined.toLowerCase().includes('project') || combined.toLowerCase().includes('initiative')) {
      // Look for potential project names
      const projectRegex = /project\s+(?:called|named)?\s+['"]?([A-Za-z0-9\s]+)['"]?/gi;
      const matches = [...combined.matchAll(projectRegex)];
      
      if (matches.length > 0) {
        matches.forEach(match => {
          const projectName = match[1].trim();
          const existing = plan.projects.find(p => p.name.toLowerCase() === projectName.toLowerCase());
          if (!existing && projectName.length > 3) {
            plan.projects.push({
              name: projectName,
              status: 'Planning',
              priority: 'Medium',
              completion: '0%',
              lead: staffInfo.name
            });
          }
        });
      }
    }

    // Extract resource information
    if (combined.toLowerCase().includes('staff') || combined.toLowerCase().includes('resource')) {
      if (!plan.resources.find(r => r.type === 'Staff')) {
        plan.resources.push({
          type: 'Staff',
          description: 'Teaching and administrative personnel',
          status: 'Needed',
          allocation: 'Partial'
        });
      }
    }

    if (combined.toLowerCase().includes('budget') || combined.toLowerCase().includes('funding')) {
      if (!plan.resources.find(r => r.type === 'Budget')) {
        plan.resources.push({
          type: 'Budget',
          description: 'Financial resources for project implementation',
          status: 'Under review',
          allocation: 'Pending'
        });
      }
    }

    // Extract timeline information
    if (combined.toLowerCase().includes('schedule') || combined.toLowerCase().includes('timeline')) {
      const dateRegex = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/gi;
      const matches = [...combined.matchAll(dateRegex)];
      
      if (matches.length > 0) {
        matches.forEach(match => {
          const timeframe = match[0];
          if (!plan.timeline.find(t => t.milestone.includes(timeframe))) {
            plan.timeline.push({
              phase: 'Implementation',
              milestone: `Complete phase by ${timeframe}`,
              status: 'Not started',
              owner: staffInfo.name
            });
          }
        });
      } else if (plan.timeline.length === 0) {
        // Add generic timeline if none detected
        plan.timeline.push({
          phase: 'Planning',
          milestone: 'Define project scope and objectives',
          status: 'In progress',
          owner: staffInfo.name
        });
      }
    }

    // Extract risk information
    if (combined.toLowerCase().includes('risk') || combined.toLowerCase().includes('challenge') || combined.toLowerCase().includes('issue')) {
      if (combined.toLowerCase().includes('staff') && !plan.risks.find(r => r.description.toLowerCase().includes('staff'))) {
        plan.risks.push({
          category: 'Resource',
          description: 'Insufficient staff resources to deliver project',
          impact: 'High',
          likelihood: 'Medium',
          mitigation: 'Secure additional staff allocation or adjust timeline'
        });
      }
      
      if (combined.toLowerCase().includes('timeline') && !plan.risks.find(r => r.description.toLowerCase().includes('timeline'))) {
        plan.risks.push({
          category: 'Schedule',
          description: 'Timeline delays due to dependencies',
          impact: 'Medium',
          likelihood: 'Medium',
          mitigation: 'Regular progress monitoring and proactive management'
        });
      }
      
      if (combined.toLowerCase().includes('stakeholder') && !plan.risks.find(r => r.description.toLowerCase().includes('stakeholder'))) {
        plan.risks.push({
          category: 'Stakeholder',
          description: 'Stakeholder resistance to changes',
          impact: 'High',
          likelihood: 'Medium',
          mitigation: 'Early and consistent stakeholder engagement'
        });
      }
    }

    setDeliveryPlan(plan);
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in progress': return 'bg-blue-100 text-blue-800';
      case 'planning': return 'bg-yellow-100 text-yellow-800';
      case 'not started': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskColor = (level) => {
    switch (level.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const exportData = () => {
    const exportData = {
      staff: staffInfo,
      consultation_type: 'delivery_staff',
      conversation: conversationHistory,
      delivery_plan: deliveryPlan,
      session_id: sessionId,
      agent_type: 'riva_delivery_specialist',
      export_date: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `delivery-plan-${staffInfo.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  if (currentStep === 'intro') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-yellow-600" />
            Delivery Staff Consultation
          </h1>
          
          <div className="mb-8">
            <p className="text-gray-600 mb-4">
              This consultation will help you plan and optimize your project delivery processes. 
              Riva, our AI delivery specialist, will guide you through identifying projects, resource allocation, timeline planning, and risk management.
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-medium text-yellow-900 mb-2">Delivery Planning Areas:</h3>
              <ul className="text-yellow-800 text-sm space-y-1">
                <li>• Project identification and prioritization</li>
                <li>• Resource allocation and optimization</li>
                <li>• Timeline planning and milestone tracking</li>
                <li>• Risk identification and mitigation</li>
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
                value={staffInfo.name}
                onChange={(e) => setStaffInfo({...staffInfo, name: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                placeholder="Enter your full name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role/Position *
              </label>
              <input
                type="text"
                value={staffInfo.role}
                onChange={(e) => setStaffInfo({...staffInfo, role: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                placeholder="e.g., Project Manager, Team Leader"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department *
              </label>
              <select
                value={staffInfo.department}
                onChange={(e) => setStaffInfo({...staffInfo, department: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              >
                <option value="">Select Department</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Business Services">Business Services</option>
                <option value="Health & Community Services">Health & Community Services</option>
                <option value="Engineering">Engineering</option>
                <option value="Creative Industries">Creative Industries</option>
                <option value="Construction & Built Environment">Construction & Built Environment</option>
                <option value="Hospitality & Tourism">Hospitality & Tourism</option>
                <option value="Education & Training">Education & Training</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={staffInfo.email}
                onChange={(e) => setStaffInfo({...staffInfo, email: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                placeholder="your.email@tafe.nsw.edu.au"
              />
            </div>
          </div>

          <button
            onClick={startConversation}
            className="w-full bg-yellow-500 text-white py-3 rounded-lg hover:bg-yellow-600 font-medium"
          >
            Start Delivery Planning
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
                <ClipboardList className="w-5 h-5 text-yellow-600" />
                Planning with Riva
              </h2>
            </div>
            
            <div className="h-96 overflow-y-auto p-4 space-y-4" ref={messagesContainerRef}>
              {conversationHistory.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                    msg.sender === 'user' 
                      ? 'bg-yellow-500 text-white' 
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    {msg.sender === 'ai' && (
                      <div className="text-xs text-gray-600 mb-1">Riva</div>
                    )}
                    <div className="text-sm">{msg.message}</div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                      <span className="text-sm text-gray-600">Riva is thinking...</span>
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
                  placeholder="Describe your delivery challenges..."
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  onClick={handleUserResponse}
                  disabled={isLoading || !userResponse.trim()}
                  className="px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Plan Panel */}
        <div className="space-y-6">
          {/* Projects */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-yellow-600" />
                Projects
              </h3>
            </div>
            <div className="p-4">
              {deliveryPlan.projects.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  Projects will be identified here.
                </p>
              ) : (
                <div className="space-y-3">
                  {deliveryPlan.projects.map((project, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <h4 className="font-medium text-gray-900 mb-2">{project.name}</h4>
                      <div className="flex gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs rounded ${getStatusColor(project.status)}`}>
                          {project.status}
                        </span>
                        <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">
                          {project.priority} priority
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        <span>Completion: {project.completion}</span>
                        <span className="ml-4">Lead: {project.lead}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resources */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-yellow-600" />
                Resources
              </h3>
            </div>
            <div className="p-4">
              {deliveryPlan.resources.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  Resource requirements will appear here.
                </p>
              ) : (
                <div className="space-y-3">
                  {deliveryPlan.resources.map((resource, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <h4 className="font-medium text-gray-900 mb-1">{resource.type}</h4>
                      <p className="text-sm text-gray-600 mb-2">{resource.description}</p>
                      <div className="text-xs text-gray-500">
                        <div>Status: {resource.status}</div>
                        <div>Allocation: {resource.allocation}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                Timeline
              </h3>
            </div>
            <div className="p-4">
              {deliveryPlan.timeline.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  Project timeline will be planned here.
                </p>
              ) : (
                <div className="space-y-3">
                  {deliveryPlan.timeline.map((timepoint, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-medium text-gray-900">{timepoint.phase}</h4>
                        <span className={`px-2 py-1 text-xs rounded ${getStatusColor(timepoint.status)}`}>
                          {timepoint.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{timepoint.milestone}</p>
                      <div className="text-xs text-gray-500">Owner: {timepoint.owner}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Risks */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Risks</h3>
            </div>
            <div className="p-4">
              {deliveryPlan.risks.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  Risks and mitigation strategies will appear here.
                </p>
              ) : (
                <div className="space-y-3">
                  {deliveryPlan.risks.map((risk, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-medium text-gray-900">{risk.category}</h4>
                        <div className="flex gap-1">
                          <span className={`px-2 py-1 text-xs rounded ${getRiskColor(risk.impact)}`}>
                            Impact: {risk.impact}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded ${getRiskColor(risk.likelihood)}`}>
                            Likelihood: {risk.likelihood}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{risk.description}</p>
                      <div className="text-xs text-gray-500">
                        <div>Mitigation: {risk.mitigation}</div>
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
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
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

export default DeliveryStaff;