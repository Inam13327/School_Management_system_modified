import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { ClassSubjectContext } from './Students';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { saveFee, updateFee, getAbsenteesByClassAndMonth } from '../api/axios';
import ApprovalNotification from '../components/ApprovalNotification';

const classes = Array.from({ length: 10 }, (_, i) => `Class ${i + 1}`);
const genders = [
  { label: 'Boys', value: 'boys' },
  { label: 'Girls', value: 'girls' },
];



const Fees = () => {
  const { classNames } = useContext(ClassSubjectContext);
  const [selected, setSelected] = useState({ classIdx: null, gender: null });
  const [openDropdown, setOpenDropdown] = useState(null);
  const [students, setStudents] = useState([]);
  const [feesRecords, setFeesRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [showEditFee, setShowEditFee] = useState(false);
  const [editingFee, setEditingFee] = useState({});
  const [submitStatus, setSubmitStatus] = useState('');
  const [submittedFeeIds, setSubmittedFeeIds] = useState(new Set());
  const [finePerAbsent, setFinePerAbsent] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [feeCardModal, setFeeCardModal] = useState({ open: false, student: null });
  const [feeCardIncharge, setFeeCardIncharge] = useState('');
  const feeCardRef = useRef();

  const handleDropdown = (classIdx) => {
    setOpenDropdown(openDropdown === classIdx ? null : classIdx);
  };

  const handleSelect = (classIdx, gender) => {
    setSelected({ classIdx, gender });
    setOpenDropdown(null);
  };

  const fetchStudentsAndFees = useCallback(async () => {
    if (selected.classIdx === null || !selected.gender) {
      setStudents([]);
      setFeesRecords([]);
      return;
    }
    try {
      const classId = selected.classIdx + 1;
      
      const response = await fetch(`http://192.168.100.2:8000/api/students/?class_admitted=Class ${classId}&gender=${selected.gender}`);
      if (!response.ok) throw new Error('Failed to fetch students');
      const data = await response.json();
      console.log('Students fetched:', data.length);
      // Parse year and month from selectedMonth
      const [year, month] = selectedMonth.split('-');
      // Fetch absentees count for each student for the selected month
      const absenteesCount = await getAbsenteesByClassAndMonth(classId, year, month);
      // Fetch fees for the selected month
      const feeRes = await fetch(`http://192.168.100.2:8000/api/fees/?month=${selectedMonth}&student__class_admitted=Class ${classId}&student__gender=${selected.gender}`);
      const feeData = feeRes.ok ? await feeRes.json() : [];
      console.log('Fees fetched:', feeData.length);
      // Map students with their fee data and absentees
      const studentsWithFees = data.map(student => {
        const fee = feeData.find(f => f.student === student.id);
        return {
          ...student,
          totalFee: fee ? fee.total_fee : 0,
          submittedFee: fee ? fee.submitted_fee : 0,
          fine: fee ? fee.fine : 0,
          absentees: absenteesCount[student.id] || 0,
          feeId: fee ? fee.id : null,
        };
      });
      console.log('Students with fees:', studentsWithFees);
      setStudents(studentsWithFees);
      setFeesRecords(feeData);
      setSubmittedFeeIds(new Set(feeData.map(f => f.student)));
    } catch (err) {
      console.error('Error fetching students and fees:', err);
      setStudents([]);
      setFeesRecords([]);
    }
  }, [selected.classIdx, selected.gender, selectedMonth]);

  useEffect(() => {
    fetchStudentsAndFees();
  }, [fetchStudentsAndFees]);

  useEffect(() => {
    if (!showEditFee) return;
    setEditingFee(prev => {
      const updated = { ...prev };
      students.forEach(student => {
        const abs = Number(updated[student.id]?.absentees || student.absentees || 0);
        // Only auto-calculate if fine is not manually set
        if (!updated[student.id]?.fine || updated[student.id]?.fine === 0) {
          updated[student.id] = {
            ...updated[student.id],
            fine: abs * Number(finePerAbsent || 0)
          };
        }
      });
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finePerAbsent, students, showEditFee]);

  const handleEditFee = async () => {
    console.log('handleEditFee called', { students, selected });
    
    // Fetch fresh absentees data for the selected month
    try {
      const classId = selected.classIdx + 1;
      const [year, month] = selectedMonth.split('-');
      const absenteesCount = await getAbsenteesByClassAndMonth(classId, year, month);
      console.log('Fresh absentees data:', absenteesCount);
      
      const current = {};
      students.forEach(student => {
        const absentees = absenteesCount[student.id] || 0;
        current[student.id] = {
          totalFee: student.totalFee || 0,
          submittedFee: student.submittedFee || 0,
          fine: student.fine || 0,
          absentees: absentees,
        };
      });
      
      // Set the global tution fee if all students have the same total fee
      const totalFees = students.map(s => s.totalFee).filter(f => f > 0);
      if (totalFees.length > 0 && totalFees.every(f => f === totalFees[0])) {
        current.tutionFee = totalFees[0];
      }
      
      console.log('Setting editingFee:', current);
      setEditingFee(current);
      setShowEditFee(true);
      setIsEditing(true);
      console.log('showEditFee set to true');
    } catch (error) {
      console.error('Error fetching absentees:', error);
      // Fallback to original logic if absentees fetch fails
      const current = {};
      students.forEach(student => {
        current[student.id] = {
          totalFee: student.totalFee || 0,
          submittedFee: student.submittedFee || 0,
          fine: student.fine || 0,
          absentees: student.absentees || 0,
        };
      });
              setEditingFee(current);
        setShowEditFee(true);
        setIsEditing(true);
      }
    };

  const handleFeeChange = (studentId, field, value) => {
    setEditingFee(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const handleSaveFee = async () => {
    setSubmitStatus('');
    // Only block duplicate saves if not updating
    if (!isUpdating && students.some(s => submittedFeeIds.has(s.id))) {
      setSubmitStatus('Fee already saved for this class and month.');
      return;
    }
    try {
              await Promise.all(students.map(async (student) => {
          const totalFee = Number(editingFee.tutionFee || student.totalFee || 0);
          const submittedFee = Number(editingFee[student.id]?.submittedFee || student.submittedFee || 0);
          const fine = Number(editingFee[student.id]?.fine || student.fine || 0);
          const absentees = Number(editingFee[student.id]?.absentees || student.absentees || 0);
          
          const feeData = {
            student: student.id,
            month: selectedMonth,
            total_fee: totalFee,
            submitted_fee: submittedFee,
            fine: fine,
            absentees: absentees,
            fine_per_absent: finePerAbsent || undefined,
          };
        if (student.feeId) {
          await updateFee(student.feeId, feeData);
        } else {
          await saveFee(feeData);
        }
              }));
        setSubmitStatus('Fee saved successfully! Changes pending admin approval.');
        setShowEditFee(false);
        
        // Refresh the students data to show updated values
        await fetchStudentsAndFees();
        setIsEditing(false);
      } catch (err) {
        if (err.response) {
          console.error('Fee save error:', err.response.data);
          setSubmitStatus('Failed to save fee: ' + JSON.stringify(err.response.data));
        } else {
          setSubmitStatus('Failed to save fee.');
        }
      }
    };

  const handleCancelEditFee = () => {
    setShowEditFee(false);
    setEditingFee({});
    setIsEditing(false);
  };

  const calculateFinesFromAbsentees = () => {
    if (!finePerAbsent || finePerAbsent <= 0) {
      alert('Please set "Fine for 1 Absent" amount first');
      return;
    }
    
    setEditingFee(prev => {
      const updated = { ...prev };
      students.forEach(student => {
        const absentees = updated[student.id]?.absentees || 0;
        const calculatedFine = absentees * Number(finePerAbsent);
        updated[student.id] = {
          ...updated[student.id],
          fine: calculatedFine
        };
      });
      return updated;
    });
  };

  const refreshAbsenteesData = async () => {
    try {
      const classId = selected.classIdx + 1;
      const [year, month] = selectedMonth.split('-');
      const absenteesCount = await getAbsenteesByClassAndMonth(classId, year, month);
      console.log('Refreshed absentees data:', absenteesCount);
      
      setEditingFee(prev => {
        const updated = { ...prev };
        students.forEach(student => {
          const absentees = absenteesCount[student.id] || 0;
          updated[student.id] = {
            ...updated[student.id],
            absentees: absentees,
            // Recalculate fine if fine per absent is set
            fine: finePerAbsent ? absentees * Number(finePerAbsent) : (updated[student.id]?.fine || 0)
          };
        });
        return updated;
      });
    } catch (error) {
      console.error('Error refreshing absentees:', error);
      alert('Failed to refresh absentees data');
    }
  };

  // Month picker for fee records
  const handleMonthChange = (date) => {
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    setSelectedMonth(month);
  };

  const filteredStudents = students;

  // Helper to get current month in readable format
  const getCurrentMonthYear = () => {
    const date = new Date(selectedMonth);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Helper to get fee data for a student
  const getStudentFeeData = (student) => {
    const tutionFee = Number(editingFee.tutionFee || student.totalFee || 0);
    const fine = Number(editingFee[student.id]?.fine || student.fine || 0);
    const submittedFee = Number(editingFee[student.id]?.submittedFee || student.submittedFee || 0);
    const absentees = Number(editingFee[student.id]?.absentees || student.absentees || 0);
    const totalFee = tutionFee + fine;
    // For demo, previous balance is 0; you can fetch from backend if available
    const previousBalance = 0;
    const grandTotal = totalFee + previousBalance;
    const received = submittedFee;
    const balance = grandTotal - received;
    return {
      tutionFee,
      fine,
      absentees,
      totalFee,
      previousBalance,
      grandTotal,
      received,
      balance,
    };
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Fee Management</h1>
      
      {/* Approval Notification */}
      <ApprovalNotification 
        pageType="fee" 
        selectedClass={selected.classIdx !== null ? classNames[selected.classIdx] : null}
        selectedGender={selected.gender ? genders.find(g => g.value === selected.gender)?.label : null}
      />
      {/* Class Navbar */}
      <div className="flex flex-wrap gap-4 mb-8">
        {classNames.map((className, idx) => (
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
        ))}
      </div>
      {/* Month Picker */}
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
          onClick={() => { setIsUpdating(false); handleEditFee(); }}
          disabled={filteredStudents.length === 0}
        >
          Edit Fees
        </button>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold"
          onClick={() => { setIsUpdating(true); handleEditFee(); }}
          disabled={filteredStudents.length === 0}
        >
          Update Fee
        </button>
      </div>
      {/* Edit Fee Modal */}
      {console.log('showEditFee state:', showEditFee)}
      {showEditFee && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Edit Fees - {classNames[selected.classIdx]} {genders.find(g => g.value === selected.gender)?.label}</h2>
            <p className="text-sm text-gray-600 mb-4">Absentees data is automatically fetched from attendance records for the selected month.</p>
            
            {/* Month Selection */}
            <div className="mb-4 flex items-center gap-4">
              <label className="font-semibold">Month:</label>
              <ReactDatePicker
                selected={new Date(selectedMonth)}
                onChange={handleMonthChange}
                dateFormat="yyyy-MM"
                showMonthYearPicker
                className="border rounded px-3 py-2"
              />
              <button
                type="button"
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-semibold"
                onClick={refreshAbsenteesData}
              >
                Refresh Absentees
              </button>
            </div>
            
            {/* Global Tution Fee input */}
            <div className="mb-4 flex items-center gap-4">
              <label className="font-semibold">Tution Fee:</label>
              <input
                type="number"
                className="w-32 border rounded px-2 py-1 text-center"
                value={editingFee.tutionFee || ''}
                onChange={e => {
                  const value = e.target.value;
                  setEditingFee(prev => {
                    const updated = { ...prev, tutionFee: value };
                    students.forEach(student => {
                      updated[student.id] = {
                        ...updated[student.id],
                        totalFee: value
                      };
                    });
                    return updated;
                  });
                }}
              />
            </div>
            
            {/* Fine for 1 Absent input */}
            <div className="mb-4 flex items-center gap-4">
              <label className="font-semibold">Fine for 1 Absent:</label>
              <input
                type="number"
                className="w-32 border rounded px-2 py-1 text-center"
                value={finePerAbsent}
                onChange={e => setFinePerAbsent(e.target.value)}
              />
              <button
                type="button"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 font-semibold"
                onClick={calculateFinesFromAbsentees}
              >
                Calculate Fines
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 border">Student Name</th>
                    <th className="px-4 py-2 border">Total Fee</th>
                    <th className="px-4 py-2 border">Submitted Fee</th>
                    <th className="px-4 py-2 border">Fine</th>
                    <th className="px-4 py-2 border">Absentees</th>
                    <th className="px-4 py-2 border">Remaining Fee</th>
                    <th className="px-4 py-2 border"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const totalFee = Number(editingFee.tutionFee || student.totalFee || 0);
                    const submittedFee = Number(editingFee[student.id]?.submittedFee || student.submittedFee || 0);
                    const fine = Number(editingFee[student.id]?.fine || student.fine || 0);
                    const absentees = Number(editingFee[student.id]?.absentees || student.absentees || 0);
                    const remainingFee = totalFee + fine - submittedFee;
                    
                    return (
                      <tr key={student.id}>
                        <td className="px-4 py-2 border font-semibold">{student.name}</td>
                        <td className="px-4 py-2 border">
                          <input
                            type="number"
                            className="w-24 border rounded px-2 py-1 text-center"
                            value={totalFee}
                            onChange={e => {
                              const value = e.target.value;
                              setEditingFee(prev => {
                                const updated = { ...prev, tutionFee: value };
                                students.forEach(s => {
                                  updated[s.id] = {
                                    ...updated[s.id],
                                    totalFee: value
                                  };
                                });
                                return updated;
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-2 border">
                          <input
                            type="number"
                            className="w-24 border rounded px-2 py-1 text-center"
                            value={editingFee[student.id]?.submittedFee || ''}
                            onChange={e => handleFeeChange(student.id, 'submittedFee', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2 border">
                          <input
                            type="number"
                            className="w-24 border rounded px-2 py-1 text-center"
                            value={editingFee[student.id]?.fine || ''}
                            onChange={e => handleFeeChange(student.id, 'fine', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2 border">
                          <input
                            type="number"
                            className="w-24 border rounded px-2 py-1 text-center"
                            value={editingFee[student.id]?.absentees || ''}
                            onChange={e => handleFeeChange(student.id, 'absentees', e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2 border text-center font-semibold">
                          {remainingFee}
                        </td>
                        <td className="px-4 py-2 border text-center">
                          <button className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700" onClick={() => { setFeeCardModal({ open: true, student }); setFeeCardIncharge(''); }}>
                            Generate Fee Card
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Summary Section */}
            <div className="mt-6 p-4 bg-gray-50 rounded">
              <h3 className="font-semibold mb-2">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Total Students:</span>
                  <span className="ml-2">{filteredStudents.length}</span>
                </div>
                <div>
                  <span className="font-medium">Total Fee Amount:</span>
                  <span className="ml-2">
                    {filteredStudents.reduce((sum, student) => {
                      const totalFee = Number(editingFee.tutionFee || student.totalFee || 0);
                      return sum + totalFee;
                    }, 0)}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Total Submitted:</span>
                  <span className="ml-2">
                    {filteredStudents.reduce((sum, student) => {
                      const submittedFee = Number(editingFee[student.id]?.submittedFee || student.submittedFee || 0);
                      return sum + submittedFee;
                    }, 0)}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Total Fine:</span>
                  <span className="ml-2">
                    {filteredStudents.reduce((sum, student) => {
                      const fine = Number(editingFee[student.id]?.fine || student.fine || 0);
                      return sum + fine;
                    }, 0)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-4">
              <button
                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                onClick={handleCancelEditFee}
              >
                Cancel
              </button>
              <button
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                onClick={handleSaveFee}
              >
                Save Fees
              </button>
            </div>
            {submitStatus && <div className="mt-4 text-blue-600 font-semibold">{submitStatus}</div>}
          </div>
        </div>
      )}
      {/* Fee Table */}
      <div className="bg-white rounded shadow p-6 mt-4">
        {isEditing && (
          <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 rounded">
            <p className="text-yellow-800 font-semibold">
              📝 Showing edited data - Save to update the table with server data
            </p>
          </div>
        )}
        {filteredStudents.length > 0 ? (
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 border">Name</th>
                <th className="px-4 py-2 border">Tution Fee</th>
                <th className="px-4 py-2 border">Submitted Fee</th>
                <th className="px-4 py-2 border">Fine</th>
                <th className="px-4 py-2 border">Absentees</th>
                <th className="px-4 py-2 border">Total Fee</th>
                <th className="px-4 py-2 border">Remaining Fee</th>
                <th className="px-4 py-2 border">Generate Fee Card</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const tutionFee = Number(editingFee.tutionFee || student.totalFee || 0);
                const fine = Number(editingFee[student.id]?.fine || student.fine || 0);
                const submittedFee = Number(editingFee[student.id]?.submittedFee || student.submittedFee || 0);
                const absentees = Number(editingFee[student.id]?.absentees || student.absentees || 0);
                const totalFee = tutionFee + fine;
                const remainingFee = totalFee - submittedFee;
                return (
                  <tr key={student.id}>
                    <td className="px-4 py-2 border">{student.name}</td>
                    <td className="px-4 py-2 border">{tutionFee}</td>
                    <td className="px-4 py-2 border">{submittedFee}</td>
                    <td className="px-4 py-2 border">{fine}</td>
                    <td className="px-4 py-2 border">{absentees}</td>
                    <td className="px-4 py-2 border">{totalFee}</td>
                    <td className="px-4 py-2 border">{remainingFee}</td>
                    <td className="px-4 py-2 border">
                      <button
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        onClick={() => setFeeCardModal({ open: true, student: student })}
                      >
                        Generate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-gray-500">No students found for this selection.</div>
        )}
      </div>
      {feeCardModal.open && feeCardModal.student && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-8 rounded shadow-lg max-w-lg w-full relative" ref={feeCardRef}>
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700" onClick={() => setFeeCardModal({ open: false, student: null })}>&times;</button>
            <div className="border-2 border-blue-700 p-6 rounded">
              <div className="flex justify-between items-center mb-2">
                <div className="font-bold text-lg text-blue-800">School ABC </div>
                <div className="text-xs">Fee Receipt</div>
              </div>
              <div className="flex justify-between mb-2">
                <div>No. <span className="border-b border-gray-400 px-8"></span></div>
                <div>Date: <span className="border-b border-gray-400 px-8">{new Date().toLocaleDateString()}</span></div>
              </div>
              <div className="mb-2">Received with thanks from: <span className="border-b border-gray-400 px-8">{feeCardModal.student.name}</span></div>
              <div className="mb-2">Class: <span className="border-b border-gray-400 px-8">{feeCardModal.student.class_admitted}</span></div>
              <div className="mb-2">On account of: <span className="border-b border-gray-400 px-8"></span></div>
              <div className="mb-2">For the month of: <span className="border-b border-gray-400 px-8">{getCurrentMonthYear()}</span></div>
              <div className="mb-2">Fee Per Month: <span className="border-b border-gray-400 px-8">{getStudentFeeData(feeCardModal.student).tutionFee}</span></div>
              <div className="mb-2">Paper Money: <span className="border-b border-gray-400 px-8"></span></div>
              <div className="mb-2">Tie Badge: <span className="border-b border-gray-400 px-8"></span></div>
              <div className="mb-2">Stationary: <span className="border-b border-gray-400 px-8"></span></div>
              <div className="mb-2">Others: <span className="border-b border-gray-400 px-8"></span></div>
              <div className="mb-2">Previous Balance: <span className="border-b border-gray-400 px-8">{getStudentFeeData(feeCardModal.student).previousBalance}</span></div>
              <div className="mb-2">Grand Total: <span className="border-b border-gray-400 px-8">{getStudentFeeData(feeCardModal.student).grandTotal}</span></div>
              <div className="mb-2">Received: <span className="border-b border-gray-400 px-8">{getStudentFeeData(feeCardModal.student).received}</span></div>
              <div className="mb-2">Balance: <span className="border-b border-gray-400 px-8">{getStudentFeeData(feeCardModal.student).balance}</span></div>
              <div className="mb-2">Incharge: <input className="border-b border-gray-400 px-2 outline-none" value={feeCardIncharge} onChange={e => setFeeCardIncharge(e.target.value)} placeholder="Incharge Name" /></div>
            </div>
            <div className="flex justify-end mt-4">
              <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700" onClick={() => { window.print(); }}>
                Print Fee Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fees; 