import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/Layout';
import Students, { ClassSubjectContext } from './pages/Students';
import ReportCardPage from './pages/ReportCardPage';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const StudentProfile = lazy(() => import('./pages/StudentProfile'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Marks = lazy(() => import('./pages/Marks'));
const Fees = lazy(() => import('./pages/Fees'));
const Reports = lazy(() => import('./pages/Reports'));
const MonthlyTest = lazy(() => import('./pages/MonthlyTest'));

function ProtectedRoute({ children, role: requiredRole, redirectForTeacher }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (requiredRole && role !== requiredRole) return <Navigate to="/" />;
  if (redirectForTeacher && role === 'teacher') return <Navigate to="/attendance" />;
  return children;
}

function App() {
  const [classNames, setClassNames] = React.useState(Array.from({ length: 10 }, (_, i) => `Class ${i + 1}`));
  const [subjectNames, setSubjectNames] = React.useState(Array.from({ length: 8 }, (_, i) => `Subject ${i + 1}`));
  return (
    <AuthProvider>
      <Router>
        <div style={{ fontFamily: 'Times New Roman, serif' }}>
          <Suspense fallback={<div>Loading...</div>}>
            <ClassSubjectContext.Provider value={{ classNames, setClassNames, subjectNames, setSubjectNames }}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute redirectForTeacher={true}><Layout><Dashboard /></Layout></ProtectedRoute>} />
              <Route path="/students" element={<ProtectedRoute><Layout><Students /></Layout></ProtectedRoute>} />
              <Route path="/students/:id" element={<ProtectedRoute><Layout><StudentProfile /></Layout></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute><Layout><Attendance /></Layout></ProtectedRoute>} />
              <Route path="/marks" element={<ProtectedRoute><Layout><Marks /></Layout></ProtectedRoute>} />
              <Route path="/fees" element={<ProtectedRoute><Layout><Fees /></Layout></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Layout><Reports /></Layout></ProtectedRoute>} />
              <Route path="/monthly-test" element={<ProtectedRoute><Layout><MonthlyTest /></Layout></ProtectedRoute>} />
              <Route path="/report-card/:studentId/:classId" element={<ProtectedRoute><Layout><ReportCardPage /></Layout></ProtectedRoute>} />
            </Routes>
          </ClassSubjectContext.Provider>
        </Suspense>
        <ToastContainer position="top-right" autoClose={3000} />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
