import { createContext, useContext, useEffect, useState } from "react";
import getUser from "../services/getUser";
import userLogout from "../services/userLogout";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

const authState = {
  headers: null,
  isAuth: false,
  loggedUser: {
    bio: null,
    email: "",
    image: null,
    token: "",
    username: "",
  },
};

function isValidAuthState(value) {
  return Boolean(value && typeof value === "object" && "isAuth" in value);
}

function readStoredAuthState() {
  try {
    const stored = JSON.parse(localStorage.getItem("loggedUser"));
    return isValidAuthState(stored) ? stored : authState;
  } catch {
    localStorage.removeItem("loggedUser");
    return authState;
  }
}

function AuthProvider({ children }) {
  const [{ headers, isAuth, loggedUser }, setAuthStateBase] = useState(
    readStoredAuthState(),
  );

  const setAuthState = (nextState) => {
    if (typeof nextState === "function") {
      setAuthStateBase((previousState) => {
        const resolvedState = nextState(previousState);
        return isValidAuthState(resolvedState) ? resolvedState : previousState;
      });
      return;
    }

    if (isValidAuthState(nextState)) {
      setAuthStateBase(nextState);
    }
  };

  useEffect(() => {
    if (!headers) return;

    getUser({ headers })
      .then((freshUser) => {
        if (freshUser) {
          setAuthStateBase((prev) => ({ ...prev, loggedUser: freshUser }));
        }
      })
      .catch((error) => {
        console.error(error);
        setAuthStateBase(userLogout());
      });
  }, [headers]);

  return (
    <AuthContext.Provider value={{ headers, isAuth, loggedUser, setAuthState }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
