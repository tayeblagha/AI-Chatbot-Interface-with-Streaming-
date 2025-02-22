import React from 'react';
import RegisterForm from '@/components/Authentication/Register';
import NavBar from '../components/NavMenu/NavBar'

export default function Register() {
  return (
    <div>
      <NavBar></NavBar>
      <RegisterForm />
    </div>
  );
}
