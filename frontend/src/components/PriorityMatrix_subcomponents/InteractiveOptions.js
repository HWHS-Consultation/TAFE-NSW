import React from 'react';

const InteractiveOptions = ({ interactive, selectedRadioOption, onRadioSelection }) => {
  if (!interactive) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-700 font-medium">
        {interactive.question}
      </p>
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        {interactive.options.map((option, index) => (
          <label 
            key={index} 
            className="flex items-center p-2 rounded hover:bg-gray-100 cursor-pointer transition-colors"
          >
            <input
              type="radio"
              name="performanceFamiliarity"
              value={option}
              checked={selectedRadioOption === option}
              onChange={(e) => onRadioSelection(e.target.value)}
              className="form-radio h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-3 text-gray-700">{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default InteractiveOptions;