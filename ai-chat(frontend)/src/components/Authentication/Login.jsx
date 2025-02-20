import React, { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function LoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();
  
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:8000/login', {
                username,
                password,
            });
            if (response.data.access_token) {
                router.push('/chabot');
            }
        } catch (error) {
            alert('Invalid credentials');
        }
    };
  
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Card className="w-full max-w-md shadow-lg rounded-2xl">
                <CardContent className="p-6">
                    <h2 className="text-2xl font-bold text-center mb-4">Login</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-gray-700 font-medium">Username</label>
                            <Input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 font-medium">Password</label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="mt-1"
                            />
                        </div>
                        <Button type="submit" className="w-full">Login</Button>
                    </form>
                    <div className="mt-4 text-center">
                        <p className="text-gray-600">Don't have an account?</p>
                        <Button variant="outline" onClick={() => router.push('/register')} className="mt-2 w-full">Register</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default LoginForm;
