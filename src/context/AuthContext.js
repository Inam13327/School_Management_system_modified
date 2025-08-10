import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assignedClasses, setAssignedClasses] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('access'); // Changed from 'token' to 'access'
    const userData = localStorage.getItem('user');
    const userRole = localStorage.getItem('role');
    const classes = localStorage.getItem('assignedClasses');
    
    if (token && userData && userRole) {
      setUser(JSON.parse(userData));
      setRole(userRole);
      if (classes) {
        setAssignedClasses(JSON.parse(classes));
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch('http://localhost:8000/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const contentType = response.headers.get("content-type");
      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error("Server error: " + text);
      }

      if (response.ok) {
        // Store tokens
        localStorage.setItem('access', data.tokens.access);
        localStorage.setItem('refresh', data.tokens.refresh);
        
        // Store user data
        const userData = {
          id: data.user.id,
          email: data.user.email,
          username: data.user.username,
          first_name: data.user.first_name,
          last_name: data.user.last_name,
          is_approved: data.user.is_approved,
          assigned_class: data.user.assigned_class,
          role: data.user.role || 'user'
        };
        
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('role', userData.role);
        
        // Store assigned class for teacher as an array for compatibility
        if (userData.role === 'teacher' && userData.assigned_class) {
          const assignedClassObj = typeof userData.assigned_class === 'object' ? userData.assigned_class : { name: userData.assigned_class };
          localStorage.setItem('assignedClasses', JSON.stringify([assignedClassObj]));
          setAssignedClasses([assignedClassObj]);
        } else if (data.user.assigned_classes) {
          localStorage.setItem('assignedClasses', JSON.stringify(data.user.assigned_classes));
          setAssignedClasses(data.user.assigned_classes);
        } else {
          localStorage.removeItem('assignedClasses');
          setAssignedClasses([]);
        }
        
        setUser(userData);
        setRole(userData.role);
        
        return { token: data.tokens.access, user: userData, role: userData.role };
      } else {
        throw new Error(data.detail || data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('assignedClasses');
    setUser(null);
    setRole(null);
    setAssignedClasses([]);
  };

  // Role-based permission checks
  const hasPermission = (permission) => {
    if (!user || !role) return false;
    
    switch (role) {
      case 'vice_principal':
        return true; // Vice Principal has all permissions
      case 'teacher':
        return ['marks', 'monthly_test', 'attendance'].includes(permission);
      case 'staff':
        return ['fee', 'report', 'student_data'].includes(permission);
      default:
        return false;
    }
  };

  const canAccessClass = (classId) => {
    if (!user || !role) return false;
    
    if (role === 'vice_principal') return true;
    if (role === 'staff') return true; // Staff can access all classes for their functions
    
    // For teachers, check if they're assigned to this class (single class)
    if (role === 'teacher' && assignedClasses.length > 0) {
      const assigned = assignedClasses[0];
      return assigned && (assigned.id === classId || assigned.name === `Class ${classId}`);
    }
    
    return false;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      role, 
      assignedClasses,
      login, 
      logout, 
      loading,
      hasPermission,
      canAccessClass
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext); 