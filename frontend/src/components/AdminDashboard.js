import React, { useState, useEffect } from 'react';
import { DataService } from '../services/supabase';
import { Download, Calendar, User, FileText, LogOut } from 'lucide-react';

const AdminDashboard = ({ user, onLogout }) => {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState('all');

  const dataService = new DataService();

  useEffect(() => {
    loadConsultations();
  }, []);

  const loadConsultations = async () => {
    try {
      const data = await dataService.getAllConsultations();
      setConsultations(data || []);
    } catch (error) {
      console.error('Error loading consultations:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportConsultation = async (sessionId) => {
    try {
      const data = await dataService.getConsultationData(sessionId);
      
      // Create downloadable JSON file
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `consultation-${sessionId}.json`;
      link.click();
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data. Please try again.');
    }
  };

  const getConsultationTypeColor = (type) => {
    switch (type) {
      case 'priority_discovery': return 'bg-blue-100 text-blue-800';
      case 'capacity_assessment': return 'bg-green-100 text-green-800';
      case 'risk_register': return 'bg-red-100 text-red-800';
      case 'engagement_planning': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredConsultations = consultations.filter(consultation => {
    if (selectedView === 'all') return true;
    return consultation.consultation_type === selectedView;
  });

  const consultationStats = {
    total: consultations.length,
    priority: consultations.filter(c => c.consultation_type === 'priority_discovery').length,
    capacity: consultations.filter(c => c.consultation_type === 'capacity_assessment').length,
    risk: consultations.filter(c => c.consultation_type === 'risk_register').length,
    engagement: consultations.filter(c => c.consultation_type === 'engagement_planning').length,
    completed: consultations.filter(c => c.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-xl text-gray-600">Loading consultations...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Admin Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Consultation Platform Analytics & Data Export
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
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Consultations</p>
                <p className="text-2xl font-bold text-gray-900">{consultationStats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <User className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{consultationStats.completed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-gray-900">
                  {consultations.filter(c => 
                    new Date(c.started_at).getMonth() === new Date().getMonth()
                  ).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <Download className="w-8 h-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Available Exports</p>
                <p className="text-2xl font-bold text-gray-900">{consultationStats.total}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Consultation Type Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border mb-8 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Consultation Types</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{consultationStats.priority}</div>
              <div className="text-sm text-gray-600">Priority Discovery</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{consultationStats.capacity}</div>
              <div className="text-sm text-gray-600">Capacity Assessment</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{consultationStats.risk}</div>
              <div className="text-sm text-gray-600">Risk Register</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{consultationStats.engagement}</div>
              <div className="text-sm text-gray-600">Engagement Planning</div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'all', label: 'All Consultations', count: consultationStats.total },
                { id: 'priority_discovery', label: 'Priority', count: consultationStats.priority },
                { id: 'capacity_assessment', label: 'Capacity', count: consultationStats.capacity },
                { id: 'risk_register', label: 'Risk', count: consultationStats.risk },
                { id: 'engagement_planning', label: 'Engagement', count: consultationStats.engagement },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedView(tab.id)}
                  className={`${
                    selectedView === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </nav>
          </div>

          {/* Consultations Table */}
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stakeholder
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredConsultations.map((consultation) => (
                  <tr key={consultation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {consultation.stakeholders?.name || 'Anonymous'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {consultation.stakeholders?.role} - {consultation.stakeholders?.department}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getConsultationTypeColor(consultation.consultation_type)}`}>
                        {consultation.consultation_type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(consultation.status)}`}>
                        {consultation.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(consultation.started_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{width: `${consultation.completion_percentage || 0}%`}}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">
                          {Math.round(consultation.completion_percentage || 0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <button
                        onClick={() => exportConsultation(consultation.id)}
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        Export
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredConsultations.length === 0 && (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No consultations found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedView === 'all' 
                    ? 'No consultations have been started yet.' 
                    : `No ${selectedView.replace('_', ' ')} consultations found.`
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
