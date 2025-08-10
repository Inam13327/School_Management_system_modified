import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';

const tabs = [
  { label: 'Personal Info', key: 'personal' },
  { label: 'Attendance', key: 'attendance' },
  { label: 'Marks', key: 'marks' },
  { label: 'Fee Record', key: 'fees' },
];

const StudentProfile = () => {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('personal');
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStudent = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/students/${id}/`);
        setStudent(res.data);
      } catch (err) {
        setError('Failed to fetch student profile');
      } finally {
        setLoading(false);
      }
    };
    fetchStudent();
  }, [id]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Student Profile</h1>
      <div className="mb-4 flex gap-4 border-b">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`py-2 px-4 -mb-px border-b-2 ${activeTab === tab.key ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-500'}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded shadow p-6 min-h-[200px]">
        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : !student ? (
          <div className="text-gray-500">No student data found.</div>
        ) : activeTab === 'personal' ? (
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <img src={student.pic || 'https://via.placeholder.com/96'} alt={student.name} className="w-24 h-24 rounded-full object-cover border" />
            <div>
              <div className="mb-2"><span className="font-semibold">Name:</span> {student.name}</div>
              <div className="mb-2"><span className="font-semibold">Father Name:</span> {student.father}</div>
              <div className="mb-2"><span className="font-semibold">Registration No:</span> {student.reg}</div>
              <div className="mb-2"><span className="font-semibold">Address:</span> {student.address}</div>
              <div className="mb-2"><span className="font-semibold">Gender:</span> {student.gender}</div>
              <div className="mb-2"><span className="font-semibold">Class:</span> {student.class}</div>
            </div>
          </div>
        ) : activeTab === 'attendance' ? (
          <div>[Attendance records will appear here]</div>
        ) : activeTab === 'marks' ? (
          <div>[Marks records will appear here]</div>
        ) : activeTab === 'fees' ? (
          <div>[Fee records will appear here]</div>
        ) : null}
      </div>
    </div>
  );
};

export default StudentProfile; 