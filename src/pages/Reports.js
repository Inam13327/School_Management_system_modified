import React, { useState, useContext, useEffect, useRef } from 'react';
import { ClassSubjectContext } from './Students';
import { getFeeHistoryByStudent, getMarksSummaryByStudentAndClass } from '../api/axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useNavigate } from 'react-router-dom';

const genders = [
  { label: 'Boys', value: 'boys' },
  { label: 'Girls', value: 'girls' },
];

const Reports = () => {
  const { classNames } = useContext(ClassSubjectContext);
  const [selected, setSelected] = useState({ classIdx: null, gender: null });
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportStudent, setReportStudent] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentMarks, setStudentMarks] = useState([]);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [studentAttendance, setStudentAttendance] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [subjectTotals, setSubjectTotals] = useState({});
  const [feeHistory, setFeeHistory] = useState([]);
  const [marksSummary, setMarksSummary] = useState([]);
  const reportRef = useRef();
  const navigate = useNavigate();

  const handleDropdown = (classIdx) => {
    setOpenDropdown(openDropdown === classIdx ? null : classIdx);
  };

  const handleSelect = (classIdx, gender) => {
    setSelected({ classIdx, gender });
    setOpenDropdown(null);
  };

  const handleShowReport = async (student) => {
    setReportStudent(student);
    setShowReport(true);
    setLoadingMarks(true);
    setLoadingAttendance(true);
    setFeeHistory([]);
    setMarksSummary([]);

    let fetchedSubjects = [];
    let fetchedSubjectTotals = {};
    if (selected.classIdx !== null) {
      const classId = selected.classIdx + 1;
      const res = await fetch(`http://192.168.18.139:8000/api/subjects/?class_fk=${classId}`);
      if (res.ok) {
        const data = await res.json();
        fetchedSubjects = data.map(s => s.name);
        fetchedSubjectTotals = Object.fromEntries(fetchedSubjects.map(s => [s, 100]));
      }
    }
    setSubjects(fetchedSubjects);
    setSubjectTotals(fetchedSubjectTotals);

    // Fetch marks
    try {
      let allMarks = [];
      if (selected.classIdx !== null) {
        const classId = selected.classIdx + 1;
        const res = await fetch(`http://192.168.18.139:8000/api/marks/?class_fk=${classId}&student=${student.id}`);
        if (res.ok) {
          const data = await res.json();
          const marks = Array.isArray(data) ? data : data.value || [];
          allMarks = allMarks.concat(marks);
        }
      }
      setStudentMarks(allMarks);
    } catch {
      setStudentMarks([]);
    }
    setLoadingMarks(false);

    // Fetch attendance
    try {
      const classId = selected.classIdx !== null ? selected.classIdx + 1 : null;
      let attData = [];
      if (classId) {
        const attRes = await fetch(`http://192.168.18.139:8000/api/attendances/?student__class_admitted=Class ${classId}`);
        if (!attRes.ok) throw new Error('Failed to fetch attendance');
        const attDataRaw = await attRes.json();
        attData = Array.isArray(attDataRaw) ? attDataRaw : attDataRaw.value || [];
        attData = attData.filter(rec => rec.student === student.id);
      }
      const monthMap = {};
      attData.forEach((rec) => {
        const month = rec.date.slice(0, 7);
        if (!monthMap[month]) monthMap[month] = { present: 0, absent: 0 };
        if (rec.present) monthMap[month].present += 1;
        else monthMap[month].absent += 1;
      });
      const attendanceByMonth = Object.entries(monthMap).map(([month, vals]) => ({ month, ...vals }));
      setStudentAttendance(attendanceByMonth);
    } catch {
      setStudentAttendance([]);
    }
    setLoadingAttendance(false);

    // Fetch fee history
    try {
      const feeHist = await getFeeHistoryByStudent(student.id);
      setFeeHistory(feeHist);
    } catch {
      setFeeHistory([]);
    }

    // Fetch marks summary
    try {
      const summaries = [];
      if (selected.classIdx !== null) {
        const classId = selected.classIdx + 1;
        const summary = await getMarksSummaryByStudentAndClass(student.id, classId);
        summaries.push({ ...summary, className: classNames[selected.classIdx] });
      }
      setMarksSummary(summaries);
    } catch {
      setMarksSummary([]);
    }
  };

  const handleCloseReport = () => {
    setShowReport(false);
    setReportStudent(null);
    setStudentMarks([]);
    setStudentAttendance([]);
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 40;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
    pdf.save('report_card.pdf');
  };

  useEffect(() => {
    const fetchStudents = async () => {
      if (selected.classIdx === null || !selected.gender) {
        setStudents([]);
        return;
      }
      try {
        const classId = selected.classIdx + 1;
        const response = await fetch(
          `http://192.168.18.139:8000/api/students/?class_admitted=Class ${classId}&gender=${selected.gender}`
        );
        if (!response.ok) throw new Error('Failed to fetch students');
        const data = await response.json();
        setStudents(data);
      } catch {
        setStudents([]);
      }
    };
    fetchStudents();
  }, [selected.classIdx, selected.gender]);

  const filteredStudents = students;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Results</h1>

      {/* Class Navbar */}
      <div className="flex flex-wrap gap-4 mb-8">
        {classNames.map((className, idx) => (
          <div key={className} className="relative flex flex-col items-center gap-0">
            <button
              className={`flex items-center gap-2 px-4 py-2 rounded focus:outline-none ${
                selected.classIdx === idx
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
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

      <div className="bg-white rounded shadow p-6">
        {selected.classIdx !== null && selected.gender ? (
          filteredStudents.length > 0 ? (
            <table className="min-w-full border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 border">Student Name</th>
                  <th className="px-4 py-2 border">Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td className="px-4 py-2 border">{student.name}</td>
                    <td className="px-4 py-2 border text-center">
                      <button
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                        onClick={() => {
                          const classId = selected.classIdx !== null ? selected.classIdx + 1 : '';
                          navigate(`/report-card/${student.id}/${classId}`);
                        }}
                      >
                        Generate Result
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-gray-500">No students found for this selection.</div>
          )
        ) : (
          <div className="text-gray-500">Select a class and gender to view results.</div>
        )}
      </div>
    </div>
  );
};

export default Reports;
