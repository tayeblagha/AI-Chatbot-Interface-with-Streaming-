import { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import Cookies from "js-cookie";

function useUserInfo() {
    const [user, setUser] = useState(null);
    const [userReady, setUserReady] = useState(false);
  
    useEffect(() => {
      const token = Cookies.get("token");
  
      if (token) {
        try {
          const decodedUser = jwtDecode(token);
          setUser(decodedUser);
        } catch (error) {
          console.error("Error decoding token:", error);
          setUser(null);
        }
      }
      setUserReady(true);
    }, []);
  
    return { user, userReady };
  }

export default useUserInfo;
