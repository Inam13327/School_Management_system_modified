import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children }) => (
  <div className="min-h-screen flex bg-gray-100">
    <Sidebar />
    <main className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</main>
  </div>
);

export default Layout; 