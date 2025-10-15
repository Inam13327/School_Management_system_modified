import React, { useRef, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useNavigate, useParams } from 'react-router-dom';

const reportCardStyle = {
  fontFamily: 'serif',
  background: 'linear-gradient(to right, #e6d3b3 30%, #fff 100%)',
  minHeight: '100vh',
  padding: 0,
  margin: 0,
};
const a4BoxStyle = {
  width: 794, // A4 width in px at 96dpi
  height: 1123, // A4 height in px at 96dpi
  background: '#fff',
  margin: '40px auto',
  boxShadow: '0 0 24px 4px #bfa76a55',
  borderRadius: 8,
  position: 'relative',
  display: 'flex',
  flexDirection: 'row',
  overflow: 'hidden',
};
const leftPanelStyle = {
  background: '#d9c299',
  width: 180,
  minHeight: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 40,
  position: 'relative',
};
const mainPanelStyle = {
  flex: 1,
  padding: '40px 40px 40px 60px',
};
const tableHeaderStyle = {
  background: '#bfa76a',
  color: '#fff',
  fontWeight: 'bold',
};
const tableCellStyle = {
  border: '1px solid #bfa76a',
  padding: 6,
  fontSize: 15,
};
const sectionTitleStyle = {
  fontWeight: 'bold',
  marginTop: 24,
  marginBottom: 8,
  fontSize: 18,
  color: '#7a5c1c',
};
const gradingBoxStyle = {
  background: '#bfa76a',
  color: '#fff',
  padding: '6px 18px',
  borderRadius: 4,
  fontWeight: 'bold',
  display: 'inline-block',
  marginTop: 8,
};
const topBarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  maxWidth: 794,
  margin: '0 auto',
  padding: '24px 0 0 0',
};
const buttonStyle = {
  background: '#1a237e', // dark blue
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  padding: '10px 22px',
  fontWeight: 'bold',
  fontSize: 17,
  cursor: 'pointer',
  marginRight: 12,
  boxShadow: '0 2px 8px #bfa76a55',
  letterSpacing: 1,
  transition: 'background 0.2s',
};

function getGrade(marks) {
  if (marks >= 90) return 'A';
  if (marks >= 80) return 'B';
  if (marks >= 70) return 'C';
  if (marks >= 60) return 'D';
  return 'F';
}

