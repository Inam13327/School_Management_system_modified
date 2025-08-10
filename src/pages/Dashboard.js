import React, { useState, useEffect } from 'react';
import { FaUserGraduate, FaCalendarCheck, FaMoneyBillWave, FaSearch } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
// import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState({ name: '', className: '' });
  const [showDialog, setShowDialog] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState(null);
  const [classMonitors, setClassMonitors] = useState(() => {
    const saved = localStorage.getItem('classMonitors');
    return saved ? JSON.parse(saved) : Array.from({ length: 10 }, () => 'Class Monitor');
  });

  useEffect(() => {
    const fetchAllStudents = async () => {
      setStudentsLoading(true);
      setStudentsError(null);
      try {
        const response = await api.get('/students/');
        const data = response.data;
        console.log('Dashboard - All students data:', data);
        console.log('Dashboard - Sample student:', data[0]);
        setStudents(data);
      } catch (err) {
        setStudentsError('Failed to fetch students. ' + err.message);
        setStudents([]);
      } finally {
        setStudentsLoading(false);
      }
    };
    fetchAllStudents();
  }, []);

  // Listen for changes to localStorage classMonitors
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('classMonitors');
      if (saved) {
        setClassMonitors(JSON.parse(saved));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check for changes periodically (since storage event doesn't fire for same tab)
    const interval = setInterval(() => {
      const saved = localStorage.getItem('classMonitors');
      if (saved) {
        const parsed = JSON.parse(saved);
        setClassMonitors(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(parsed)) {
            return parsed;
          }
          return prev;
        });
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Dynamically calculate class strengths from students
  const classStrengths = Array.from({ length: 10 }, (_, i) => {
    const classId = i + 1;
    const classAdmitted = `Class ${classId}`;
    const boys = students.filter(s => s.class_admitted === classAdmitted && s.gender === 'boys').length;
    const girls = students.filter(s => s.class_admitted === classAdmitted && s.gender === 'girls').length;
    
    // Debug logging
    console.log(`Class ${classId} calculation:`, {
      classAdmitted,
      totalStudents: students.length,
      studentsInClass: students.filter(s => s.class_admitted === classAdmitted),
      boys,
      girls
    });
    
    return { class: `Class ${classId}`, boys, girls, total: boys + girls };
  });

  // Filter students and classStrengths for the selected batch only
  // const selectedBatchYear = parseInt(batch.replace('Batch-', ''));
  // const filteredStudents = students.filter(s => s.batch === selectedBatchYear);
  // const filteredClassStrengths = classStrengths.filter((c, idx) => {
  //   // Find if any student in this class has the selected batch
  //   const classId = idx + 1;
  //   return students.some(s => (s.class_fk_id === classId || (s.class_fk && s.class_fk.id === classId)) && s.batch === selectedBatchYear);
  // });
  const totalStudents = students.length;

  const handleSearch = async () => {
    setSearchLoading(true);
    setSearchError(null);
    setShowDialog(true);
    try {
      const params = {};
      if (search.className) params.class_admitted = search.className;
      if (search.name) params.name = search.name;
      const response = await api.get('/students/', { params });
      const data = response.data;
      let filtered = data;
      if (search.name) {
        const searchName = search.name.trim().toLowerCase();
        filtered = data.filter(s => s.name && s.name.trim().toLowerCase() === searchName);
      }
      setSearchResults(Array.isArray(filtered) && filtered.length > 0 ? [filtered[0]] : []);
    } catch (err) {
      setSearchError('Failed to fetch students. ' + err.message);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex gap-2 w-full md:w-2/3">
          <div className="relative flex-1">
            <select
              className="w-full pl-3 pr-8 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none text-gray-700"
              value={search.className}
              onChange={e => setSearch(s => ({ ...s, className: e.target.value }))}
            >
              <option value="">Select Class</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1} value={`Class ${i + 1}`}>{`Class ${i + 1}`}</option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▼</span>
          </div>
          <div className="relative flex-1">
            <input
              type="text"
              className="w-full pl-3 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Search by Student Name"
              value={search.name}
              onChange={e => setSearch(s => ({ ...s, name: e.target.value }))}
            />
          </div>
        </div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-semibold" onClick={handleSearch} type="button">Search</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded shadow p-6 flex items-center gap-4">
          <FaUserGraduate className="text-3xl text-blue-500" />
          <div>
            <div className="text-xl font-semibold">Total Students</div>
            <div className="text-gray-700 text-base">{studentsLoading ? 'Loading...' : studentsError ? studentsError : totalStudents}</div>
          </div>
        </div>
        {/* Keep the other cards as placeholders or remove as needed */}
      </div>
      {/* Class Strength Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
        {classStrengths.map((c, idx) => (
          <button
            key={idx}
            className="relative bg-gradient-to-br from-blue-50 via-white to-pink-50 rounded-2xl shadow-xl p-8 flex flex-col items-center justify-center transition-transform duration-300 hover:scale-105 hover:shadow-2xl group overflow-hidden focus:outline-none"
            style={{ minHeight: 170 }}
            onClick={() => navigate('/students', { state: { classIdx: idx, gender: 'boys' } })}
            type="button"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-pink-400 to-yellow-300 rounded-t-2xl opacity-60 animate-pulse" />
            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-sm">
              {classMonitors[idx] || 'Class Monitor'}
            </div>
            <div className="text-lg font-bold mb-3 tracking-wide text-gray-700 group-hover:text-blue-700 transition-colors duration-300">
              {c.class}
            </div>
            <div className="mb-2 flex gap-6 text-xl font-extrabold tracking-wider">
              <span className="text-blue-600 flex items-center animate-fadeInUp">
                <svg className="w-5 h-5 mr-1 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 016 6v1a2 2 0 012 2v2a2 2 0 01-2 2v1a6 6 0 01-12 0v-1a2 2 0 01-2-2v-2a2 2 0 012-2V8a6 6 0 016-6z" /></svg>
                <span className="count-up" data-count={c.boys}>{c.boys}</span> Boys
              </span>
              <span className="text-pink-600 flex items-center animate-fadeInUp">
                <svg className="w-5 h-5 mr-1 text-pink-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 016 6v1a2 2 0 012 2v2a2 2 0 01-2 2v1a6 6 0 01-12 0v-1a2 2 0 01-2-2v-2a2 2 0 012-2V8a6 6 0 016-6z" /></svg>
                <span className="count-up" data-count={c.girls}>{c.girls}</span> Girls
              </span>
            </div>
            <div className="text-gray-700 text-base font-semibold mt-2 animate-fadeInUp">
              Total: <span className="text-yellow-600 font-bold count-up" data-count={c.total}>{c.total}</span>
            </div>
          </button>
        ))}
      </div>
      {/* Student Search Results Dialog */}
      {showDialog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-6 rounded shadow w-full max-w-lg relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700" onClick={() => setShowDialog(false)}>
              ×
            </button>
            <h2 className="text-xl font-bold mb-4">Search Results</h2>
            {searchLoading ? (
              <div className="text-blue-600">Loading...</div>
            ) : searchError ? (
              <div className="text-red-600">{searchError}</div>
            ) : searchResults.length > 0 ? (
              <>
                <table className="min-w-full border mb-2">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 border">Serial No</th>
                      <th className="px-4 py-2 border">Student Name</th>
                      <th className="px-4 py-2 border">Father's Name</th>
                      <th className="px-4 py-2 border">Class Admitted</th>
                      <th className="px-4 py-2 border">Gender</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((student) => (
                      <tr key={student.id}>
                        <td className="px-4 py-2 border">{student.serial_no || '-'}</td>
                        <td className="px-4 py-2 border">{student.name}</td>
                        <td className="px-4 py-2 border">{student.father_name || '-'}</td>
                        <td className="px-4 py-2 border">{student.class_admitted || '-'}</td>
                        <td className="px-4 py-2 border">{student.gender === 'boys' ? 'Boys' : 'Girls'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-center mt-4">
                  <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-semibold" onClick={() => setShowDialog(false)} type="button">OK</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-gray-500">No students found for this search.</div>
                <div className="flex justify-center mt-4">
                  <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-semibold" onClick={() => setShowDialog(false)} type="button">OK</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 