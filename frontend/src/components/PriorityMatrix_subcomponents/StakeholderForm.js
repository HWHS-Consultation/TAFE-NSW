import React from 'react';

const StakeholderForm = ({ stakeholderInfo, setStakeholderInfo, onStartConversation }) => {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Priority Discovery Consultation
        </h1>
        
        <div className="mb-8">
          <p className="text-gray-600 mb-4">
            This AI-guided consultation will help identify and prioritize strategic initiatives for your department. 
            The process takes about 15-20 minutes and involves a conversation with Riley, our AI consultant.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">What to Expect:</h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• Strategic discussion about your department's priorities</li>
              <li>• AI-powered analysis of challenges and opportunities</li>
              <li>• Automatic categorization and scoring of priorities</li>
              <li>• Downloadable summary and action plan</li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-black">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={stakeholderInfo.name}
              onChange={(e) => setStakeholderInfo({...stakeholderInfo, name: e.target.value})}
              className="w-full p-3 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your.email@tafe.nsw.edu.au"
            />
          </div>
        </div>

        <button
          onClick={onStartConversation}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          Start Priority Consultation
        </button>
      </div>
    </div>
  );
};

export default StakeholderForm;