import React, { useState, useEffect } from 'react';

const ApprovalNotification = ({ pageType, selectedClass, selectedGender }) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  // Map pageType to the actual model_type used in the backend
  const getModelType = (pageType) => {
    switch (pageType) {
      case 'marks': return 'marks';
      case 'attendance': return 'attendance';
      case 'fee': return 'fee';
      case 'monthly_test': return 'test_marks'; // Monthly test changes are stored as test_marks
      case 'test_marks': return 'test_marks';
      default: return pageType;
    }
  };

  useEffect(() => {
    const checkApprovalStatus = async () => {
      try {
        // Get pending count for this specific page type
        const pendingResponse = await fetch('http://localhost:8000/api/change-requests/pending/');
        if (pendingResponse.ok) {
          const pendingData = await pendingResponse.json();
          const modelType = getModelType(pageType);
          const pageSpecificPending = pendingData.pending_requests?.filter(req => 
            req.model_type === modelType
          ) || [];
          setPendingCount(pageSpecificPending.length);
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

  return (
    <div className="flex justify-between items-center mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      {/* Left side - Notification message */}
      <div className="flex items-center gap-2 text-blue-700">
        <span className="text-blue-600">💡</span>
        <span className="text-sm">
          Your {getPageTitle().toLowerCase()} changes are forwarded for admin approval
        </span>
      </div>
      
      {/* Right side - Pending count */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 bg-orange-100 border border-orange-300 text-orange-700 px-3 py-1 rounded-full">
          <span className="text-orange-600">⏳</span>
          <span className="text-sm font-semibold">{pendingCount} pending</span>
        </div>
      )}
    </div>
  );
};

export default ApprovalNotification; 