import React, { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Swal from 'sweetalert2';

function RegisterForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_HOST}/register`, formData);
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'User registered successfully',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'OK'
      }).then(() => {
        router.push('/login');
      });
    } catch (error) {
      console.log(error);
      setError(error.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 -mt-28">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Register</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username"
                name="username"
                type="text" 
                value={formData.username} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email"
                name="email"
                type="email" 
                value={formData.email} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password"
                name="password"
                type="password" 
                value={formData.password} 
                onChange={handleChange} 
                required 
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full">Register</Button>
          </form>
          <p className="text-center mt-4 text-sm">
            Already have an account? 
            <span 
              className="text-blue-600 cursor-pointer hover:underline" 
              onClick={() => router.push('/login')}
            > Login</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default RegisterForm;
