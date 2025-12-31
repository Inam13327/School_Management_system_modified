import React, { useState, useContext, useEffect } from 'react';
import { ClassSubjectContext } from './Students';
import { toast } from 'react-toastify';
import ApprovalNotification from '../components/ApprovalNotification';
import { useAuth } from '../context/AuthContext';

// Dummy students and marks for demonstration; replace with API data as needed
const dummyStudents = [
  {
    id: 1,
    name: 'Ali',
    classIdx: 0,
    gender: 'boys',
    marks: [80, 75, 90, 85, 88, 92, 78, 84],
    total: 800,
  },
  {
    id: 2,
    name: 'Sara',
    classIdx: 0,
    gender: 'girls',
    marks: [85, 80, 88, 90, 86, 91, 79, 87],
    total: 800,
  },
  {
    id: 3,
    name: 'Bilal',
    classIdx: 1,
    gender: 'boys',
    marks: [70, 65, 75, 80, 72, 68, 74, 77],
    total: 800,
  },
  {
    id: 4,
    name: 'Ayesha',
    classIdx: 1,
    gender: 'girls',
    marks: [90, 92, 88, 91, 89, 94, 90, 93],
    total: 800,
  },
];

const genders = [
  { label: 'Boys', value: 'boys' },
  { label: 'Girls', value: 'girls' },
];

