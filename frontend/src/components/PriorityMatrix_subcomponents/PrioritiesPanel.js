import React from 'react';

const PrioritiesPanel = ({ discoveredPriorities }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Identified Priorities</h3>
      </div>
      <div className="p-4">
        {discoveredPriorities.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            Priorities will appear here as we discuss your challenges and opportunities.
          </p>
        ) : (
          <div className="space-y-4">
            {discoveredPriorities.map((priority, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">{priority.title}</h4>
                <p className="text-sm text-gray-600 mb-3">{priority.description}</p>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Importance:</span>
                    <div className="bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{width: `${priority.importance * 10}%`}}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Urgency:</span>
                    <div className="bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-red-600 h-2 rounded-full" 
                        style={{width: `${priority.urgency * 10}%`}}
                      ></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-2">
                  <div className="flex flex-wrap gap-1">
                    {priority.themes.map((theme, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrioritiesPanel;