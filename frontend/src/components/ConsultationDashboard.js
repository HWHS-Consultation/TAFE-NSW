import React, { useState } from 'react';
import { LogOut, Users, Target, Shield, MessageSquare, ClipboardList, Globe } from 'lucide-react';
import PriorityMatrix from './PriorityMatrix';
import CapacityAssessment from './CapacityAssessment';
import RiskRegister from './RiskRegister';
import EngagementPlanner from './EngagementPlanner';
import DeliveryStaff from './DeliveryStaff';
import ExternalStakeholders from './ExternalStakeholders';

const ConsultationDashboard = ({ user, onLogout }) => {
  const [selectedTool, setSelectedTool] = useState(null);

  const consultationTools = [
    {
      id: 'priority',
      title: 'Priority Discovery',
      description: 'Identify and prioritize strategic initiatives for your department',
      icon: Target,
      color: 'bg-blue-500',
      component: PriorityMatrix
    },
    {
      id: 'capacity',
      title: 'Capacity Assessment',
      description: 'Evaluate current capacity and identify optimization opportunities',
      icon: Users,
      color: 'bg-green-500',
      component: CapacityAssessment
    },
    {
      id: 'risk',
      title: 'Risk Register',
      description: 'Identify, assess, and plan mitigation strategies for operational risks',
      icon: Shield,
      color: 'bg-red-500',
      component: RiskRegister
    },
    {
      id: 'engagement',
      title: 'Engagement Planning',
      description: 'Develop comprehensive stakeholder engagement strategies',
      icon: MessageSquare,
      color: 'bg-purple-500',
      component: EngagementPlanner
    },
    {
      id: 'delivery',
      title: 'Delivery Staff',
      description: 'Deliver projects and initiatives effectively',
      icon: ClipboardList,
      color: 'bg-yellow-500',
      component: DeliveryStaff
    },
    {
      id: 'external-stakeholders',
      title: 'External Stakeholder',
      description: 'Engage with external stakeholders for feedback and collaboration',
      icon: Globe,
      color: 'bg-teal-500',
      component: ExternalStakeholders
    }
  ];

  if (selectedTool) {
    const tool = consultationTools.find(t => t.id === selectedTool);
    const ToolComponent = tool.component;
    
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <button
                onClick={() => setSelectedTool(null)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Back to Dashboard
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </header>
        <ToolComponent onBack={() => setSelectedTool(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                TAFE NSW Consultation Platform
              </h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {user?.email}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Choose a Consultation Tool
          </h2>
          <p className="text-gray-600">
            Select the consultation tool that best matches your current needs. Each tool provides AI-guided conversations to help gather and analyze information.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {consultationTools.map((tool) => {
            const IconComponent = tool.icon;
            return (
              <div
                key={tool.id}
                onClick={() => setSelectedTool(tool.id)}
                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow cursor-pointer p-6"
              >
                <div className="flex items-start gap-4">
                  <div className={`${tool.color} p-3 rounded-lg text-white`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {tool.title}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <span className="text-blue-600 text-sm font-medium hover:text-blue-700">
                    Start Consultation →
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            How It Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-semibold">1</span>
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Choose Your Tool</h4>
              <p className="text-sm text-gray-600">
                Select the consultation type that matches your current focus area
              </p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 font-semibold">2</span>
              </div>
              <h4 className="font-medium text-gray-900 mb-2">AI-Guided Conversation</h4>
              <p className="text-sm text-gray-600">
                Engage in a structured conversation with our AI consultant
              </p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-purple-600 font-semibold">3</span>
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Get Insights</h4>
              <p className="text-sm text-gray-600">
                Receive analysis, priorities, and actionable recommendations
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ConsultationDashboard;
