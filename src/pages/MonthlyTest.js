import React, { useState, useContext, useEffect, useCallback } from 'react';
import { ClassSubjectContext } from './Students';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import ApprovalNotification from '../components/ApprovalNotification';
import { useAuth } from '../context/AuthContext';

const genders = [
  { label: 'Boys', value: 'boys' },
  { label: 'Girls', value: 'girls' },
];

const MonthlyTest = () => {
  const { classNames } = useContext(ClassSubjectContext);
  const { role, canAccessClass, assignedClasses } = useAuth();
  const [selected, setSelected] = useState({ classIdx: null, gender: null });
  const [openDropdown, setOpenDropdown] = useState(null);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [testData, setTestData] = useState({
    title: '',
    subject: '',
    totalMarks: 100,
    description: ''
  });
  const [studentMarks, setStudentMarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [showModifyTest, setShowModifyTest] = useState(false);
  const [modifyTestData, setModifyTestData] = useState({});
  const [modifyStudentMarks, setModifyStudentMarks] = useState({});
  const [originalStudentMarks, setOriginalStudentMarks] = useState({});
  const [lastCheckedTime, setLastCheckedTime] = useState(null);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [lastDataUpdate, setLastDataUpdate] = useState(null);

  const handleDropdown = (classIdx) => {
    setOpenDropdown(openDropdown === classIdx ? null : classIdx);
  };

  const handleSelect = (classIdx, gender) => {
    setSelected({ classIdx, gender });
    setOpenDropdown(null);
  };

  const fetchStudents = useCallback(async () => {
    if (selected.classIdx === null || !selected.gender) {
      setStudents([]);
      return;
    }
    try {
      const classId = selected.classIdx + 1;
      const url = `http://192.168.18.139:8000/api/students/?class_admitted=Class ${classId}&gender=${selected.gender}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch students');
      const data = await response.json();
      setStudents(data);
    } catch (err) {
      setStudents([]);
    }
  }, [selected.classIdx, selected.gender]);

  const fetchSubjects = useCallback(async () => {
    if (selected.classIdx === null) return;
    try {
      const classId = selected.classIdx + 1;
      const response = await fetch(`http://192.168.18.139:8000/api/subjects/?class_fk=${classId}`);
      if (!response.ok) throw new Error('Failed to fetch subjects');
      const data = await response.json();
      setSubjects(data.map(s => s.name));
    } catch (err) {
      console.error('Error fetching subjects:', err);
      setSubjects([]);
    }
  }, [selected.classIdx]);

  const fetchTests = useCallback(async () => {
    if (selected.classIdx === null) return;
    try {
      const classId = selected.classIdx + 1;
      const response = await fetch(`http://192.168.18.139:8000/api/monthly-tests/?class_fk=${classId}&month=${selectedMonth}`);
      if (!response.ok) throw new Error('Failed to fetch tests');
      const data = await response.json();
      setTests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching tests:', err);
      setTests([]);
    }
  }, [selected.classIdx, selectedMonth]);

  useEffect(() => {
    fetchStudents();
    fetchSubjects();
    fetchTests();
  }, [fetchStudents, fetchSubjects, fetchTests]);

  const handleMonthChange = (date) => {
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    setSelectedMonth(month);
  };

  const handleCreateTest = () => {
    setTestData({
      title: '',
      subject: '',
      totalMarks: 100,
      description: ''
    });
    setStudentMarks({});
    setShowCreateTest(true);
  };

  const handleSaveTest = async () => {
    if (!testData.title || !testData.subject) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const classId = selected.classIdx + 1;
      const testPayload = {
        title: testData.title,
        subject: testData.subject,
        total_marks: testData.totalMarks,
        description: testData.description,
        class_fk_id: classId,
        month: selectedMonth
      };

      const response = await fetch('http://192.168.18.139:8000/api/monthly-tests/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });

      if (!response.ok) throw new Error('Failed to create test');
      
      const createdTest = await response.json();
      
      // Save marks for each student
      for (const student of students) {
        const marks = studentMarks[student.id] || 0;
        if (marks > 0) {
          const marksPayload = {
            test_id: createdTest.id,
            student_id: student.id,
            marks: marks,
            total_marks: testData.totalMarks
          };

          await fetch('http://192.168.18.139:8000/api/test-marks/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(marksPayload)
          });
        }
      }

      alert('Test created successfully!');
      setShowCreateTest(false);
      fetchTests();
    } catch (err) {
      console.error('Error creating test:', err);
      alert('Failed to create test');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkChange = (studentId, value) => {
    setStudentMarks(prev => ({
      ...prev,
      [studentId]: Math.min(Math.max(0, value), testData.totalMarks)
    }));
  };

  const handleModifyMarkChange = async (studentId, value) => {
    console.log(`[DEBUG] handleModifyMarkChange called with studentId: ${studentId}, value: ${value}`);
    const newValue = Math.min(Math.max(0, value), modifyTestData.totalMarks);
    console.log(`[DEBUG] newValue calculated: ${newValue}, modifyTestData.totalMarks: ${modifyTestData.totalMarks}`);
    
    // Update local state immediately for UI responsiveness
    setModifyStudentMarks(prev => ({
      ...prev,
      [studentId]: newValue
    }));

    // Create change request for marks update (will be sent for approval)
    try {
      console.log(`[DEBUG] Creating change request for student ${studentId}, marks: ${newValue}`);
      
      const requestBody = [{
        test_id: modifyTestData.id,
        student_id: studentId,
        marks: newValue,
        total_marks: modifyTestData.totalMarks
      }];
      
      console.log('[DEBUG] Sending test marks change request:', requestBody);
      console.log('[DEBUG] Request URL: http://192.168.18.139:8000/api/test-marks/');
      
      const response = await fetch(`http://192.168.18.139:8000/api/test-marks/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`[DEBUG] Response status: ${response.status}`);
      console.log(`[DEBUG] Response ok: ${response.ok}`);

      if (response.ok) {
        const responseData = await response.json();
        console.log('[DEBUG] Response data:', responseData);
        console.log('Change request created successfully');
        
        // Show notification that change request was created
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg z-50';
        notification.innerHTML = `
          <div class="flex items-center gap-2">
            <span>⏳</span>
            <span>Marks change submitted for approval</span>
          </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 2000);

        // Don't update original marks yet - wait for approval
        // The marks will be updated when the change request is approved
        await checkPendingChanges();
      } else {
        console.error('[DEBUG] Failed to create marks change request:', response.status);
        const errorData = await response.json();
        console.error('[DEBUG] Error details:', errorData);
      }
    } catch (err) {
      console.error('[DEBUG] Error creating marks change request:', err);
    }
  };

  const handleViewTestResults = async (test) => {
    setSelectedTest(test);
    try {
      const response = await fetch(`http://192.168.18.139:8000/api/test-marks/?test=${test.id}`);
      if (!response.ok) throw new Error('Failed to fetch test results');
      const data = await response.json();
      
      // Process the data to use pending marks if available
      const processedData = data.map(result => {
        // Use pending marks if available, otherwise use current marks
        const marksValue = result.has_pending_changes && result.pending_marks !== undefined 
          ? result.pending_marks 
          : result.marks;
        
        return {
          ...result,
          marks: marksValue,
          original_marks: result.marks, // Keep original for comparison
          has_pending_changes: result.has_pending_changes,
          pending_marks: result.pending_marks
        };
      });
      
      setTestResults(processedData);
    } catch (err) {
      console.error('Error fetching test results:', err);
      setTestResults([]);
    }
  };

  const handleModifyTest = async (test) => {
    setModifyTestData({
      id: test.id,
      title: test.title,
      subject: test.subject,
      totalMarks: test.total_marks,
      description: test.description || '',
      class_fk_id: test.class_fk_id || (selected.classIdx + 1),
      month: test.month
    });
    try {
      const response = await fetch(`http://192.168.18.139:8000/api/test-marks/?test=${test.id}`);
      if (response.ok) {
        const marksData = await response.json();
        const marksMap = {};
        marksData.forEach(mark => {
          marksMap[mark.student_id] = mark.marks;
        });
        setOriginalStudentMarks(marksMap);
        // Initialize with the original marks so users can see and modify them
        setModifyStudentMarks(marksMap);

      }
    } catch (err) {
      console.error('Error fetching test marks:', err);
    }
    setShowModifyTest(true);
  };

  const handleDeleteTest = async (test) => {
    if (window.confirm(`Are you sure you want to delete the test "${test.title}"? This action cannot be undone.`)) {
      try {
        const response = await fetch(`http://192.168.18.139:8000/api/monthly-tests/${test.id}/`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          alert('Test deleted successfully!');
          fetchTests();
        } else {
          throw new Error('Failed to delete test');
        }
      } catch (err) {
        console.error('Error deleting test:', err);
        alert('Failed to delete test');
      }
    }
  };

  const handleSaveModification = async () => {
    if (!modifyTestData.title || !modifyTestData.subject) {
      alert('Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      // 1. Fetch the current (old) test details
      const oldResponse = await fetch(`http://192.168.18.139:8000/api/monthly-tests/${modifyTestData.id}/`);
      if (!oldResponse.ok) throw new Error('Failed to fetch current test details');
      const oldTest = await oldResponse.json();
      
      // 2. Prepare old and new data for comparison
      const oldData = {
        title: oldTest.title,
        subject: oldTest.subject,
        total_marks: oldTest.total_marks,
        description: oldTest.description || '',
        class_fk_id: oldTest.class_fk_id,
        month: oldTest.month
      };
      const newData = {
        title: modifyTestData.title,
        subject: modifyTestData.subject,
        total_marks: modifyTestData.totalMarks,
        description: modifyTestData.description || '',
        class_fk_id: modifyTestData.class_fk_id,
        month: modifyTestData.month
      };
      
      // 3. Check if there are any test detail changes
      const testDetailsChanged = Object.keys(newData).some(
        key => String(newData[key]) !== String(oldData[key])
      );
      
      // 4. Check if there are any marks changes
      const marksChanged = Object.keys(modifyStudentMarks).some(
        studentId => {
          const newMark = modifyStudentMarks[studentId];
          const originalMark = originalStudentMarks[studentId];
          return String(newMark) !== String(originalMark);
        }
      );
      
      if (!testDetailsChanged && !marksChanged) {
        alert('No changes detected.');
        setLoading(false);
        return;
      }
      
      // 5. If only marks changed, inform user that marks are updated immediately
      if (!testDetailsChanged && marksChanged) {
        console.log('Only marks were modified - marks are updated immediately via handleModifyMarkChange');
        alert('Marks changes are submitted for approval when you modify them. No additional approval needed for test details.');
        setShowModifyTest(false);
        await checkPendingChanges();
        setLoading(false);
        return;
      }
      
      // 6. If test details changed, create change request for test details
      const crResponse = await fetch('http://192.168.18.139:8000/api/change-requests/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_type: 'monthly_test',
          object_id: modifyTestData.id,
          old_data: oldData,
          new_data: newData,
          change_type: 'update',
        })
      });
      
      if (crResponse.ok) {
        setShowModifyTest(false);
        await checkPendingChanges();
        // Show yellow notification (handled by ApprovalNotification component)
      } else {
        const errorData = await crResponse.json();
        if (crResponse.status === 400 && errorData.error === 'No changes detected between old and new data') {
          alert('No changes detected in test details. No approval request needed.');
          setShowModifyTest(false);
        } else {
          throw new Error(`Failed to submit change request: ${errorData.error || 'Unknown error'}`);
        }
      }
    } catch (err) {
      console.error('Error submitting change request for test details:', err);
      alert('Failed to submit change request for test details');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students;

  // Poll for approved changes every 15 seconds
  const checkForApprovedChanges = useCallback(async () => {
    try {
      console.log('Checking for approved changes...');
      const response = await fetch('http://192.168.18.139:8000/api/change-requests/approved/');
      if (response.ok) {
        const data = await response.json();
        const approvedRequests = data.approved_requests || [];
        console.log(`Found ${approvedRequests.length} approved requests`);
        
        // Check if there are any recently approved changes
        const recentApproved = approvedRequests.filter(request => {
          if (!lastCheckedTime) return false;
          const approvedTime = new Date(request.reviewed_at);
          const timeDiff = approvedTime - lastCheckedTime;
          return timeDiff > 0;
        });

        console.log(`Found ${recentApproved.length} recently approved changes`);

        if (recentApproved.length > 0) {
                  // Check if any of the approved changes are for test_marks or monthly_test
        const hasTestMarksChanges = recentApproved.some(request => request.model_type === 'test_marks');
        const hasMonthlyTestChanges = recentApproved.some(request => request.model_type === 'monthly_test');
        console.log('Has test marks changes:', hasTestMarksChanges);
        console.log('Has monthly test changes:', hasMonthlyTestChanges);
        
        if (hasTestMarksChanges) {
          console.log('Refreshing test results after approval...');
          // Force refresh test results if we have a selected test
          if (selectedTest) {
            try {
              // Add a cache-busting parameter to ensure fresh data
              const timestamp = new Date().getTime();
              const response = await fetch(`http://192.168.18.139:8000/api/test-marks/?test=${selectedTest.id}&_t=${timestamp}`);
              
              if (response.ok) {
                const data = await response.json();
                console.log('Refreshed test results data:', data);
                
                // Process the data to use updated marks (no longer pending)
                const processedData = data.map(result => {
                  // After approval, use the actual updated marks
                  return {
                    ...result,
                    marks: result.marks, // Use the actual updated marks
                    original_marks: result.marks, // Update original to reflect new state
                    has_pending_changes: false, // No longer pending
                    pending_marks: null // Clear pending marks
                  };
                });
                
                setTestResults(processedData);
                setLastDataUpdate(new Date());
                
                // Show success notification
                const notification = document.createElement('div');
                notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
                notification.innerHTML = `
                  <div class="flex items-center gap-2">
                    <span>✅</span>
                    <span>Marks updated after admin approval!</span>
                  </div>
                `;
                document.body.appendChild(notification);
                
                setTimeout(() => {
                  if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                  }
                }, 3000);
              }
            } catch (err) {
              console.error('Error refreshing test results after approval:', err);
            }
          }
        }
        
        if (hasMonthlyTestChanges) {
          console.log('Refreshing test details after approval...');
          // Force refresh the tests list to get updated test details
          await fetchTests();
          
          // If we have a selected test, also refresh its results
          if (selectedTest) {
            try {
              const timestamp = new Date().getTime();
              const response = await fetch(`http://192.168.18.139:8000/api/test-marks/?test=${selectedTest.id}&_t=${timestamp}`);
              if (response.ok) {
                const data = await response.json();
                setTestResults(data);
                setLastDataUpdate(new Date());
              }
            } catch (err) {
              console.error('Error refreshing test results after test details approval:', err);
            }
          }
          
          // Show success notification for test details
          const notification = document.createElement('div');
          notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
          notification.innerHTML = `
            <div class="flex items-center gap-2">
              <span>✅</span>
              <span>Test details updated after admin approval!</span>
            </div>
          `;
          document.body.appendChild(notification);
          
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 3000);
        }
        
        // Also refresh the tests list for any other changes
        if (hasTestMarksChanges || hasMonthlyTestChanges) {
          await fetchTests();
        }
        }
        
        // Update last checked time
        setLastCheckedTime(new Date());
      }
    } catch (error) {
      console.error('Error checking for approved changes:', error);
    }
  }, [lastCheckedTime, selectedTest, fetchTests]);

  // Poll for approved changes every 10 seconds for faster updates
  useEffect(() => {
    const interval = setInterval(checkForApprovedChanges, 10000); // 10 seconds
    
    // Also check immediately on mount
    checkForApprovedChanges();
    
    // Force an immediate refresh of test results if we have a selected test
    if (selectedTest) {
      const refreshTestResults = async () => {
        try {
          const timestamp = new Date().getTime();
          const response = await fetch(`http://192.168.18.139:8000/api/test-marks/?test=${selectedTest.id}&_t=${timestamp}`);
          if (response.ok) {
            const data = await response.json();

            
            // Process the data to use pending marks if available
            const processedData = data.map(result => {
              // Use pending marks if available, otherwise use current marks
              const marksValue = result.has_pending_changes && result.pending_marks !== undefined 
                ? result.pending_marks 
                : result.marks;
              
              return {
                ...result,
                marks: marksValue,
                original_marks: result.marks, // Keep original for comparison
                has_pending_changes: result.has_pending_changes,
                pending_marks: result.pending_marks
              };
            });
            
            setTestResults(processedData);
            setLastDataUpdate(new Date());
          }
        } catch (err) {
          console.error('Error loading initial test results:', err);
        }
      };
      refreshTestResults();
    }
    
    return () => clearInterval(interval);
  }, [checkForApprovedChanges, selectedTest]);

  // Check for pending changes
  const checkPendingChanges = useCallback(async () => {
    try {
      const response = await fetch('http://192.168.18.139:8000/api/change-requests/pending/');
      if (response.ok) {
        const data = await response.json();
        // Filter for test_marks and monthly_test changes
        const pendingChanges = data.pending_requests?.filter(req => 
          req.model_type === 'test_marks' || req.model_type === 'monthly_test'
        ) || [];
        setPendingChanges(pendingChanges);
      }
    } catch (error) {
      console.error('Error checking pending changes:', error);
    }
  }, []);

  // Check pending changes on component mount and when tests change
  useEffect(() => {
    checkPendingChanges();
  }, [checkPendingChanges, tests]);

  // Manual refresh function
  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      await fetchTests();
      await checkPendingChanges();
      
      // If we have a selected test, refresh its results
      if (selectedTest) {
        try {
          const response = await fetch(`http://192.168.18.139:8000/api/test-marks/?test=${selectedTest.id}`);
          if (response.ok) {
            const data = await response.json();

            
            // Process the data to use pending marks if available
            const processedData = data.map(result => {
              // Use pending marks if available, otherwise use current marks
              const marksValue = result.has_pending_changes && result.pending_marks !== undefined 
                ? result.pending_marks 
                : result.marks;
              
              return {
                ...result,
                marks: marksValue,
                original_marks: result.marks, // Keep original for comparison
                has_pending_changes: result.has_pending_changes,
                pending_marks: result.pending_marks
              };
            });
            
            setTestResults(processedData);
            setLastDataUpdate(new Date());
            
            // Show a brief highlight effect on the table
            const table = document.querySelector('.test-results-table');
            if (table) {
              table.style.backgroundColor = '#f0f9ff';
              setTimeout(() => {
                table.style.backgroundColor = '';
              }, 2000);
            }
          } else {
            console.error('Manual refresh failed:', response.status);
          }
        } catch (err) {
          console.error('Error refreshing test results:', err);
        }
      }
      
      // Show refresh notification
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-3 rounded-lg shadow-lg z-50';
      notification.innerHTML = `
        <div class="flex items-center gap-2">
          <span>🔄</span>
          <span>Data refreshed!</span>
        </div>
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 3000);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchTests, checkPendingChanges, selectedTest]);

  return (
    <div className="p-6" style={{ fontFamily: 'Times New Roman, serif' }}>
      <h1 className="text-2xl font-bold mb-6">Monthly Test Management</h1>
      
      {/* Class Navbar */}
      <div className="flex flex-wrap gap-4 mb-8">
        {classNames.map((className, idx) => (
          canAccessClass(idx + 1) && (
            <div key={className} className="relative flex flex-col items-center gap-1">
              <button
                className={`flex items-center gap-2 px-4 py-2 rounded focus:outline-none ${selected.classIdx === idx ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                onClick={() => handleDropdown(idx)}
              >
                {className}
                <span className="ml-1">▼</span>
              </button>
              {openDropdown === idx && (
                <div className="absolute left-0 mt-2 w-48 bg-white border rounded shadow z-10">
                  {genders.map((gender) => (
                    <button
                      key={gender.value}
                      className="block w-full text-left px-4 py-2 hover:bg-blue-50"
                      onClick={() => handleSelect(idx, gender.value)}
                    >
                      {gender.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        ))}
      </div>

      {/* Month Picker and Actions */}
      <div className="mb-4 flex items-center gap-4">
        <span className="font-semibold">Select Month:</span>
        <ReactDatePicker
          selected={new Date(selectedMonth)}
          onChange={handleMonthChange}
          dateFormat="yyyy-MM"
          showMonthYearPicker
          className="border rounded px-3 py-2"
        />
        <button
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
          onClick={handleCreateTest}
          disabled={filteredStudents.length === 0}
        >
          Create New Test
        </button>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold"
          onClick={refreshData}
          disabled={loading}
        >
          {loading ? '🔄 Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Previous Tests */}
      {selected.classIdx !== null && (
        <div className="bg-white rounded shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Previous Tests</h2>
          </div>
          {tests.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className="relative bg-white border border-gray-200 rounded-xl p-6 min-w-[320px] max-w-sm flex-shrink-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                  style={{ fontFamily: 'Times New Roman, serif' }}
                >
                  {/* Premium Subject Label - Centered */}
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 rounded-2xl blur-sm opacity-75"></div>
                      <div className="relative bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white text-xl px-10 py-4 rounded-2xl font-extrabold shadow-2xl border-2 border-white/20 backdrop-blur-sm">
                        <div className="flex items-center justify-center">
                          <span className="mr-2">📚</span>
                          {test.subject}
                          <span className="ml-2">📚</span>
                        </div>
                        <div className="absolute -top-1 -left-1 w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></div>
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></div>
                        <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></div>
                        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Test Content */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-xl text-gray-800 mb-3 leading-tight">{test.title}</h3>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-600 font-medium">Month:</span>
                        <span className="text-gray-800 font-bold text-2xl">{new Date(test.month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
                      </div>
                      
                      <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-600 font-medium">Total Marks:</span>
                        <span className="text-blue-600 font-bold text-lg">{test.total_marks}</span>
                      </div>
                    </div>
                    
                    {test.description && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                        <p className="text-gray-700 text-sm italic">{test.description}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="mt-6 space-y-2">
                    <button
                      onClick={() => handleViewTestResults(test)}
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      📊 View Results
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleModifyTest(test)}
                        className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white py-2 px-3 rounded-lg font-semibold hover:from-yellow-600 hover:to-yellow-700 transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        ✏️ Modify
                      </button>
                      <button
                        onClick={() => handleDeleteTest(test)}
                        className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white py-2 px-3 rounded-lg font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No tests found for this class.</p>
          )}
        </div>
      )}

      {/* Test Results Table */}
      {selectedTest && testResults.length > 0 && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[80vh] overflow-y-auto m-4">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-800">Test Results: {selectedTest.title}</h2>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="animate-pulse">🔄</span>
                  <span>Auto-updating every 15s</span>
                  {lastDataUpdate && (
                    <span className="text-xs text-green-600">
                      (Last updated: {lastDataUpdate.toLocaleTimeString()})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      const timestamp = new Date().getTime();
                      const response = await fetch(`http://192.168.18.139:8000/api/test-marks/?test=${selectedTest.id}&_t=${timestamp}`);
                      if (response.ok) {
                        const data = await response.json();
            
                        setTestResults([...data]);
                        setLastDataUpdate(new Date());
                        
                        // Show a brief highlight effect on the table
                        const table = document.querySelector('.test-results-table');
                        if (table) {
                          table.style.backgroundColor = '#f0f9ff';
                          setTimeout(() => {
                            table.style.backgroundColor = '';
                          }, 2000);
                        }
                      }
                    } catch (err) {
                      console.error('Error manually refreshing test results:', err);
                    }
                  }}
                  className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                >
                  🔄 Refresh Results
                </button>
            <button
              onClick={() => setSelectedTest(null)}
                  className="text-gray-500 hover:text-gray-700 text-xl font-bold"
            >
                  ✕
            </button>
          </div>
            </div>

            {/* Test Results Table */}
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Test Results</h3>
                <button
                  onClick={refreshData}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                >
                  <span>🔄</span>
                  Refresh Results
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="test-results-table w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Student Name</th>
                      <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Total Marks</th>
                      <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Marks Obtained</th>
                      <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.map((result) => (
                      <tr 
                        key={`${result.id}-${result.marks}-${result.updated_at}`} 
                        className="hover:bg-gray-50"
                      >
                        <td className="border border-gray-300 px-4 py-3 font-medium text-gray-800">
                          {result.student_name}
                          {result.updated_at && new Date(result.updated_at) > new Date(Date.now() - 60000) && (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              Just Updated!
                            </span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">
                          {result.total_marks}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center font-bold text-blue-600 text-lg">
                          {result.has_pending_changes ? (
                            <div className="flex flex-col items-center">
                              <div className="text-sm text-gray-500 line-through">
                                {result.original_marks}
                              </div>
                              <div className="text-sm font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                                {result.pending_marks}
                              </div>
                            </div>
                          ) : (
                            result.marks
                          )}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center font-semibold">
                          {result.has_pending_changes ? (
                            <div className="flex flex-col items-center">
                              <div className="text-sm text-gray-500 line-through">
                                {((result.original_marks / result.total_marks) * 100).toFixed(1)}%
                              </div>
                              <div className={`text-sm font-semibold ${
                                (result.pending_marks / result.total_marks) * 100 >= 80 ? 'text-green-600' :
                                (result.pending_marks / result.total_marks) * 100 >= 60 ? 'text-orange-600' : 'text-red-600'
                              }`}>
                                {((result.pending_marks / result.total_marks) * 100).toFixed(1)}%
                              </div>
                            </div>
                          ) : (
                            <span className={`${
                              (result.marks / result.total_marks) * 100 >= 80 ? 'text-green-600' :
                              (result.marks / result.total_marks) * 100 >= 60 ? 'text-orange-600' : 'text-red-600'
                            }`}>
                              {((result.marks / result.total_marks) * 100).toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              

            </div>
          </div>
        </div>
      )}

      {/* Create Test Modal */}
      {showCreateTest && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Create Monthly Test</h2>
            
                        {/* Test Details */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Test Title *</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={testData.title}
                  onChange={(e) => setTestData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Monthly Test - Mathematics"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject *</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={testData.subject}
                  onChange={(e) => setTestData(prev => ({ ...prev, subject: e.target.value }))}
                >
                  <option value="">Select Subject</option>
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Total Marks</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2"
                  value={testData.totalMarks}
                  onChange={(e) => setTestData(prev => ({ ...prev, totalMarks: parseInt(e.target.value) || 100 }))}
                  min="1"
                  max="200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Month</label>
                <ReactDatePicker
                  selected={new Date(selectedMonth)}
                  onChange={handleMonthChange}
                  dateFormat="yyyy-MM"
                  showMonthYearPicker
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                className="w-full border rounded px-3 py-2"
                rows="3"
                value={testData.description}
                onChange={(e) => setTestData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description for the test..."
              />
            </div>

            {/* Student Marks Table */}
            {filteredStudents.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Enter Student Marks</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 border">Student Name</th>
                        <th className="px-4 py-2 border">Total Marks</th>
                        <th className="px-4 py-2 border">Marks Obtained</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => (
                        <tr key={student.id}>
                          <td className="px-4 py-2 border font-semibold">{student.name}</td>
                          <td className="px-4 py-2 border text-center">{testData.totalMarks}</td>
                          <td className="px-4 py-2 border">
                            <input
                              type="number"
                              className="w-24 border rounded px-2 py-1 text-center"
                              value={studentMarks[student.id] || ''}
                              onChange={(e) => handleMarkChange(student.id, parseInt(e.target.value) || 0)}
                              min="0"
                              max={testData.totalMarks}
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <button
                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                onClick={() => setShowCreateTest(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                onClick={handleSaveTest}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modify Test Modal */}
      {showModifyTest && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Modify Monthly Test</h2>
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-sm text-green-800">
                💡 <strong>Note:</strong> Student marks are updated immediately when you modify them. 
                Only test details (title, subject, etc.) require admin approval.
              </p>
            </div>
            
            {/* Test Details */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Test Title *</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={modifyTestData.title}
                  onChange={(e) => setModifyTestData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Monthly Test - Mathematics"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject *</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={modifyTestData.subject}
                  onChange={(e) => setModifyTestData(prev => ({ ...prev, subject: e.target.value }))}
                >
                  <option value="">Select Subject</option>
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Total Marks</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2"
                  value={modifyTestData.totalMarks}
                  onChange={(e) => setModifyTestData(prev => ({ ...prev, totalMarks: parseInt(e.target.value) || 100 }))}
                  min="1"
                  max="200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Month</label>
                <ReactDatePicker
                  selected={new Date(selectedMonth)}
                  onChange={handleMonthChange}
                  dateFormat="yyyy-MM"
                  showMonthYearPicker
                  className="w-full border rounded px-3 py-2"
                  disabled
                />
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                className="w-full border rounded px-3 py-2"
                rows="3"
                value={modifyTestData.description}
                onChange={(e) => setModifyTestData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description for the test..."
              />
            </div>

            {/* Student Marks Table */}
            {filteredStudents.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Modify Student Marks</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 border">Student Name</th>
                        <th className="px-4 py-2 border">Total Marks</th>
                        <th className="px-4 py-2 border">Marks Obtained</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => {
                        const originalMark = originalStudentMarks[student.id];
                        const currentMark = modifyStudentMarks[student.id];
                        const hasChanged = String(originalMark) !== String(currentMark);
                        
                
                        
                        return (
                          <tr key={student.id} className={hasChanged ? 'bg-yellow-50' : ''}>
                            <td className="px-4 py-2 border font-semibold">
                              {student.name}
                              {hasChanged && <span className="ml-2 text-orange-600 text-xs">(Modified)</span>}
                            </td>
                          <td className="px-4 py-2 border text-center">{modifyTestData.totalMarks}</td>
                          <td className="px-4 py-2 border">
                              <div className="flex flex-col items-center">
                            <input
                              type="number"
                                  className={`w-24 border rounded px-2 py-1 text-center ${hasChanged ? 'border-orange-300 bg-orange-50' : ''}`}
                              value={modifyStudentMarks[student.id] || ''}
                                  onChange={(e) => handleModifyMarkChange(student.id, parseInt(e.target.value) || 0)}
                              min="0"
                              max={modifyTestData.totalMarks}
                                  placeholder={modifyStudentMarks[student.id] ? `${modifyStudentMarks[student.id]}` : "0"}
                                />
                                {hasChanged && (
                                  <div className="text-xs text-green-600 mt-1 font-medium">
                                    ✅ Updated in real-time
                                  </div>
                                )}
                                {originalMark && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Previous: {originalMark}
                                  </div>
                                )}
                              </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <button
                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                onClick={() => setShowModifyTest(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
                onClick={handleSaveModification}
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Test Details for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default MonthlyTest; 