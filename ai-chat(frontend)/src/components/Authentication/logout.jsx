import Cookies from 'js-cookie';
import { useRouter } from 'next/router';

const useLogout = () => {
    const router = useRouter();

    const logout = () => {
        Cookies.remove('token'); // Remove the authentication token
        router.push('/login'); // Redirect to the login page
    };

    return logout;
};

export default useLogout;
