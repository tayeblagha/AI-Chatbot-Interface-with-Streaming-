import React, { useState } from 'react';
import Cookies from 'js-cookie';
import axios from 'axios';
import { useRouter } from 'next/router';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import UserInfo from "../Authentication/UserInfo";

function LoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();
    const token = Cookies.get("token");

    const current_user = UserInfo();

    if (current_user) {
        router.push('/chabot');
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // Reset error message
        try {
            const response = await axios.post(`${process.env.NEXT_PUBLIC_HOST}/login`, {
                username,
                password,
            });
            if (response.data.access_token) {
                Cookies.set('token', response.data.access_token, { expires: 7 });
                router.push('/chabot');
            }
        } catch (error) {
            setError('Invalid credentials !');
        }
    };
  
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 -mt-28">
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
                        {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
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
