import React from 'react';
import { Download, Save } from 'lucide-react';

const ActionsPanel = ({ onSaveData, onExportData, onBack }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Actions</h3>
      </div>
      <div className="p-4 space-y-3">
        <button
          onClick={onSaveData}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Save className="w-4 h-4" />
          Save Data
        </button>
        
        <button
          onClick={onExportData}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Download className="w-4 h-4" />
          Export Report
        </button>
        
        <button
          onClick={onBack}
          className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default ActionsPanel;