
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
function UserInfo() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = Cookies.get('token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                setUser(decoded); // Decoded token contains user info
            } catch (error) {
                console.error('Invalid token', error);
            }
        }
    }, []);

    return user;
}

export default UserInfo;