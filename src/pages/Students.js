import React, { useState, useEffect, createContext } from 'react';
import { FaChevronDown, FaPlus, FaSearch } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const defaultClassNames = Array.from({ length: 10 }, (_, i) => `Class ${i + 1}`);
const defaultSubjectNames = Array.from({ length: 8 }, (_, i) => `Subject ${i + 1}`);

const classes = Array.from({ length: 10 }, (_, i) => `Class ${i + 1}`);
const genders = [
  { label: 'Boys', value: 'boys' },
  { label: 'Girls', value: 'girls' },
];

const ageOptions = Array.from({ length: 18 }, (_, i) => `${i + 1} years`);

const initialForm = { 
  name: '', 
  father_name: '', 
  serial_no: '', 
  date_of_admission: '', 
  dob: '', 
  dob_words: '', 
  tribe_or_caste: '', 
  occupation: '', 
  residence: '', 
  class_admitted: '', 
  age_at_admission: '', 
  class_withdrawn: '', 
  date_of_withdrawal: '', 
  remarks: '', 
  pic: null, 
  classIdx: 0,
  gender: 'boys',
  batch_no: ''
};

export const ClassSubjectContext = createContext();

const Students = () => {
  const [openDropdown, setOpenDropdown] = useState(null);
  const [selected, setSelected] = useState({ classIdx: 0, gender: 'boys' });
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const { role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState({ name: '', father_name: '', serial_no: '' });
  const [classNames, setClassNames] = useState(defaultClassNames);
  const [subjectNames, setSubjectNames] = useState(defaultSubjectNames);
  const [editingClassIdx, setEditingClassIdx] = useState(null);
  const [editingSubjectIdx, setEditingSubjectIdx] = useState(null);
  const [editingClassValue, setEditingClassValue] = useState('');
  const [editingSubjectValue, setEditingSubjectValue] = useState('');
  const [pendingClassNames, setPendingClassNames] = useState(classNames);
  const [pendingSubjectNames, setPendingSubjectNames] = useState(subjectNames);
  const [isEditing, setIsEditing] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState(initialForm);
  const [editId, setEditId] = useState(null);
  const [classMonitors, setClassMonitors] = useState(() => {
    const saved = localStorage.getItem('classMonitors');
    return saved ? JSON.parse(saved) : Array.from({ length: 10 }, () => 'Class Monitor');
  });
  const [showMonitorModal, setShowMonitorModal] = useState(false);
  const [editingMonitorIdx, setEditingMonitorIdx] = useState(null);
  const [monitorText, setMonitorText] = useState('');

  useEffect(() => {
    if (location.state && typeof location.state.classIdx === 'number') {
      setSelected(sel => ({ 
        ...sel, 
        classIdx: location.state.classIdx,
        gender: location.state.gender || 'boys'
      }));
    }
  }, [location.state]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (selected.classIdx === null || !selected.gender) {
        setStudents([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const classId = selected.classIdx + 1;
  
        
        // First test if the server is accessible
        try {
          const testResponse = await fetch('http://localhost:8000/api/students/', {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          });

        } catch (testErr) {
          console.error('Server connection test failed:', testErr);
          throw new Error('Cannot connect to server. Please make sure the Django server is running on http://localhost:8000');
        }
        
        const response = await fetch(`http://localhost:8000/api/students/?class_admitted=Class ${classId}&gender=${selected.gender}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
        
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch students: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();

        
        setStudents(
          data.map(s => {
            let picUrl = '';
            if (s.pic) {
              if (s.pic.startsWith('http')) {
                picUrl = s.pic;
              } else if (s.pic.startsWith('/')) {
                picUrl = `http://localhost:8000${s.pic}`;
              } else {
                picUrl = `http://localhost:8000/media/student_pics/${s.pic}`;
              }
            }
            // Debug log
            console.log('Student:', s.name, 'Raw pic:', s.pic, 'Resolved picUrl:', picUrl);
            return {
              ...s,
              class: s.class_admitted || `Class ${classId}`,
              pic: picUrl,
            };
          })
        );
      } catch (err) {
        console.error('Error fetching students:', err);
        setError('Failed to load students. ' + err.message);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [selected.classIdx, selected.gender]);

  const handleDropdown = (classIdx) => {
    setOpenDropdown(openDropdown === classIdx ? null : classIdx);
  };

  const handleSelect = (classIdx, gender) => {
    setSelected({ classIdx, gender });
    setOpenDropdown(null);
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const classId = form.classIdx + 1;
    const formData = new FormData();
    formData.append('name', form.name);
    formData.append('father_name', form.father_name);
    formData.append('serial_no', form.serial_no);
    formData.append('date_of_admission', form.date_of_admission);
    formData.append('dob', form.dob);
    formData.append('dob_words', form.dob_words);
    formData.append('tribe_or_caste', form.tribe_or_caste);
    formData.append('occupation', form.occupation);
    formData.append('residence', form.residence);
    formData.append('class_admitted', form.class_admitted || `Class ${classId}`);
    formData.append('gender', form.gender);
    formData.append('age_at_admission', form.age_at_admission);
    formData.append('class_withdrawn', form.class_withdrawn);
    formData.append('date_of_withdrawal', form.date_of_withdrawal);
    formData.append('remarks', form.remarks);
    formData.append('batch_no', form.batch_no);
    if (form.pic) {
      formData.append('pic', form.pic);
    }
    try {
      const response = await fetch('http://localhost:8000/api/students/', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(JSON.stringify(errData));
      }
      // Refetch students after successful add, using current filter
      if (selected.classIdx !== null && selected.gender) {
        const classId = selected.classIdx + 1;
        const res = await fetch(`http://localhost:8000/api/students/?class_admitted=Class ${classId}&gender=${selected.gender}`);
        const data = await res.json();
        setStudents(
          data.map(s => {
            let picUrl = '';
            if (s.pic) {
              if (s.pic.startsWith('http')) {
                picUrl = s.pic;
              } else if (s.pic.startsWith('/')) {
                picUrl = `http://localhost:8000${s.pic}`;
              } else {
                picUrl = `http://localhost:8000/media/student_pics/${s.pic}`;
              }
            }
            // Debug log
            console.log('Student:', s.name, 'Raw pic:', s.pic, 'Resolved picUrl:', picUrl);
            return {
              ...s,
              class: s.class_admitted || `Class ${classId}`,
              pic: picUrl,
            };
          })
        );
      }
      setShowModal(false);
      setForm(initialForm);
      setSelected({ classIdx: form.classIdx, gender: form.gender });
    } catch (err) {
      setError('Failed to add student. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedClass = selected.classIdx !== null ? classes[selected.classIdx] : null;
  const selectedGender = selected.gender;

  const handleEditClassClick = (idx) => {
    setEditingClassIdx(idx);
    setEditingClassValue(pendingClassNames[idx]);
    setIsEditing(true);
  };
  const handleEditClassChange = (e) => setEditingClassValue(e.target.value);
  const handleEditClassBlur = (idx) => {
    setPendingClassNames(prev => prev.map((name, i) => (i === idx ? editingClassValue : name)));
    setEditingClassIdx(null);
  };
  const handleEditClassKeyDown = (e, idx) => {
    if (e.key === 'Enter') handleEditClassBlur(idx);
  };
  const handleEditSubjectClick = (idx) => {
    setEditingSubjectIdx(idx);
    setEditingSubjectValue(pendingSubjectNames[idx]);
    setIsEditing(true);
  };
  const handleEditSubjectChange = (e) => setEditingSubjectValue(e.target.value);
  const handleEditSubjectBlur = (idx) => {
    setPendingSubjectNames(prev => prev.map((name, i) => (i === idx ? editingSubjectValue : name)));
    setEditingSubjectIdx(null);
  };
  const handleEditSubjectKeyDown = (e, idx) => {
    if (e.key === 'Enter') handleEditSubjectBlur(idx);
  };
  const handleSaveNames = () => {
    setClassNames(pendingClassNames);
    setSubjectNames(pendingSubjectNames);
    setIsEditing(false);
  };

  const handleEditMonitor = (idx) => {
    setEditingMonitorIdx(idx);
    setMonitorText(classMonitors[idx]);
    setShowMonitorModal(true);
  };

  const handleSaveMonitor = () => {
    if (editingMonitorIdx !== null) {
      const updatedMonitors = classMonitors.map((monitor, i) => 
        i === editingMonitorIdx ? monitorText : monitor
      );
      setClassMonitors(updatedMonitors);
      // Save to localStorage for Dashboard to access
      localStorage.setItem('classMonitors', JSON.stringify(updatedMonitors));
    }
    setShowMonitorModal(false);
    setEditingMonitorIdx(null);
    setMonitorText('');
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8000/api/students/${studentId}/`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete student');
      setStudents(prev => prev.filter(s => s.id !== studentId));
    } catch (err) {
      setError('Failed to delete student. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStudent = (student) => {
    setEditForm({
      name: student.name || '',
      father_name: student.father_name || '',
      serial_no: student.serial_no || '',
      date_of_admission: student.date_of_admission || '',
      dob: student.dob || '',
      dob_words: student.dob_words || '',
      tribe_or_caste: student.tribe_or_caste || '',
      occupation: student.occupation || '',
      residence: student.residence || '',
      class_admitted: student.class_admitted || '',
      age_at_admission: student.age_at_admission || '',
      class_withdrawn: student.class_withdrawn || '',
      date_of_withdrawal: student.date_of_withdrawal || '',
      remarks: student.remarks || '',
      pic: null,
      classIdx: 0,
      gender: student.gender || 'boys',
    });
    setEditId(student.id);
    setEditModal(true);
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('name', editForm.name);
    formData.append('father_name', editForm.father_name);
    formData.append('serial_no', editForm.serial_no);
    formData.append('date_of_admission', editForm.date_of_admission);
    formData.append('dob', editForm.dob);
    formData.append('dob_words', editForm.dob_words);
    formData.append('tribe_or_caste', editForm.tribe_or_caste);
    formData.append('occupation', editForm.occupation);
    formData.append('residence', editForm.residence);
    formData.append('class_admitted', editForm.class_admitted);
    formData.append('gender', editForm.gender);
    formData.append('age_at_admission', editForm.age_at_admission);
    formData.append('class_withdrawn', editForm.class_withdrawn);
    formData.append('date_of_withdrawal', editForm.date_of_withdrawal);
    formData.append('remarks', editForm.remarks);
    formData.append('batch_no', editForm.batch_no);
    if (editForm.pic) {
      formData.append('pic', editForm.pic);
    }
    try {
      const response = await fetch(`http://localhost:8000/api/students/${editId}/`, {
        method: 'PUT',
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(JSON.stringify(errData));
      }
      // Refetch students after successful update
      if (selected.classIdx !== null && selected.gender) {
        const classId = selected.classIdx + 1;
        const res = await fetch(`http://localhost:8000/api/students/?class_admitted=Class ${classId}&gender=${selected.gender}`);
        const data = await res.json();
        setStudents(
          data.map(s => {
            let picUrl = '';
            if (s.pic) {
              if (s.pic.startsWith('http')) {
                picUrl = s.pic;
              } else if (s.pic.startsWith('/')) {
                picUrl = `http://localhost:8000${s.pic}`;
              } else {
                picUrl = `http://localhost:8000/media/student_pics/${s.pic}`;
              }
            }
            return {
              ...s,
              class: s.class_admitted || `Class ${classId}`,
              pic: picUrl,
            };
          })
        );
      }
      setEditModal(false);
      setEditForm(initialForm);
      setEditId(null);
    } catch (err) {
      setError('Failed to update student. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClassSubjectContext.Provider value={{ classNames, setClassNames, subjectNames, setSubjectNames }}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Student Management</h1>
        {/* Add Student Button at the top */}
        <button
          className="mb-6 flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          onClick={() => setShowModal(true)}
        >
          <FaPlus /> Add Student
        </button>
        {/* Class Navbar */}
        <div className="flex flex-wrap gap-4 mb-8">
          {pendingClassNames.map((className, idx) => (
            <div key={className} className="relative flex flex-col items-center gap-1">
              <button
                className={`flex items-center gap-2 px-4 py-2 rounded focus:outline-none ${selected.classIdx === idx ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                onClick={() => handleDropdown(idx)}
              >
                {className}
                <FaChevronDown className="ml-1" />
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
        {isEditing && (
          <button
            className="mb-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
            onClick={handleSaveNames}
          >
            Save
          </button>
        )}
        {/* Add Student Modal */}
        {showModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
            <div className="bg-white p-6 rounded shadow w-full max-w-4xl max-h-screen overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Add Student</h2>
              <form onSubmit={handleAddStudent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="mb-2">
                  <label className="block mb-1">Serial No</label>
                  <input className="w-full border rounded px-3 py-2" value={form.serial_no} onChange={e => setForm({ ...form, serial_no: e.target.value })} required />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Student Name</label>
                  <input className="w-full border rounded px-3 py-2" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Father Name</label>
                  <input className="w-full border rounded px-3 py-2" value={form.father_name} onChange={e => setForm({ ...form, father_name: e.target.value })} required />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Date of Admission</label>
                  <input type="date" className="w-full border rounded px-3 py-2" value={form.date_of_admission} onChange={e => setForm({ ...form, date_of_admission: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Date of Birth</label>
                  <input type="date" className="w-full border rounded px-3 py-2" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Date of Birth (Words)</label>
                  <input className="w-full border rounded px-3 py-2" value={form.dob_words} onChange={e => setForm({ ...form, dob_words: e.target.value })} placeholder="e.g., First January Two Thousand" />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Tribe or Caste</label>
                  <input className="w-full border rounded px-3 py-2" value={form.tribe_or_caste} onChange={e => setForm({ ...form, tribe_or_caste: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Occupation</label>
                  <input className="w-full border rounded px-3 py-2" value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Residence</label>
                  <input className="w-full border rounded px-3 py-2" value={form.residence} onChange={e => setForm({ ...form, residence: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Class Admitted</label>
                  <select 
                    className="w-full border rounded px-3 py-2" 
                    value={form.class_admitted} 
                    onChange={e => setForm({ ...form, class_admitted: e.target.value })}
                    required
                  >
                    <option value="">Select a class</option>
                    {classes.map((className, index) => (
                      <option key={index} value={className}>
                        {className}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Gender</label>
                  <select 
                    className="w-full border rounded px-3 py-2" 
                    value={form.gender} 
                    onChange={e => setForm({ ...form, gender: e.target.value })}
                    required
                  >
                    <option value="boys">Boys</option>
                    <option value="girls">Girls</option>
                  </select>
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Age at Admission</label>
                  <select 
                    className="w-full border rounded px-3 py-2" 
                    value={form.age_at_admission} 
                    onChange={e => setForm({ ...form, age_at_admission: e.target.value })}
                    required
                  >
                    <option value="">Select an age</option>
                    {ageOptions.map((age, index) => (
                      <option key={index} value={age}>
                        {age}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Class Withdrawn</label>
                  <select 
                    className="w-full border rounded px-3 py-2" 
                    value={form.class_withdrawn} 
                    onChange={e => setForm({ ...form, class_withdrawn: e.target.value })}
                  >
                    <option value="">Select a class (optional)</option>
                    {classes.map((className, index) => (
                      <option key={index} value={className}>
                        {className}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Date of Withdrawal</label>
                  <input type="date" className="w-full border rounded px-3 py-2" value={form.date_of_withdrawal} onChange={e => setForm({ ...form, date_of_withdrawal: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Batch No</label>
                  <input className="w-full border rounded px-3 py-2" value={form.batch_no} onChange={e => setForm({ ...form, batch_no: e.target.value })} />
                </div>
                <div className="mb-2 md:col-span-2">
                  <label className="block mb-1">Remarks</label>
                  <textarea className="w-full border rounded px-3 py-2" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} rows="3" />
                </div>
                <div className="mb-2 md:col-span-2">
                  <label className="block mb-1">Picture</label>
                  <input type="file" accept="image/*" className="w-full border rounded px-3 py-2" onChange={e => setForm({ ...form, pic: e.target.files[0] })} />
                </div>
                <div className="flex gap-2 md:col-span-2">
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    {loading ? 'Adding...' : 'Add'}
                  </button>
                  <button type="button" className="bg-gray-300 px-4 py-2 rounded" onClick={() => setShowModal(false)}>Cancel</button>
                </div>
                {error && <p className="mt-2 text-red-600 text-sm md:col-span-2">{error}</p>}
              </form>
            </div>
          </div>
        )}
        {editModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
            <div className="bg-white p-6 rounded shadow w-full max-w-4xl max-h-screen overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Edit Student</h2>
              <form onSubmit={handleUpdateStudent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="mb-2">
                  <label className="block mb-1">Serial No</label>
                  <input className="w-full border rounded px-3 py-2" value={editForm.serial_no} onChange={e => setEditForm({ ...editForm, serial_no: e.target.value })} required />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Student Name</label>
                  <input className="w-full border rounded px-3 py-2" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Father Name</label>
                  <input className="w-full border rounded px-3 py-2" value={editForm.father_name} onChange={e => setEditForm({ ...editForm, father_name: e.target.value })} required />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Date of Admission</label>
                  <input type="date" className="w-full border rounded px-3 py-2" value={editForm.date_of_admission} onChange={e => setEditForm({ ...editForm, date_of_admission: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Date of Birth</label>
                  <input type="date" className="w-full border rounded px-3 py-2" value={editForm.dob} onChange={e => setEditForm({ ...editForm, dob: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Date of Birth (Words)</label>
                  <input className="w-full border rounded px-3 py-2" value={editForm.dob_words} onChange={e => setEditForm({ ...editForm, dob_words: e.target.value })} placeholder="e.g., First January Two Thousand" />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Tribe or Caste</label>
                  <input className="w-full border rounded px-3 py-2" value={editForm.tribe_or_caste} onChange={e => setEditForm({ ...editForm, tribe_or_caste: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Occupation</label>
                  <input className="w-full border rounded px-3 py-2" value={editForm.occupation} onChange={e => setEditForm({ ...editForm, occupation: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Residence</label>
                  <input className="w-full border rounded px-3 py-2" value={editForm.residence} onChange={e => setEditForm({ ...editForm, residence: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Class Admitted</label>
                  <select 
                    className="w-full border rounded px-3 py-2" 
                    value={editForm.class_admitted} 
                    onChange={e => setEditForm({ ...editForm, class_admitted: e.target.value })}
                    required
                  >
                    <option value="">Select a class</option>
                    {classes.map((className, index) => (
                      <option key={index} value={className}>
                        {className}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Gender</label>
                  <select 
                    className="w-full border rounded px-3 py-2" 
                    value={editForm.gender} 
                    onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                    required
                  >
                    <option value="boys">Boys</option>
                    <option value="girls">Girls</option>
                  </select>
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Age at Admission</label>
                  <select 
                    className="w-full border rounded px-3 py-2" 
                    value={editForm.age_at_admission} 
                    onChange={e => setEditForm({ ...editForm, age_at_admission: e.target.value })}
                    required
                  >
                    <option value="">Select an age</option>
                    {ageOptions.map((age, index) => (
                      <option key={index} value={age}>
                        {age}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Class Withdrawn</label>
                  <select 
                    className="w-full border rounded px-3 py-2" 
                    value={editForm.class_withdrawn} 
                    onChange={e => setEditForm({ ...editForm, class_withdrawn: e.target.value })}
                  >
                    <option value="">Select a class (optional)</option>
                    {classes.map((className, index) => (
                      <option key={index} value={className}>
                        {className}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Date of Withdrawal</label>
                  <input type="date" className="w-full border rounded px-3 py-2" value={editForm.date_of_withdrawal} onChange={e => setEditForm({ ...editForm, date_of_withdrawal: e.target.value })} />
                </div>
                <div className="mb-2">
                  <label className="block mb-1">Batch No</label>
                  <input className="w-full border rounded px-3 py-2" value={editForm.batch_no} onChange={e => setEditForm({ ...editForm, batch_no: e.target.value })} />
                </div>
                <div className="mb-2 md:col-span-2">
                  <label className="block mb-1">Remarks</label>
                  <textarea className="w-full border rounded px-3 py-2" value={editForm.remarks} onChange={e => setEditForm({ ...editForm, remarks: e.target.value })} rows="3" />
                </div>
                <div className="mb-2 md:col-span-2">
                  <label className="block mb-1">Picture</label>
                  <input type="file" accept="image/*" className="w-full border rounded px-3 py-2" onChange={e => setEditForm({ ...editForm, pic: e.target.files[0] })} />
                </div>
                <div className="flex gap-2 md:col-span-2">
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    {loading ? 'Updating...' : 'Update'}
                  </button>
                  <button type="button" className="bg-gray-300 px-4 py-2 rounded" onClick={() => setEditModal(false)}>Cancel</button>
                </div>
                {error && <p className="mt-2 text-red-600 text-sm md:col-span-2">{error}</p>}
              </form>
            </div>
          </div>
        )}
        {/* Class Monitor Modal */}
        {showMonitorModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
            <div className="bg-white p-6 rounded shadow w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Edit Class Monitor</h2>
              <div className="mb-4">
                <label className="block mb-1">Monitor Text for {pendingClassNames[editingMonitorIdx]}</label>
                <input 
                  className="w-full border rounded px-3 py-2" 
                  value={monitorText} 
                  onChange={e => setMonitorText(e.target.value)} 
                  placeholder="Enter monitor text"
                  required 
                />
              </div>
              <div className="flex gap-2">
                <button 
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  onClick={handleSaveMonitor}
                >
                  Save
                </button>
                <button 
                  className="bg-gray-300 px-4 py-2 rounded" 
                  onClick={() => {
                    setShowMonitorModal(false);
                    setEditingMonitorIdx(null);
                    setMonitorText('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="bg-white rounded shadow p-6">
          {selectedClass ? (
            <>
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-blue-800 mb-3 border-b-2 border-blue-500 pb-2">
                  {selectedClass} - {selectedGender === 'boys' ? 'Boys' : 'Girls'}
                </h3>
                <div className="flex flex-wrap gap-4 items-center mb-4">
                  <button
                    className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2"
                    onClick={() => handleEditMonitor(selected.classIdx)}
                    title="Edit Class Monitor"
                  >
                    <span>👨‍🏫</span>
                    Edit Monitor
                  </button>
                  
                  {/* Search Bar */}
                  <div className="flex gap-2 items-center">
                    <FaSearch className="text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name, father name, serial no, or batch no..."
                      className="border rounded px-3 py-2 w-64"
                      value={search.name}
                      onChange={(e) => setSearch({ ...search, name: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading students...</p>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-red-600 font-semibold">Error: {error}</p>
                  <button 
                    className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    onClick={() => {
                      setError(null);
                      // Trigger refetch
                      const currentSelected = selected;
                      setSelected({ classIdx: null });
                      setTimeout(() => setSelected(currentSelected), 100);
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : students.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-2 py-2 border text-xs">Pic</th>
                        <th className="px-2 py-2 border text-xs">Serial No</th>
                        <th className="px-2 py-2 border text-xs">Name</th>
                        <th className="px-2 py-2 border text-xs">Father Name</th>
                        <th className="px-2 py-2 border text-xs">Class Admitted</th>
                        <th className="px-2 py-2 border text-xs">Date of Admission</th>
                        <th className="px-2 py-2 border text-xs">Age at Admission</th>
                        <th className="px-2 py-2 border text-xs">Class Withdrawn</th>
                        <th className="px-2 py-2 border text-xs">Date of Withdrawal</th>
                        <th className="px-2 py-2 border text-xs">Batch No</th>
                        <th className="px-2 py-2 border text-xs">Remarks</th>
                        <th className="px-2 py-2 border text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students
                        .filter(student => {
                          const searchTerm = search.name.toLowerCase();
                          return (
                            student.name?.toLowerCase().includes(searchTerm) ||
                            student.father_name?.toLowerCase().includes(searchTerm) ||
                            student.serial_no?.toString().includes(searchTerm) ||
                            student.batch_no?.toLowerCase().includes(searchTerm)
                          );
                        })
                        .map((student) => (
                        <tr key={student.id} className="cursor-pointer hover:bg-blue-50" onClick={() => navigate(`/students/${student.id}`)}>
                          <td className="px-2 py-2 border text-center">
                            <img src={student.pic || 'https://via.placeholder.com/40'} alt={student.name} className="w-10 h-10 object-cover mx-auto border" style={{ borderRadius: 0 }} />
                          </td>
                          <td className="px-2 py-2 border text-xs">{student.serial_no || '-'}</td>
                          <td className="px-2 py-2 border text-xs font-semibold">{student.name}</td>
                          <td className="px-2 py-2 border text-xs">{student.father_name || '-'}</td>
                          <td className="px-2 py-2 border text-xs">{student.class_admitted || '-'}</td>
                          <td className="px-2 py-2 border text-xs">{student.date_of_admission || '-'}</td>
                          <td className="px-2 py-2 border text-xs">{student.age_at_admission || '-'}</td>
                          <td className="px-2 py-2 border text-xs">{student.class_withdrawn || '-'}</td>
                          <td className="px-2 py-2 border text-xs">{student.date_of_withdrawal || '-'}</td>
                          <td className="px-2 py-2 border text-xs">{student.batch_no || '-'}</td>
                          <td className="px-2 py-2 border text-xs">{student.remarks || '-'}</td>
                          <td className="px-2 py-2 border text-center">
                            <button
                              className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 mr-1 text-xs"
                              onClick={e => { e.stopPropagation(); handleEditStudent(student); }}
                            >
                              Edit
                            </button>
                            <button
                              className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 text-xs"
                              onClick={e => { e.stopPropagation(); handleDeleteStudent(student.id); }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 font-semibold">No students found for {selectedClass} - {selectedGender === 'boys' ? 'Boys' : 'Girls'}</p>
                <p className="text-gray-500 mt-2">Try adding a student or selecting a different class/gender combination.</p>
              </div>
            )}
            </>
          ) : (
            <div className="text-gray-500">[Student list table, search, filter, and pagination will appear here]</div>
          )}
        </div>
      </div>
    </ClassSubjectContext.Provider>
  );
};

export default Students;