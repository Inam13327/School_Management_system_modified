import React, { useState, useEffect } from 'react';
import { FaUserGraduate, FaCalendarCheck, FaMoneyBillWave, FaSearch } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

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

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('classMonitors');
      if (saved) setClassMonitors(JSON.parse(saved));
    };

    window.addEventListener('storage', handleStorageChange);
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

  const classStrengths = Array.from({ length: 10 }, (_, i) => {
    const classId = i + 1;
    const classAdmitted = `Class ${classId}`;
    const boys = students.filter(s => s.class_admitted === classAdmitted && s.gender === 'boys').length;
    const girls = students.filter(s => s.class_admitted === classAdmitted && s.gender === 'girls').length;
    return { class: `Class ${classId}`, boys, girls, total: boys + girls };
  });

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
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome to the IPS Management System</p>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap items-center">
          <div className="w-full md:w-auto flex-1 mb-3 md:mb-0 md:mr-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by student name"
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-base"
                value={search.name}
                onChange={(e) => setSearch({ ...search, name: e.target.value })}
                aria-label="Search by student name"
              />
              <FaSearch className="absolute right-3 top-3.5 text-gray-400" />
            </div>
          </div>
          <div className="w-full md:w-auto flex-1 mb-3 md:mb-0 md:mr-4">
            <select
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-base"
              value={search.className}
              onChange={(e) => setSearch({ ...search, className: e.target.value })}
              aria-label="Filter by class"
            >
              <option value="">All Classes</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={`Class ${i + 1}`}>
                  Class {i + 1}
                </option>
              ))}
            </select>
          </div>
          <button
            className="w-full md:w-auto bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors text-base font-medium min-height-44"
            onClick={handleSearch}
            aria-label="Search students"
          >
            Search
          </button>
        </div>
      </div>

      {/* Info Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Students Card */}
        <div 
          className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/students')}
        >
          <div className="flex items-center mb-4">
            <div className="bg-blue-100 p-4 rounded-full mr-4">
              <FaUserGraduate className="text-blue-500 text-2xl" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Students</h3>
              <p className="text-gray-500">Total enrolled</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-800">{totalStudents}</div>
          <div className="mt-4">
            <span className="text-blue-500 font-medium">View all students →</span>
          </div>
        </div>

        {/* Attendance Card */}
        <div 
          className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/attendance')}
        >
          <div className="flex items-center mb-4">
            <div className="bg-green-100 p-4 rounded-full mr-4">
              <FaCalendarCheck className="text-green-500 text-2xl" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Attendance</h3>
              <p className="text-gray-500">Today's status</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-800">--</div>
          <div className="mt-4">
            <span className="text-green-500 font-medium">View attendance →</span>
          </div>
        </div>

        {/* Fees Card */}
        <div 
          className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/fees')}
        >
          <div className="flex items-center mb-4">
            <div className="bg-purple-100 p-4 rounded-full mr-4">
              <FaMoneyBillWave className="text-purple-500 text-2xl" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Fees</h3>
              <p className="text-gray-500">Collection status</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-800">--</div>
          <div className="mt-4">
            <span className="text-purple-500 font-medium">View fee details →</span>
          </div>
        </div>
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
    </div>
  );
};

export default Dashboard;
