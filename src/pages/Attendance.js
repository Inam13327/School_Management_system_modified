import React, { useState, useContext, useEffect } from 'react';
import { ClassSubjectContext } from './Students';
import './attendance-calendar.css';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ApprovalNotification from '../components/ApprovalNotification';
import { useAuth } from '../context/AuthContext';

const classes = Array.from({ length: 10 }, (_, i) => `Class ${i + 1}`);
const genders = [
  { label: 'Boys', value: 'boys' },
  { label: 'Girls', value: 'girls' },
];

// Removed dummyStudents

const PresentIcon = () => <span title="Present" style={{ color: 'green', fontWeight: 'bold', fontSize: '1.2rem' }}>P</span>;
const AbsentIcon = () => <span title="Absent" style={{ color: 'red', fontWeight: 'bold', fontSize: '1.2rem' }}>A</span>;

const Attendance = () => {
  const { classNames } = useContext(ClassSubjectContext);
  const { role, canAccessClass, assignedClasses } = useAuth();
  const [selected, setSelected] = useState({ classIdx: null, gender: null });
  // Track attendance per class independently
  const [attendanceByClass, setAttendanceByClass] = useState({}); // { classKey: { studentId: true/false } }
  const [openDropdown, setOpenDropdown] = useState(null);
  const [students, setStudents] = useState([]);
  const [saveStatus, setSaveStatus] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  
  // New state for viewing existing records
  const [viewMode, setViewMode] = useState('mark'); // 'mark' or 'view'
  const [existingRecords, setExistingRecords] = useState([]);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editPresent, setEditPresent] = useState(false);
  // Modal state for delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteRecordId, setDeleteRecordId] = useState(null);
  const [searchDate, setSearchDate] = useState('');
  const [filteredRecords, setFilteredRecords] = useState([]);

  // Track submitted dates per class independently
  const [submittedDatesByClass, setSubmittedDatesByClass] = useState({}); // { classKey: Set of dates }

  // New state for approval popup
  const [showApprovalPopup, setShowApprovalPopup] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [approvalType, setApprovalType] = useState('pending'); // 'pending' or 'approved'

  // Helper function to get class key
  const getClassKey = (classIdx, gender) => `${classIdx}-${gender}`;

  const handleDropdown = (classIdx) => {
    setOpenDropdown(openDropdown === classIdx ? null : classIdx);
  };

  const handleSelect = (classIdx, gender) => {
    setSelected({ classIdx, gender });
    setOpenDropdown(null);
    // Clear save status when switching classes
    setSaveStatus(null);
    
    // Clear attendance state for the new selection to ensure independence
    const newClassKey = getClassKey(classIdx, gender);
    setAttendanceByClass((prev) => ({
      ...prev,
      [newClassKey]: {}
    }));
    
    console.log('🔄 Switched to:', newClassKey);
  };

  const handleCheckbox = (studentId) => {
    if (selected.classIdx === null || !selected.gender) {
      return;
    }
    const classKey = getClassKey(selected.classIdx, selected.gender);
    setAttendanceByClass((prev) => ({
      ...prev,
      [classKey]: {
        ...prev[classKey],
        [studentId]: !prev[classKey]?.[studentId]
      }
    }));
  };

  // Move fetchStudentsAndAttendance to top-level
  const fetchStudentsAndAttendance = async () => {
    if (selected.classIdx === null || !selected.gender) {
      setStudents([]);
      setAttendanceRecords([]);
      return;
    }
    try {
      const classId = selected.classIdx + 1;
      const response = await fetch(`http://localhost:8000/api/students/?class_admitted=Class ${classId}&gender=${selected.gender}`);
      if (!response.ok) throw new Error('Failed to fetch students');
      const data = await response.json();
      setStudents(data);
      if (data.length > 0) {
        const ids = data.map(s => s.id);
        try {
          const attRes = await fetch(`http://localhost:8000/api/attendances/?date=${selectedDate}&${ids.map(id => `student=${id}`).join('&')}`);
          const attData = attRes.ok ? await attRes.json() : [];
          setAttendanceRecords(attData);
          const classKey = getClassKey(selected.classIdx, selected.gender);
          const attMap = {};
          ids.forEach(id => {
            const rec = attData.find(a => a.student === id);
            attMap[id] = rec ? rec.present : false;
          });
          setAttendanceByClass((prev) => ({ ...prev, [classKey]: attMap }));
        } catch (attErr) {
          console.error('Error fetching attendance:', attErr);
          const classKey = getClassKey(selected.classIdx, selected.gender);
          const attMap = {};
          ids.forEach(id => { attMap[id] = false; });
          setAttendanceByClass((prev) => ({ ...prev, [classKey]: attMap }));
          setAttendanceRecords([]);
        }
      } else {
        const classKey = getClassKey(selected.classIdx, selected.gender);
        setAttendanceByClass((prev) => ({ ...prev, [classKey]: {} }));
        setAttendanceRecords([]);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
      setStudents([]);
      setAttendanceRecords([]);
    }
  };

  // Move fetchSubmittedDates to top-level
  const fetchSubmittedDates = async () => {
    if (selected.classIdx === null || !selected.gender) {
      return;
    }
    try {
      const classId = selected.classIdx + 1;
      const now = selectedDate ? new Date(selectedDate) : new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const studentsResponse = await fetch(`http://localhost:8000/api/students/?class_admitted=Class ${classId}&gender=${selected.gender}`);
      if (!studentsResponse.ok) throw new Error('Failed to fetch students');
      const studentsData = await studentsResponse.json();
      if (studentsData.length === 0) {
        const classKey = getClassKey(selected.classIdx, selected.gender);
        setSubmittedDatesByClass((prev) => ({ ...prev, [classKey]: new Set() }));
        return;
      }
      const studentIds = studentsData.map(s => s.id);
      const attendanceResponse = await fetch(`http://localhost:8000/api/attendances/?date__year=${year}&date__month=${month}&${studentIds.map(id => `student=${id}`).join('&')}`);
      if (!attendanceResponse.ok) throw new Error('Failed to fetch attendance records');
      const attendanceData = await attendanceResponse.json();
      const dateSet = new Set(attendanceData.map(r => r.date));
      const classKey = getClassKey(selected.classIdx, selected.gender);
      setSubmittedDatesByClass((prev) => ({ ...prev, [classKey]: dateSet }));
    } catch (err) {
      console.error('❌ Error fetching submitted dates:', err);
      const classKey = getClassKey(selected.classIdx, selected.gender);
      setSubmittedDatesByClass((prev) => ({ ...prev, [classKey]: new Set() }));
    }
  };

  // Fetch existing attendance records for viewing/editing
  const fetchExistingRecords = async () => {
    if (selected.classIdx === null || !selected.gender) {
      setExistingRecords([]);
      return;
    }
    try {
      const classId = selected.classIdx + 1;
      const response = await fetch(`http://localhost:8000/api/attendances/?student__class_admitted=Class ${classId}&student__gender=${selected.gender}`);
      if (!response.ok) throw new Error('Failed to fetch attendance records');
      const data = await response.json();
      setExistingRecords(data);
    } catch (err) {
      setExistingRecords([]);
    }
  };

  useEffect(() => {
    if (viewMode === 'view') {
      fetchExistingRecords();
    }
  }, [viewMode, selected.classIdx, selected.gender]);

  // Update filteredRecords when existingRecords or searchDate changes
  useEffect(() => {
    if (!searchDate) {
      setFilteredRecords(existingRecords);
    } else {
      setFilteredRecords(existingRecords.filter(r => r.date === searchDate));
    }
  }, [existingRecords, searchDate]);

  // Reset search date when class/gender changes in view mode
  useEffect(() => {
    if (viewMode === 'view') {
      setSearchDate('');
    }
  }, [selected.classIdx, selected.gender, viewMode]);

  // Helper for ReactDatePicker to style days with submitted attendance
  const dayClassName = date => {
    const iso = date.toISOString().slice(0, 10);
    const classKey = getClassKey(selected.classIdx, selected.gender);
    const submittedDates = submittedDatesByClass[classKey] || new Set();
    return submittedDates.has(iso) ? 'attendance-submitted-day' : undefined;
  };

  const filteredStudents = students;

  const handleSaveAttendance = async () => {
    setSaveStatus(null);
    if (!filteredStudents.length) {
      setSaveStatus('No students found to save attendance for.');
      return;
    }
    
    const classKey = getClassKey(selected.classIdx, selected.gender);
    const submittedDates = submittedDatesByClass[classKey] || new Set();
    
    console.log('🔍 Saving attendance for:', classKey);
    console.log('📅 Selected date:', selectedDate);
    console.log('📋 Submitted dates for this class:', Array.from(submittedDates));
    console.log('✅ Is date already submitted?', submittedDates.has(selectedDate));
    
    try {
      const currentAttendance = attendanceByClass[classKey] || {};
      const records = filteredStudents.map(student => ({
        student: student.id,
        date: selectedDate,
        present: !!currentAttendance[student.id],
      }));
      
      console.log('📊 Records to save:', records);
      
      const response = await fetch('http://localhost:8000/api/attendances/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save attendance: ${response.status} ${errorText}`);
      }
      
      // Check if this was a new attendance or an update
      const isUpdate = submittedDates.has(selectedDate);
      const successMsg = isUpdate 
        ? `Attendance updated successfully for ${classNames[selected.classIdx]} ${genders.find(g => g.value === selected.gender)?.label}! Changes pending admin approval.`
        : `Attendance saved successfully for ${classNames[selected.classIdx]} ${genders.find(g => g.value === selected.gender)?.label}! Changes pending admin approval.`;
      
      console.log('✅', successMsg);
      setSaveStatus(successMsg);
      
      // Update submitted dates for this specific class-gender combination only
      if (selectedDate) {
        setSubmittedDatesByClass(prev => {
          const newState = {
            ...prev,
            [classKey]: new Set(prev[classKey] || []).add(selectedDate)
          };
          console.log('📝 Updated submitted dates for', classKey, ':', selectedDate);
          console.log('🔄 New submittedDatesByClass state:', newState);
          return newState;
        });
      }
      
      // Check for pending changes after successful save
      await checkPendingChanges();
      // Show approval modal
      setApprovalType('pending');
      setApprovalMessage(`Attendance has been submitted for admin approval. You will be notified when it is approved.`);
      setShowApprovalPopup(true);
    } catch (err) {
      console.error('❌ Error saving attendance:', err);
      setSaveStatus('Failed to save attendance. ' + err.message);
    }
  };

  // Function to start editing a record
  const handleEditRecord = (record) => {
    setEditingRecord(record);
    setEditDate(record.date);
    setEditPresent(record.present);
  };

  // Function to save the edited record
  const handleSaveEdit = async () => {
    if (!editingRecord || !editDate) return;
    try {
      const response = await fetch(`http://localhost:8000/api/attendances/${editingRecord.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingRecord,
          date: editDate,
          present: editPresent
        }),
      });
      if (!response.ok) throw new Error('Failed to update attendance record');
      setSaveStatus('Update successful! Changes pending admin approval.');
      setEditingRecord(null);
      setEditDate('');
      setEditPresent(false);
      fetchExistingRecords(); // Refresh the list
      checkPendingChanges(); // Check for pending changes after successful edit
      // Show approval modal
      setApprovalType('pending');
      setApprovalMessage(`Attendance update has been submitted for admin approval. You will be notified when it is approved.`);
      setShowApprovalPopup(true);
    } catch (err) {
      setSaveStatus('Failed to update attendance record. ' + err.message);
    }
  };

  // Function to cancel editing
  const handleCancelEdit = () => {
    setEditingRecord(null);
    setEditDate('');
    setEditPresent(false);
  };

  // Open modal for delete confirmation
  const openDeleteModal = (recordId) => {
    setDeleteRecordId(recordId);
    setShowDeleteModal(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!deleteRecordId) return;
    try {
      const response = await fetch(`http://localhost:8000/api/attendances/${deleteRecordId}/`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete attendance record');
      setSaveStatus('Record deleted successfully! Changes pending admin approval.');
      fetchExistingRecords(); // Refresh the list
      await checkPendingChanges(); // Check for pending changes after successful deletion
      // Show approval modal
      setApprovalType('pending');
      setApprovalMessage(`Attendance deletion has been submitted for admin approval. You will be notified when it is approved.`);
      setShowApprovalPopup(true);
    } catch (err) {
      setSaveStatus('Failed to delete attendance record. ' + err.message);
    }
    setShowDeleteModal(false);
    setDeleteRecordId(null);
  };

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteRecordId(null);
  };

  // Calculate the number of days in the selected month, not the current month
  const selectedDateObj = selectedDate ? new Date(selectedDate) : new Date();
  const selectedYear = selectedDateObj.getFullYear();
  const selectedMonth = selectedDateObj.getMonth();
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1);

  // Only highlight submitted dates if they are in the selected month, otherwise reset all to blue
  const isSameMonth = (dateStr) => {
    const d = new Date(dateStr);
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
  };
  
  const classKey = getClassKey(selected.classIdx, selected.gender);
  const submittedDatesSet = new Set(
    Array.from(submittedDatesByClass[classKey] || [])
      .filter(date => isSameMonth(date))
      .map(date => new Date(date).getDate())
  );
  
  // Debug logging for calendar rendering
  console.log('🎯 Current classKey:', classKey);
  console.log('📅 All submittedDatesByClass:', submittedDatesByClass);
  console.log('📊 Current submittedDatesSet:', Array.from(submittedDatesSet));

  // Check for pending changes
  const checkPendingChanges = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/change-requests/pending/');
      if (response.ok) {
        const data = await response.json();
        // The ApprovalNotification component will handle displaying the notification
        // We just need to trigger a re-render by updating some state
        setSaveStatus(prev => prev); // This will trigger a re-render
      }
    } catch (error) {
      console.error('Error checking pending changes:', error);
    }
  };

  const refreshData = () => {
    if (typeof fetchStudentsAndAttendance === 'function') fetchStudentsAndAttendance();
    if (typeof fetchExistingRecords === 'function') fetchExistingRecords();
    if (typeof fetchSubmittedDates === 'function') fetchSubmittedDates();
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Attendance</h1>
      
      {/* Approval Notification */}
      <ApprovalNotification 
        pageType="attendance" 
        selectedClass={selected.classIdx !== null ? classNames[selected.classIdx] : null}
        selectedGender={selected.gender ? genders.find(g => g.value === selected.gender)?.label : null}
      />
      
      {/* Approval Popup Modal */}
      {showApprovalPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className={approvalType === 'approved' ? "bg-green-100 rounded-full p-3" : "bg-blue-100 rounded-full p-3"}>
                  <span className={approvalType === 'approved' ? "text-green-600 text-2xl" : "text-blue-600 text-2xl"}>
                    {approvalType === 'approved' ? '✅' : '⏳'}
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
                {approvalType === 'approved' ? 'Attendance Approved!' : 'Approval Request Submitted'}
              </h3>
              <p className="text-gray-600 text-center mb-6">
                {approvalMessage}
              </p>
              <div className={approvalType === 'approved' ? "bg-green-50 border border-green-200 rounded-lg p-4 mb-4" : "bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4"}>
                <div className="flex items-start">
                  <span className={approvalType === 'approved' ? "text-green-600 mr-2" : "text-blue-600 mr-2"}>{approvalType === 'approved' ? '🎉' : 'ℹ️'}</span>
                  <div className={approvalType === 'approved' ? "text-sm text-green-800" : "text-sm text-blue-800"}>
                    {approvalType === 'approved' ? (
                      <>
                        <p className="font-semibold mb-1">Your changes are now live!</p>
                        <ul className="text-xs space-y-1">
                          <li>• The admin has approved your attendance update</li>
                          <li>• The attendance table has been refreshed</li>
                        </ul>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold mb-1">What happens next?</p>
                        <ul className="text-xs space-y-1">
                          <li>• Your changes are sent to admin for review</li>
                          <li>• You'll receive a notification when approved</li>
                          <li>• The attendance will be updated automatically</li>
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => setShowApprovalPopup(false)}
                  className={approvalType === 'approved' ? "bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-semibold transition-colors" : "bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-semibold transition-colors"}
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Mode Toggle */}
      <div className="mb-4 flex gap-4">
        <button
          className={`px-4 py-2 rounded font-semibold ${viewMode === 'mark' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => setViewMode('mark')}
        >
          Mark Attendance
        </button>
        <button
          className={`px-4 py-2 rounded font-semibold ${viewMode === 'view' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => setViewMode('view')}
        >
          View/Edit Records
        </button>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold"
          onClick={refreshData}
        >
          Refresh
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
            <h2 className="text-lg font-semibold mb-4">Confirm Delete</h2>
            <p>Are you sure you want to delete this attendance record?</p>
            <div className="mt-6 flex justify-end gap-4">
              <button
                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                onClick={cancelDelete}
              >
                Cancel
              </button>
              <button
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'mark' ? (
        <>
          {/* Class Navbar */}
          <div className="flex flex-wrap gap-4 mb-8">
            {classNames.map((className, idx) => (
              canAccessClass(idx + 1) && (
                <div key={className} className="relative flex flex-col items-center gap-0">
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
          
          <div className="mb-4 flex items-center gap-2">
            <label htmlFor="attendance-date" className="font-semibold">Select Date:</label>
            <input
              id="attendance-date"
              type="date"
              className="border rounded px-3 py-2"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>
          
          <div className="bg-white rounded shadow p-6">
            {/* Individual Calendar for Selected Class-Gender */}
            {selected.classIdx !== null && selected.gender && (
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4">
                  {classNames[selected.classIdx]} {genders.find(g => g.value === selected.gender)?.label} - Attendance Calendar
                </h2>
                {submittedDatesByClass[classKey]?.size > 0 ? (
                  <div className="grid grid-cols-7 gap-4 justify-items-center">
                    {daysArray.map(day => (
                      <div
                        key={day}
                        className={`w-16 h-16 flex flex-col items-center justify-center rounded shadow text-center ${submittedDatesSet.has(day) ? 'bg-green-300' : 'bg-blue-100'}`}
                      >
                        <span className="font-bold text-lg">{day}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500">No attendance submitted this month for {classNames[selected.classIdx]} {genders.find(g => g.value === selected.gender)?.label}.</div>
                )}
              </div>
            )}
            
            {selected.classIdx !== null && selected.gender ? (
              filteredStudents.length > 0 ? (
                <>
                  <table className="min-w-full border">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 border">Student Name</th>
                        <th className="px-4 py-2 border">Father Name</th>
                        <th className="px-4 py-2 border">Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => (
                        <tr key={student.id}>
                          <td className="px-4 py-2 border">{student.name}</td>
                          <td className="px-4 py-2 border">{student.father_name || '-'}</td>
                          <td className="px-4 py-2 border text-center">
                            <label>
                              <input
                                type="checkbox"
                                checked={!!attendanceByClass[classKey]?.[student.id]}
                                onChange={() => handleCheckbox(student.id)}
                              />{' '}
                              Present
                              {attendanceByClass[classKey]?.[student.id] ? <PresentIcon /> : <AbsentIcon />}
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="mt-4 bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-semibold" onClick={handleSaveAttendance} type="button">Save Attendance</button>
                  {saveStatus && <div className="mt-2 text-center text-lg font-semibold text-blue-700">{saveStatus}</div>}
                </>
              ) : (
                <div className="text-gray-500">No students found for this selection.</div>
              )
            ) : (
              <div className="text-gray-500">Select a class and gender to mark attendance.</div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Search Bar for Date and Class/Gender Dropdowns */}
          <div className="mb-4 flex items-center gap-4 flex-wrap">
            <label className="font-semibold">Search by Date:</label>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              onClick={() => setSearchDate('')}
              type="button"
            >
              Clear
            </button>
            {/* Class Dropdown */}
            <label className="font-semibold ml-4">Class:</label>
            <select
              className="border rounded px-3 py-2"
              value={selected.classIdx !== null ? selected.classIdx : ''}
              onChange={e => setSelected({ ...selected, classIdx: e.target.value !== '' ? Number(e.target.value) : null })}
            >
              <option value="">Select Class</option>
              {classNames.map((className, idx) => (
                <option key={className} value={idx}>{className}</option>
              ))}
            </select>
            {/* Gender Dropdown */}
            <label className="font-semibold ml-2">Gender:</label>
            <select
              className="border rounded px-3 py-2"
              value={selected.gender || ''}
              onChange={e => setSelected({ ...selected, gender: e.target.value || null })}
            >
              <option value="">Select Gender</option>
              {genders.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded shadow p-6">
            {selected.classIdx !== null && selected.gender ? (
              // Filter records to only those students in the selected class/gender
              (() => {
                // Find all student names for the selected class/gender
                const allowedNames = students.map(s => s.name);
                const filteredByStudent = filteredRecords.filter(r => allowedNames.includes(r.student_name));
                return filteredByStudent.length > 0 ? (
                <>
                  <h3 className="text-lg font-semibold mb-4">Existing Attendance Records</h3>
                  <table className="min-w-full border">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 border">Student Name</th>
                        <th className="px-4 py-2 border">Date</th>
                        <th className="px-4 py-2 border">Status</th>
                        <th className="px-4 py-2 border">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredByStudent.map((record) => (
                        <tr key={record.id}>
                          <td className="px-4 py-2 border">{record.student_name || 'Unknown'}</td>
                          <td className="px-4 py-2 border">
                            {editingRecord?.id === record.id ? (
                              <div className="flex items-center gap-2 justify-center">
                                <input
                                  type="checkbox"
                                  checked={editPresent}
                                  onChange={e => setEditPresent(e.target.checked)}
                                  id={`present-edit-${record.id}`}
                                />
                                <label htmlFor={`present-edit-${record.id}`}>{editPresent ? 'Present' : 'Absent'}</label>
                              </div>
                            ) : (
                              record.date
                            )}
                          </td>
                          <td className="px-4 py-2 border text-center">
                            {editingRecord?.id === record.id ? (
                              <div className="flex items-center gap-2 justify-center">
                                <input
                                  type="checkbox"
                                  checked={editPresent}
                                  onChange={e => setEditPresent(e.target.checked)}
                                  id={`present-edit-${record.id}`}
                                />
                                <label htmlFor={`present-edit-${record.id}`}>{editPresent ? 'Present' : 'Absent'}</label>
                              </div>
                            ) : (
                              record.present ? <PresentIcon /> : <AbsentIcon />
                            )}
                          </td>
                          <td className="px-4 py-2 border text-center">
                            {editingRecord?.id === record.id ? (
                              <div className="flex gap-2 justify-center">
                                <button
                                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                                  onClick={handleSaveEdit}
                                >
                                  Save
                                </button>
                                <button
                                  className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
                                  onClick={handleCancelEdit}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2 justify-center">
                                <button
                                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                                  onClick={() => handleEditRecord(record)}
                                >
                                  Edit Date
                                </button>
                                <button
                                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                                  onClick={() => openDeleteModal(record.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {saveStatus && <div className="mt-2 text-center text-lg font-semibold text-blue-700">{saveStatus}</div>}
                </>
                ) : (
                  <div className="text-gray-500">No attendance records found for this selection.</div>
                );
              })()
            ) : (
              <div className="text-gray-500">Select a class and gender to view attendance records.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Attendance; 