const ReportCardPage = () => {
  const cardRef = useRef();
  const navigate = useNavigate();
  const { studentId, classId } = useParams();
  const [subjects, setSubjects] = useState([]); // [{name, teacher, ...}]
  const [marks, setMarks] = useState([]); // [{subject, marks, ...}]
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, total: 0, percent: 0 });

  useEffect(() => {
    if (!studentId || !classId) return;
    const fetchData = async () => {
      setLoading(true);
      // Fetch student details
      const studentRes = await fetch(`http://192.168.100.2:8000/api/students/${studentId}/`);
      if (studentRes.ok) {
        setStudent(await studentRes.json());
      }
      // Fetch subjects for class
      const subRes = await fetch(`http://192.168.100.2:8000/api/subjects/?class_fk=${classId}`);
      let subjectList = [];
      if (subRes.ok) {
        subjectList = await subRes.json();
      }
      setSubjects(subjectList);
      // Fetch marks for student in this class
      const marksRes = await fetch(`http://192.168.100.2:8000/api/marks/?class_fk=${classId}&student=${studentId}`);
      let marksList = [];
      if (marksRes.ok) {
        marksList = await marksRes.json();
      }
      setMarks(marksList);
      // Fetch attendance for student in this class
      const attRes = await fetch(`http://192.168.100.2:8000/api/attendances/?student=${studentId}&student__class_fk=${classId}`);
      let attList = [];
      if (attRes.ok) {
        attList = await attRes.json();
      }
      const present = attList.filter(a => a.present).length;
      const total = attList.length;
      const percent = total > 0 ? Math.round((present / total) * 100) : 0;
      setAttendanceStats({ present, total, percent });
      setLoading(false);
    };
    fetchData();
  }, [studentId, classId]);

  // Map subject id to marks
  const marksMap = {};
  marks.forEach(m => {
    marksMap[m.subject?.id || m.subject_id] = m;
  });

  // Calculate total obtained and total marks for final grade
  const totalMarks = subjects.reduce((sum, subj) => sum + (subj.total_marks || 100), 0);
  const obtainedMarks = subjects.reduce((sum, subj) => {
    const markObj = marksMap[subj.id];
    // Use pending marks if available, otherwise use current marks
    const marksVal = markObj ? Number(markObj.marks) : 0;
    return sum + (isNaN(marksVal) ? 0 : marksVal);
  }, 0);
  let finalGrade = '-';
  if (totalMarks > 0) {
    const percent = (obtainedMarks / totalMarks) * 100;
    if (percent >= 90) finalGrade = 'A';
    else if (percent >= 80) finalGrade = 'B';
    else if (percent >= 70) finalGrade = 'C';
    else if (percent >= 60) finalGrade = 'D';
    else finalGrade = 'F';
  }

  return (
    <div style={reportCardStyle}>
      <div style={topBarStyle}>
        <button style={buttonStyle} onClick={() => navigate(-1)}>Back</button>
        <button style={buttonStyle} onClick={async () => {
          if (!cardRef.current) return;
          const canvas = await html2canvas(cardRef.current, { scale: 2 });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [794, 1123] });
          pdf.addImage(imgData, 'PNG', 0, 0, 794, 1123);
          pdf.save('report_card.pdf');
        }}>Download PDF</button>
      </div>
      <div style={a4BoxStyle} ref={cardRef}>
        <div style={leftPanelStyle}>
          <div style={{ marginBottom: 30 }}>
            <div style={{ width: 80, height: 80, background: '#fff', borderRadius: '50%', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#bfa76a', fontWeight: 'bold' }}>🏫</div>
            <div style={{ textAlign: 'center', fontWeight: 'bold', color: '#7a5c1c', fontSize: 16 }}>SCHOOL NAME</div>
          </div>
        </div>
        <div style={mainPanelStyle}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 'bold', letterSpacing: 1 }}>SCHOOL NAME</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', margin: '8px 0 0 0', letterSpacing: 2 }}>REPORT CARD</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <span style={{ fontWeight: 'bold', color: '#7a5c1c' }}>SHEET NO:</span>
            <span style={{ marginLeft: 8 }}>00123</span>
          </div>
          <div style={{ marginBottom: 18 }}>
            <div><span style={{ fontWeight: 'bold', color: '#7a5c1c' }}>STUDENT NAME:</span> {student ? student.name : '...'}</div>
            <div><span style={{ fontWeight: 'bold', color: '#7a5c1c' }}>LEVEL AND SECTION:</span> Grade 5 - A</div>
            <div><span style={{ fontWeight: 'bold', color: '#7a5c1c' }}>TEACHERS NAME:</span> Ms. Johnson</div>
            <div><span style={{ fontWeight: 'bold', color: '#7a5c1c' }}>MAJOR LANGUAGE:</span> English</div>
            <div><span style={{ fontWeight: 'bold', color: '#7a5c1c' }}>SCHOOL YEAR:</span> 2023-2024</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
            <thead>
              <tr>
                <th style={{ ...tableCellStyle, ...tableHeaderStyle }}>Subject Name</th>
                <th style={{ ...tableCellStyle, ...tableHeaderStyle }}>Total Marks</th>
                <th style={{ ...tableCellStyle, ...tableHeaderStyle }}>Obtained Marks</th>
                <th style={{ ...tableCellStyle, ...tableHeaderStyle }}>Grade</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={tableCellStyle}>Loading...</td></tr>
              ) : (
                <>
                  {subjects.map((subj, idx) => {
                    const markObj = marksMap[subj.id];
                    const marksVal = markObj ? Number(markObj.marks) : null;
                    const totalMarks = subj.total_marks || 100;
                    const hasPendingChanges = markObj?.has_pending_changes;
                    const pendingMarks = markObj?.pending_marks;
                    
                    return (
                      <tr key={subj.id}>
                        <td style={tableCellStyle}>{subj.name}</td>
                        <td style={tableCellStyle}>{totalMarks}</td>
                        <td style={tableCellStyle}>
                          {hasPendingChanges && pendingMarks !== undefined ? (
                            marksVal !== null ? marksVal : '-'
                          ) : (
                            marksVal !== null ? marksVal : '-'
                          )}
                        </td>
                        <td style={tableCellStyle}>
                          {hasPendingChanges && pendingMarks !== undefined ? (
                            marksVal !== null ? getGrade(marksVal) : '-'
                          ) : (
                            marksVal !== null ? getGrade(marksVal) : '-'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total Marks Row */}
                  <tr>
                    <td style={{ ...tableCellStyle, fontWeight: 'bold' }}>Total Marks</td>
                    <td style={{ ...tableCellStyle, fontWeight: 'bold' }}>
                      {subjects.reduce((sum, subj) => sum + (subj.total_marks || 100), 0)}
                    </td>
                    <td style={{ ...tableCellStyle, fontWeight: 'bold' }}>
                      {(() => {
                        const currentObtained = subjects.reduce((sum, subj) => {
                          const markObj = marksMap[subj.id];
                          const marksVal = markObj ? Number(markObj.marks) : 0;
                          return sum + (isNaN(marksVal) ? 0 : marksVal);
                        }, 0);
                        
                        const pendingObtained = subjects.reduce((sum, subj) => {
                          const markObj = marksMap[subj.id];
                          const hasPending = markObj?.has_pending_changes;
                          const marksVal = hasPending && markObj?.pending_marks !== undefined ? 
                            Number(markObj.pending_marks) : 
                            (markObj ? Number(markObj.marks) : 0);
                          return sum + (isNaN(marksVal) ? 0 : marksVal);
                        }, 0);
                        
                        const hasAnyPendingChanges = subjects.some(subj => {
                          const markObj = marksMap[subj.id];
                          return markObj?.has_pending_changes;
                        });
                        
                        if (hasAnyPendingChanges) {
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <div style={{ fontSize: '12px', color: '#666', textDecoration: 'line-through' }}>
                                {currentObtained}
                              </div>
                              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#d97706' }}>
                                {pendingObtained}
                              </div>
                            </div>
                          );
                        } else {
                          return currentObtained;
                        }
                      })()}
                    </td>
                    <td style={tableCellStyle}></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 40, marginBottom: 24 }}>
            <div style={{ flex: 1 }}>
              <div style={sectionTitleStyle}>Attendance</div>
              <div
                style={{
                  border: '2px solid #bfa76a',
                  minHeight: 32,
                  background: 'linear-gradient(90deg, #f7f1e1 60%, #fffbe6 100%)',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  padding: '4px 0 4px 16px',
                  fontWeight: 'bold',
                  fontSize: 14,
                  color: '#7a5c1c',
                  letterSpacing: 1,
                  boxShadow: '0 1px 6px #bfa76a33',
                  marginTop: 4,
                }}
              >
                {attendanceStats.total > 0
                  ? (<>
                        <div>Total Classes: {attendanceStats.total}</div>
                        <div>Absentees: {attendanceStats.total - attendanceStats.present}</div>
                        <div>Attendance: {attendanceStats.percent}%</div>
                      </>)
                    : 'No attendance records'}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={sectionTitleStyle}>Note</div>
              <div style={{ border: '1px solid #bfa76a', minHeight: 40, background: '#f7f1e1', borderRadius: 4, display: 'flex', alignItems: 'center', padding: '8px 12px', fontWeight: 'bold', fontSize: 14, color: '#7a5c1c' }}>
                {student && finalGrade !== '-' ? `${student.name} passed the exam with grade ${finalGrade}` : ''}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <div style={gradingBoxStyle}>Grading System</div>
            <div style={{ marginTop: 6, color: '#7a5c1c', fontWeight: 'bold' }}>
              A = 90 - 100 | B = 80 - 89 | C = 70 - 79 | D = 60 - 69 | E = 60 BELOW
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportCardPage; 