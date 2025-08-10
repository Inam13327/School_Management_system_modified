import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;

// Attendance API helpers
export const getAttendanceByClass = async (classId) => {
  // Fetch attendance for all students in a class
  return api.get(`/attendances/?student__class_admitted=Class ${classId}`);
};

export const saveAttendanceBulk = async (attendanceList) => {
  // Bulk save attendance records
  return api.post('/attendances/', attendanceList);
};

export const getAttendanceByStudent = async (studentId) => {
  // Fetch attendance for a specific student
  return api.get(`/attendances/?student=${studentId}`);
};

// Attendance status helpers
export const mapAttendanceStatus = (value) => {
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'yes') return 'present';
    if (value.toLowerCase() === 'no') return 'absent';
  }
  return value;
};

export const displayAttendanceStatus = (value) => {
  if (value === true || value === 'present') return 'Present';
  if (value === false || value === 'absent') return 'Absent';
  return value;
};

// Fetch absent students in a class for today
export const getAbsentStudentsByClass = async (classId) => {
  // Fetch all students in the class
  const studentsRes = await api.get(`/students/?class_admitted=Class ${classId}`);
  const students = studentsRes.data;
  if (!students.length) return [];
  // Fetch today's attendance for these students
  const today = new Date().toISOString().slice(0, 10);
  const ids = students.map(s => s.id);
  const attRes = await api.get(`/attendances/?date=${today}&${ids.map(id => `student=${id}`).join('&')}`);
  const attendance = attRes.data;
  // Map student id to present status
  const presentMap = {};
  attendance.forEach(a => { presentMap[a.student] = a.present; });
  // Return students who are absent (no record or present=false)
  return students.filter(s => !presentMap[s.id]);
};

// Fetch attendance by date, status, and class
export const getAttendanceByDateStatusClass = async ({ date, status, classId }) => {
  // status: 'present' or 'absent'
  // classId: 1-10
  // date: 'YYYY-MM-DD'
  const params = [];
  if (date) params.push(`date=${date}`);
  if (status) params.push(`status=${status}`);
  if (classId) params.push(`class_admitted=Class ${classId}`);
  const query = params.length ? `?${params.join('&')}` : '';
  return api.get(`/attendances/${query}`);
};

// Fetch absentees count for each student in a class for a given month
export const getAbsenteesByClassAndMonth = async (classId, year, month) => {
  // Fetch all attendance records for the class and month
  const res = await api.get(`/attendances/?student__class_admitted=Class ${classId}&date__year=${year}&date__month=${month}`);
  const attendance = res.data;
  // Count absences per student
  const absenteesCount = {};
  attendance.forEach(a => {
    if (!a.present) {
      absenteesCount[a.student] = (absenteesCount[a.student] || 0) + 1;
    }
  });
  return absenteesCount;
};

// MARKS API HELPERS
export const getAllMarks = async () => {
  // Fetch all marks
  return api.get('/marks/');
};

export const getMarksByClass = async (classId) => {
  // Fetch marks for a specific class
  return api.get(`/marks/?class_fk=${classId}`);
};

export const getMarksByStudent = async (studentId) => {
  // Fetch marks for a specific student
  return api.get(`/marks/?student=${studentId}`);
};

export const searchMarksByClassAndName = async (classId, name) => {
  // Fetch students in class
  const studentsRes = await api.get(`/students/?class_admitted=Class ${classId}`);
  const students = studentsRes.data;
  // Filter students by name (case-insensitive, partial match)
  const filtered = students.filter(s => s.name.toLowerCase().includes(name.toLowerCase()));
  if (!filtered.length) return [];
  // Fetch marks for these students
  const allMarks = [];
  for (const student of filtered) {
    const marksRes = await api.get(`/marks/?student=${student.id}`);
    allMarks.push(...marksRes.data.map(m => ({ ...m, student_name: student.name })));
  }
  return allMarks;
};

// FEE API HELPERS
export const getFeesByClass = async (classId) => {
  // Fetch fee records for a specific class
  return api.get(`/fees/?student__class_admitted=Class ${classId}`);
};

export const getFeesByStudent = async (studentId) => {
  // Fetch fee records for a specific student
  return api.get(`/fees/?student=${studentId}`);
};

export const saveFee = async (feeData) => {
  // Create a new fee record
  return api.post('/fees/', feeData);
};

export const updateFee = async (feeId, feeData) => {
  // Update an existing fee record
  return api.put(`/fees/${feeId}/`, feeData);
};

// Fetch fee history for a student, sorted by month
export const getFeeHistoryByStudent = async (studentId) => {
  const res = await api.get(`/fees/?student=${studentId}`);
  // Sort by month ascending
  return (res.data || []).sort((a, b) => (a.month > b.month ? 1 : -1));
};

// Fetch marks summary for a student and class
export const getMarksSummaryByStudentAndClass = async (studentId, classId) => {
  // Use backend summary endpoint
  const res = await api.get(`/marks/summary/?student=${studentId}&class_fk=${classId}`);
  return res.data;
}; 