import React from 'react';
import LoginForm from '@/components/Authentication/Login';
import NavBar from '../components/NavMenu/NavBar'
export default function Login() {
  return (
    <div>
      <NavBar></NavBar>
      <LoginForm />
    </div>
  );
}