const Marks = () => {
  const { classNames, subjectNames } = useContext(ClassSubjectContext);
  const { role, canAccessClass, assignedClasses } = useAuth();
  const [selected, setSelected] = useState({ classIdx: null, gender: null });
  const [students, setStudents] = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null);
  // Subject state
  const [subjectsByClass, setSubjectsByClass] = useState({}); // {classIdx: [subject, ...]}
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [showDeleteSubject, setShowDeleteSubject] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState('');
  // Marks state
  const [showEditMarks, setShowEditMarks] = useState(false);
  const [marksData, setMarksData] = useState({}); // {studentId: {subject: mark, ...}}
  const [editingMarks, setEditingMarks] = useState({}); // {studentId: {subject: mark, ...}}
  const [subjectTotals, setSubjectTotals] = useState({}); // {subject: totalMarks}
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Notification state
  const [pendingRequests, setPendingRequests] = useState([]);
  const [lastCheckedTime, setLastCheckedTime] = useState(new Date());
  const [showApprovalPopup, setShowApprovalPopup] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [approvalType, setApprovalType] = useState('pending'); // 'pending' or 'approved'

  const handleDropdown = (classIdx) => {
    setOpenDropdown(openDropdown === classIdx ? null : classIdx);
  };

  const handleSelect = (classIdx, gender) => {
    setSelected({ classIdx, gender });
    setOpenDropdown(null);
  };

  const handleAddSubject = () => {
    setShowAddSubject(true);
  };

  const handleSaveSubject = async () => {
    if (selected.classIdx === null) return;
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    
    try {
      const classId = selected.classIdx + 1;
      const response = await fetch('http://192.168.18.139:8000/api/subjects/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          class_fk_id: classId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to add subject', {
          position: "top-right",
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        return;
      }
      
      // Refresh subjects list
      const subjectsResponse = await fetch(`http://192.168.18.139:8000/api/subjects/?class_fk=${classId}`);
      if (subjectsResponse.ok) {
        const data = await subjectsResponse.json();
        setSubjectsByClass(prev => ({ ...prev, [selected.classIdx]: data.map(s => s.name) }));
      }
      
      toast.success('Subject added successfully!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      setNewSubject('');
      setShowAddSubject(false);
    } catch (err) {
      toast.error('Failed to add subject: ' + err.message, {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  };

  const handleDeleteSubject = () => {
    if (selected.classIdx === null) return;
    
    // Get the list of subjects for the selected class
    const subjects = subjectsByClass[selected.classIdx] || [];
    if (subjects.length === 0) {
      toast.warning('No subjects available to delete.', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }
    
    setShowDeleteSubject(true);
    setSubjectToDelete('');
  };

  const handleConfirmDeleteSubject = async () => {
    if (!subjectToDelete) {
      toast.warning('Please select a subject to delete.', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }
    
    // Confirm deletion
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the subject "${subjectToDelete}"?\n\nThis will also delete all marks associated with this subject.`
    );
    
    if (!confirmDelete) return;
    
    try {
      const classId = selected.classIdx + 1;
      
      // First, get the subject ID
      const subjectsResponse = await fetch(`http://192.168.18.139:8000/api/subjects/?class_fk=${classId}`);
      if (!subjectsResponse.ok) throw new Error('Failed to fetch subjects');
      const subjectsData = await subjectsResponse.json();
      
      const subjectToDeleteObj = subjectsData.find(s => s.name === subjectToDelete);
      if (!subjectToDeleteObj) {
        alert('Subject not found.');
        return;
      }
      
      // Delete the subject
      const deleteResponse = await fetch(`http://192.168.18.139:8000/api/subjects/${subjectToDeleteObj.id}/`, {
        method: 'DELETE',
      });
      
      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        toast.error(errorData.error || 'Failed to delete subject', {
          position: "top-right",
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        return;
      }
      
      // Refresh subjects list
      const refreshResponse = await fetch(`http://192.168.18.139:8000/api/subjects/?class_fk=${classId}`);
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setSubjectsByClass(prev => ({ ...prev, [selected.classIdx]: data.map(s => s.name) }));
      }
      
      toast.success(`Subject "${subjectToDelete}" deleted successfully!`, {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      setShowDeleteSubject(false);
      setSubjectToDelete('');
    } catch (err) {
      toast.error('Failed to delete subject: ' + err.message, {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  };

  const handleEditMarks = () => {
    setShowEditMarks(true);
    // Initialize editing marks with current data
    const currentMarks = {};
    filteredStudents.forEach(student => {
      currentMarks[student.id] = {};
      (subjectsByClass[selected.classIdx] || []).forEach(subject => {
        currentMarks[student.id][subject] = marksData[student.id]?.[subject] || '';
      });
    });
    setEditingMarks(currentMarks);
    // Initialize subject totals (default 100 if not set)
    const currentTotals = { ...subjectTotals };
    (subjectsByClass[selected.classIdx] || []).forEach(subject => {
      if (!currentTotals[subject]) currentTotals[subject] = 100;
    });
    setSubjectTotals(currentTotals);
  };

  const handleSaveMarks = async () => {
    try {
      setLoading(true);
      setError('');
      const classId = selected.classIdx + 1;
      const subjectsResponse = await fetch(`http://192.168.18.139:8000/api/subjects/?class_fk=${classId}`);
      if (!subjectsResponse.ok) throw new Error('Failed to fetch subjects');
      const subjectsData = await subjectsResponse.json();
      // Fetch all marks for this class to build a lookup for ids
      const marksRes = await fetch(`http://192.168.18.139:8000/api/marks/?class_fk=${classId}`);
      const marksList = marksRes.ok ? await marksRes.json() : [];
      // Build a lookup: {studentId-subjectId: markId}
      const markIdLookup = {};
      marksList.forEach(mark => {
        markIdLookup[`${mark.student}-${mark.subject}`] = mark.id;
      });
      // Prepare marks data for backend
      const marksToSave = [];
      filteredStudents.forEach(student => {
        (subjectsByClass[selected.classIdx] || []).forEach(subject => {
          const markValue = editingMarks[student.id]?.[subject];
          if (markValue !== undefined && markValue !== '') {
            const subjectObj = subjectsData.find(s => s.name === subject);
            if (subjectObj) {
              const markId = markIdLookup[`${student.id}-${subjectObj.id}`];
              marksToSave.push({
                student_id: student.id,
                subject_id: subjectObj.id,
                marks: parseFloat(markValue),
                ...(markId ? { id: markId } : {})
              });
            }
          }
        });
      });
      if (marksToSave.length > 0) {
        // Always use POST (backend will handle first-time vs updates)
        const response = await fetch('http://192.168.18.139:8000/api/marks/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(marksToSave),
        });
        if (!response.ok) throw new Error('Failed to save marks');
        
        // Show notification for marks updates (same as MonthlyTest.js)
        toast.success(
          'Marks updated successfully!',
          {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          }
        );
        
        // Show popup notification with the requested message
        alert('Test details modification request submitted for admin approval! Marks have been updated immediately.');
        
        setApprovalMessage(`${marksToSave.length} marks updates have been submitted for admin approval. You will be notified when they are approved.`);
        setApprovalType('pending');
        setShowApprovalPopup(true);
      } else {
        toast.success('Marks saved successfully!', {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
      // Refresh marks data and subjects after saving
      const [marksResponse, subjectsResponse2] = await Promise.all([
        fetch(`http://192.168.18.139:8000/api/marks/?class_fk=${classId}`),
        fetch(`http://192.168.18.139:8000/api/subjects/?class_fk=${classId}`)
      ]);
      if (marksResponse.ok) {
        const data = await marksResponse.json();
        const organizedMarks = {};
        data.forEach(mark => {
          const studentId = mark.student?.id || mark.student_id;
          if (!organizedMarks[studentId]) {
            organizedMarks[studentId] = {};
          }
          organizedMarks[studentId][mark.subject_name] = mark.marks;
        });
        setMarksData(organizedMarks);
      }
      if (subjectsResponse2.ok) {
        const data = await subjectsResponse2.json();
        setSubjectsByClass(prev => ({ ...prev, [selected.classIdx]: data.map(s => s.name) }));
      }
      setShowEditMarks(false);
      setLoading(false);
      await checkPendingRequests();
    } catch (err) {
      setError('Failed to save marks: ' + err.message);
      setLoading(false);
      toast.error('Failed to save marks: ' + err.message, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  };

  const handleCancelEditMarks = () => {
    setShowEditMarks(false);
    setEditingMarks({});
  };

  const handleMarkChange = (studentId, subject, value) => {
    setEditingMarks(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subject]: value
      }
    }));
  };

  const handleSubjectTotalChange = (subject, value) => {
    setSubjectTotals(prev => ({ ...prev, [subject]: value }));
  };

  // Check for pending approval requests
  const checkPendingRequests = async () => {
    try {

      const response = await fetch('http://192.168.18.139:8000/api/change-requests/pending/');
      if (response.ok) {
        const data = await response.json();

        const marksRequests = data.pending_requests?.filter(req => 
          req.model_type === 'marks'
        ) || [];

        setPendingRequests(marksRequests);
      }
    } catch (error) {
      console.error('❌ Error checking pending requests:', error);
    }
  };

  // Check for approved changes
  const checkApprovedChanges = async () => {
    try {

      const response = await fetch('http://192.168.18.139:8000/api/change-requests/approved/');
      if (response.ok) {
        const data = await response.json();

        const recentApproved = data.approved_requests?.filter(req => 
          req.model_type === 'marks'
        ) || [];

        
        // Show notification for recently approved changes
        const newApproved = recentApproved.filter(req => 
          new Date(req.reviewed_at) > lastCheckedTime
        );

        
        if (newApproved.length > 0) {
          // Refresh marks data to show updated values
          if (selected.classIdx !== null) {
            const classId = selected.classIdx + 1;
            const marksResponse = await fetch(`http://192.168.18.139:8000/api/marks/?class_fk=${classId}`);
            if (marksResponse.ok) {
              const data = await marksResponse.json();
              const organizedMarks = {};
              data.forEach(mark => {
                const studentId = mark.student?.id || mark.student_id;
                if (!organizedMarks[studentId]) {
                  organizedMarks[studentId] = {};
                }
                organizedMarks[studentId][mark.subject_name] = mark.marks;
              });
              setMarksData(organizedMarks);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error checking approved changes:', error);
    }
  };

  // Poll for pending requests and approved changes
  useEffect(() => {
    const interval = setInterval(() => {
      checkPendingRequests();
      checkApprovedChanges();
      setLastCheckedTime(new Date());
    }, 30000); // Check every 30 seconds

    // Initial check
    checkPendingRequests();
    checkApprovedChanges();

    return () => clearInterval(interval);
  }, [lastCheckedTime, selected.classIdx, checkApprovedChanges, checkPendingRequests]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (selected.classIdx === null || !selected.gender) {
        setStudents([]);
        return;
      }
      try {
        const classId = selected.classIdx + 1;
        const response = await fetch(`http://192.168.18.139:8000/api/students/?class_admitted=Class ${classId}&gender=${selected.gender}`);
        if (!response.ok) throw new Error('Failed to fetch students');
        const data = await response.json();
        setStudents(data);
      } catch (err) {
        setStudents([]);
      }
    };
    fetchStudents();
  }, [selected.classIdx, selected.gender]);

  // Fetch subjects for the selected class
  useEffect(() => {
    const fetchSubjects = async () => {
      if (selected.classIdx === null) {
        setSubjectsByClass(prev => ({ ...prev, [selected.classIdx]: [] }));
        return;
      }
      try {
        setLoading(true);
        const classId = selected.classIdx + 1;
        const response = await fetch(`http://192.168.18.139:8000/api/subjects/?class_fk=${classId}`);
        if (!response.ok) throw new Error('Failed to fetch subjects');
        const data = await response.json();
        setSubjectsByClass(prev => ({ ...prev, [selected.classIdx]: data.map(s => s.name) }));
        setLoading(false);
      } catch (err) {
        setSubjectsByClass(prev => ({ ...prev, [selected.classIdx]: [] }));
        setError('Failed to fetch subjects');
        setLoading(false);
      }
    };
    fetchSubjects();
  }, [selected.classIdx]);

  // Fetch marks for the selected class
  useEffect(() => {
    const fetchMarks = async () => {
      if (selected.classIdx === null) {
        setMarksData({});
        return;
      }
      try {
        setLoading(true);
        const classId = selected.classIdx + 1;
        const response = await fetch(`http://192.168.18.139:8000/api/marks/?class_fk=${classId}`);
        if (!response.ok) throw new Error('Failed to fetch marks');
        const data = await response.json();
        // Organize marks by student and subject, including pending changes
        const organizedMarks = {};
        data.forEach(mark => {
          const studentId = mark.student?.id || mark.student_id;
          if (!organizedMarks[studentId]) {
            organizedMarks[studentId] = {};
          }
          // Use pending marks if available, otherwise use current marks
          const marksValue = mark.has_pending_changes && mark.pending_marks !== undefined 
            ? mark.pending_marks 
            : mark.marks;
          organizedMarks[studentId][mark.subject_name] = marksValue;
          
          // Store pending changes info for UI display
          if (mark.has_pending_changes) {
            if (!organizedMarks[studentId]._pending) {
              organizedMarks[studentId]._pending = {};
            }
            organizedMarks[studentId]._pending[mark.subject_name] = {
              pending_marks: mark.pending_marks,
              change_request_id: mark.change_request_id
            };
          }
        });
        setMarksData(organizedMarks);
        setLoading(false);
      } catch (err) {
        setMarksData({});
        setError('Failed to fetch marks');
        setLoading(false);
      }
    };
    fetchMarks();
  }, [selected.classIdx, subjectsByClass[selected.classIdx]?.length]);

  const filteredStudents = students;

  const refreshData = async () => {
    // Implement the logic to refresh data for the selected class/gender
    // This is a placeholder and should be replaced with the actual implementation
    console.log('Refreshing data...');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Marks Management</h1>
      
      {/* Approval Notification */}
      {/* Yellow Pending Changes Notification */}
      {/* Legacy Pending Requests Display */}
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
      <div className="bg-white rounded shadow p-6">
        {/* Add Subject Button/Input for selected class */}
        {selected.classIdx !== null && (
          <div className="mb-4 flex items-center gap-4">
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold"
              onClick={handleAddSubject}
            >
              Add Subject
            </button>
            <button
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-semibold"
              onClick={handleDeleteSubject}
              disabled={!selected.gender || (subjectsByClass[selected.classIdx] || []).length === 0}
            >
              Delete Subject
            </button>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold"
              onClick={handleEditMarks}
              disabled={!selected.gender || filteredStudents.length === 0}
            >
              Edit Marks
            </button>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold"
              onClick={refreshData}
            >
              Refresh
            </button>
            {showAddSubject && (
              <>
                <input
                  type="text"
                  className="border rounded px-3 py-2"
                  placeholder="Enter subject name"
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  autoFocus
                />
                <button
                  className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 font-semibold"
                  onClick={handleSaveSubject}
                >
                  Save
                </button>
                <button
                  className="bg-gray-400 text-white px-3 py-2 rounded hover:bg-gray-500 font-semibold"
                  onClick={() => { setShowAddSubject(false); setNewSubject(''); }}
                >
                  Cancel
                </button>
              </>
            )}
            {showDeleteSubject && (
              <>
                <select
                  className="border rounded px-3 py-2"
                  value={subjectToDelete}
                  onChange={e => setSubjectToDelete(e.target.value)}
                >
                  <option value="">Select subject to delete</option>
                  {(subjectsByClass[selected.classIdx] || []).map((subject, idx) => (
                    <option key={idx} value={subject}>{subject}</option>
                  ))}
                </select>
                <button
                  className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 font-semibold"
                  onClick={handleConfirmDeleteSubject}
                >
                  Delete
                </button>
                <button
                  className="bg-gray-400 text-white px-3 py-2 rounded hover:bg-gray-500 font-semibold"
                  onClick={() => { setShowDeleteSubject(false); setSubjectToDelete(''); }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
        {/* Edit Marks Modal */}
        {showEditMarks && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
            <div className="bg-white p-6 rounded shadow-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4">Edit Marks - {classNames[selected.classIdx]} {genders.find(g => g.value === selected.gender)?.label}</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 border">Student Name</th>
                      {(subjectsByClass[selected.classIdx] || []).map((subject, idx) => (
                        <th key={subject + idx} className="px-4 py-2 border">
                          <div>{subject}</div>
                          <div className="text-xs text-gray-500 font-semibold mb-1">Total Marks</div>
                          <input
                            type="number"
                            className="w-20 border rounded px-2 py-1 text-center mt-1"
                            placeholder="Total"
                            min="1"
                            value={subjectTotals[subject] || 100}
                            onChange={e => handleSubjectTotalChange(subject, Number(e.target.value))}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td className="px-4 py-2 border font-semibold">{student.name}</td>
                        {(subjectsByClass[selected.classIdx] || []).map((subject, idx) => (
                          <td key={`${student.id}-${idx}`} className="px-4 py-2 border">
                            <input
                              type="number"
                              className="w-20 border rounded px-2 py-1 text-center"
                              placeholder="0"
                              min="0"
                              max={subjectTotals[subject] || 100}
                              value={editingMarks[student.id]?.[subject] || ''}
                              onChange={(e) => handleMarkChange(student.id, subject, e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 flex justify-end gap-4">
                <button
                  className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                  onClick={handleCancelEditMarks}
                >
                  Cancel
                </button>
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  onClick={handleSaveMarks}
                >
                  Save Marks
                </button>
              </div>
            </div>
          </div>
        )}
        {loading && <div className="text-blue-600 font-semibold mb-2">Loading...</div>}
        {error && <div className="text-red-600 font-semibold mb-2">{error}</div>}
        {selected.classIdx !== null && selected.gender ? (
          filteredStudents.length > 0 ? (
            <table className="min-w-full border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 border">Name</th>
                  {(subjectsByClass[selected.classIdx] || []).map((subject, idx) => (
                    <th key={subject + idx} className="px-4 py-2 border">{subject}</th>
                  ))}
                  <th className="px-4 py-2 border">Total Marks</th>
                  <th className="px-4 py-2 border">Obtained Marks</th>
                  <th className="px-4 py-2 border">Percentage</th>
                  <th className="px-4 py-2 border">Grade</th>
                  <th className="px-4 py-2 border">Class</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  // Calculate obtained, total, percentage, grade
                  const subjectList = subjectsByClass[selected.classIdx] || [];
                  const marksArray = subjectList.map(subject => {
                    const val = marksData[student.id]?.[subject];
                    return val !== undefined && val !== null && val !== '' ? Number(val) : 0;
                  });
                  const total = subjectList.reduce((sum, subject) => sum + (Number(subjectTotals[subject]) || 100), 0);
                  const obtained = marksArray.reduce((a, b) => a + b, 0);
                  const percent = total > 0 ? ((obtained / total) * 100).toFixed(2) : '0.00';
                  let grade = '';
                  if (percent >= 90) grade = 'A';
                  else if (percent >= 80) grade = 'B';
                  else if (percent >= 70) grade = 'C';
                  else if (percent >= 60) grade = 'D';
                  else if (percent >= 40) grade = 'E';
                  else grade = 'F';
                  
                  // Check if student has any pending changes
                  const hasAnyPendingChanges = Object.keys(marksData[student.id]?._pending || {}).length > 0;
                  return (
                    <tr key={student.id} className={hasAnyPendingChanges ? 'bg-yellow-50' : ''}>
                      <td className="px-4 py-2 border">
                        <div className="flex items-center gap-2">
                          {student.name}
                          {hasAnyPendingChanges && (
                            <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                              ⏳ Pending
                            </span>
                          )}
                        </div>
                      </td>
                      {subjectList.map((subject, idx) => {
                        const hasPendingChanges = marksData[student.id]?._pending?.[subject];
                        const currentMarks = marksData[student.id]?.[subject];
                        const pendingMarks = hasPendingChanges?.pending_marks;
                        
                        return (
                          <td key={`${student.id}-${idx}`} className="px-4 py-2 border">
                            {hasPendingChanges ? (
                              <div className="flex flex-col items-center">
                                <div className="text-sm text-gray-500 line-through">
                                  {currentMarks !== undefined && currentMarks !== null && currentMarks !== '' ? currentMarks : '-'}
                                </div>
                                <div className="text-sm font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                                  {pendingMarks !== undefined && pendingMarks !== null && pendingMarks !== '' ? pendingMarks : '-'}
                                </div>
                                <div className="text-xs text-yellow-600 mt-1">⏳ Pending</div>
                              </div>
                            ) : (
                              currentMarks !== undefined && currentMarks !== null && currentMarks !== '' ? currentMarks : '-'
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 border">{total}</td>
                      <td className="px-4 py-2 border">
                        {hasAnyPendingChanges ? (
                          <div className="flex flex-col items-center">
                            <div className="text-sm text-gray-500 line-through">
                              {/* Calculate current obtained marks without pending changes */}
                              {(() => {
                                const currentMarksArray = subjectList.map(subject => {
                                  const hasPending = marksData[student.id]?._pending?.[subject];
                                  const val = hasPending ? 
                                    (marksData[student.id]?.[subject] !== undefined && marksData[student.id]?.[subject] !== null && marksData[student.id]?.[subject] !== '' ? Number(marksData[student.id][subject]) : 0) :
                                    (marksData[student.id]?.[subject] !== undefined && marksData[student.id]?.[subject] !== null && marksData[student.id]?.[subject] !== '' ? Number(marksData[student.id][subject]) : 0);
                                  return val;
                                });
                                return currentMarksArray.reduce((a, b) => a + b, 0);
                              })()}
                            </div>
                            <div className="text-sm font-semibold text-yellow-600">
                              {obtained}
                            </div>
                          </div>
                        ) : (
                          obtained
                        )}
                      </td>
                      <td className="px-4 py-2 border">
                        {hasAnyPendingChanges ? (
                          <div className="flex flex-col items-center">
                            <div className="text-sm text-gray-500 line-through">
                              {/* Calculate current percentage without pending changes */}
                              {(() => {
                                const currentMarksArray = subjectList.map(subject => {
                                  const hasPending = marksData[student.id]?._pending?.[subject];
                                  const val = hasPending ? 
                                    (marksData[student.id]?.[subject] !== undefined && marksData[student.id]?.[subject] !== null && marksData[student.id]?.[subject] !== '' ? Number(marksData[student.id][subject]) : 0) :
                                    (marksData[student.id]?.[subject] !== undefined && marksData[student.id]?.[subject] !== null && marksData[student.id]?.[subject] !== '' ? Number(marksData[student.id][subject]) : 0);
                                  return val;
                                });
                                const currentObtained = currentMarksArray.reduce((a, b) => a + b, 0);
                                return total > 0 ? ((currentObtained / total) * 100).toFixed(2) : '0.00';
                              })()}%
                            </div>
                            <div className="text-sm font-semibold text-yellow-600">
                              {percent}%
                            </div>
                          </div>
                        ) : (
                          `${percent}%`
                        )}
                      </td>
                      <td className="px-4 py-2 border">
                        {hasAnyPendingChanges ? (
                          <div className="flex flex-col items-center">
                            <div className="text-sm text-gray-500 line-through">
                              {/* Calculate current grade without pending changes */}
                              {(() => {
                                const currentMarksArray = subjectList.map(subject => {
                                  const hasPending = marksData[student.id]?._pending?.[subject];
                                  const val = hasPending ? 
                                    (marksData[student.id]?.[subject] !== undefined && marksData[student.id]?.[subject] !== null && marksData[student.id]?.[subject] !== '' ? Number(marksData[student.id][subject]) : 0) :
                                    (marksData[student.id]?.[subject] !== undefined && marksData[student.id]?.[subject] !== null && marksData[student.id]?.[subject] !== '' ? Number(marksData[student.id][subject]) : 0);
                                  return val;
                                });
                                const currentObtained = currentMarksArray.reduce((a, b) => a + b, 0);
                                const currentPercent = total > 0 ? (currentObtained / total) * 100 : 0;
                                if (currentPercent >= 90) return 'A';
                                else if (currentPercent >= 80) return 'B';
                                else if (currentPercent >= 70) return 'C';
                                else if (currentPercent >= 60) return 'D';
                                else if (currentPercent >= 40) return 'E';
                                else return 'F';
                              })()}
                            </div>
                            <div className="text-sm font-semibold text-yellow-600">
                              {grade}
                            </div>
                          </div>
                        ) : (
                          grade
                        )}
                      </td>
                      <td className="px-4 py-2 border">{classNames[selected.classIdx]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-gray-500">No students found for this selection.</div>
          )
        ) : (
          <div className="text-gray-500">Select a class and gender to view marks.</div>
        )}
      </div>
      
      {/* Approval Popup Modal */}
    </div>
  );
};

export default Marks; 