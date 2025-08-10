import React, { useState, useEffect } from 'react';

const ApprovalStatusBox = ({ pageType, selectedClass, selectedGender }) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [recentApproved, setRecentApproved] = useState([]);
  const [recentRejected, setRecentRejected] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkApprovalStatus = async () => {
      try {
        // Get pending count
        const pendingResponse = await fetch('http://localhost:8000/api/change-requests/pending-count/');
        if (pendingResponse.ok) {
          const pendingData = await pendingResponse.json();
          setPendingCount(pendingData.pending_count || 0);
        }

        // Get recent approved changes
        const approvedResponse = await fetch('http://localhost:8000/api/change-requests/approved/');
        if (approvedResponse.ok) {
          const approvedData = await approvedResponse.json();
          const pageSpecificApproved = approvedData.approved_requests?.filter(req => 
            req.model_type === pageType
          ) || [];
          setRecentApproved(pageSpecificApproved.slice(0, 3)); // Show last 3
        }

        // Get recent rejected changes
        const rejectedResponse = await fetch('http://localhost:8000/api/change-requests/rejected/');
        if (rejectedResponse.ok) {
          const rejectedData = await rejectedResponse.json();
          const pageSpecificRejected = rejectedData.rejected_requests?.filter(req => 
            req.model_type === pageType
          ) || [];
          setRecentRejected(pageSpecificRejected.slice(0, 3)); // Show last 3
        }

        setIsVisible(true);
      } catch (error) {
        console.error('Error checking approval status:', error);
      }
    };

    checkApprovalStatus();
    const interval = setInterval(checkApprovalStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [pageType]);

  if (!isVisible) return null;

  const getPageTitle = () => {
    switch (pageType) {
      case 'marks': return 'Marks';
      case 'attendance': return 'Attendance';
      case 'fee': return 'Fees';
      case 'monthly_test': return 'Monthly Tests';
      case 'test_marks': return 'Test Marks';
      default: return 'Data';
    }
  };

  const getClassGenderText = () => {
    if (selectedClass && selectedGender) {
      return `${selectedClass} ${selectedGender}`;
    }
    return '';
  };

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-blue-800">
          📋 {getPageTitle()} Approval Status
        </h3>
        {getClassGenderText() && (
          <span className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded">
            {getClassGenderText()}
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Pending Changes */}
        <div className="bg-orange-50 border border-orange-200 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-orange-600 text-lg">⏳</span>
            <span className="font-semibold text-orange-800">Pending</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
          <div className="text-xs text-orange-600">Awaiting approval</div>
        </div>

        {/* Recent Approved */}
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-600 text-lg">✅</span>
            <span className="font-semibold text-green-800">Approved</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{recentApproved.length}</div>
          <div className="text-xs text-green-600">Recent approvals</div>
        </div>

        {/* Recent Rejected */}
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600 text-lg">❌</span>
            <span className="font-semibold text-red-800">Rejected</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{recentRejected.length}</div>
          <div className="text-xs text-red-600">Recent rejections</div>
        </div>
      </div>

      {/* Recent Activity */}
      {(recentApproved.length > 0 || recentRejected.length > 0) && (
        <div className="mt-4">
          <h4 className="font-semibold text-blue-800 mb-2">Recent Activity:</h4>
          <div className="space-y-2">
            {recentApproved.map((item, index) => (
              <div key={`approved-${index}`} className="flex items-center gap-2 text-sm">
                <span className="text-green-600">✅</span>
                <span className="text-green-700">
                  {item.details} - Approved
                </span>
              </div>
            ))}
            {recentRejected.map((item, index) => (
              <div key={`rejected-${index}`} className="flex items-center gap-2 text-sm">
                <span className="text-red-600">❌</span>
                <span className="text-red-700">
                  {item.details} - Rejected
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Message */}
      <div className="mt-4 p-3 bg-blue-100 rounded">
        <div className="flex items-center gap-2 text-blue-800 text-sm">
          <span>💡</span>
          <span>
            <strong>Note:</strong> Changes are saved immediately but require admin approval to take effect. 
            You'll be notified when your changes are approved or rejected.
          </span>
        </div>
      </div>
    </div>
  );
};

export default ApprovalStatusBox; 