import axios from "axios";

// =================== BASE URL HANDLER ===================
const getBaseURL = () => {
  return `http://192.168.18.139:8000/api`;
};


// =================== AXIOS INSTANCE ===================
const api = axios.create({
  baseURL: getBaseURL(),
});

// Token middleware
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;

// =================== CUSTOM HELPERS ===================

// Absentees count by class and month
export const getAbsenteesByClassAndMonth = async (classId, year, month) => {
  const res = await api.get(
    `/attendances/?student__class_admitted=Class ${classId}&date__year=${year}&date__month=${month}`
  );
  const attendance = res.data;
  const absenteesCount = {};
  attendance.forEach((a) => {
    if (!a.present) {
      absenteesCount[a.student] = (absenteesCount[a.student] || 0) + 1;
    }
  });
  return absenteesCount;
};

// Fees APIs
export const saveFee = async (feeData) => {
  return api.post("/fees/", feeData);
};

export const updateFee = async (feeId, feeData) => {
  return api.put(`/fees/${feeId}/`, feeData);
};

export const getFeeHistoryByStudent = async (studentId) => {
  const res = await api.get(`/fees/?student=${studentId}`);
  return (res.data || []).sort((a, b) => (a.month > b.month ? 1 : -1));
};

// Marks APIs
export const getMarksSummaryByStudentAndClass = async (studentId, classId) => {
  const res = await api.get(`/marks/summary/?student=${studentId}&class_fk=${classId}`);
  return res.data;
};
