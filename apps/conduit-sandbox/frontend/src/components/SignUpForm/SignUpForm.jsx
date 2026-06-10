import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import userSignUp from "../../services/userSignUp";
import FormFieldset from "../FormFieldset";

function SignUpForm({ onError }) {
  const [{ username, email, password }, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const { setAuthState } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    userSignUp({ username, email, password })
      .then((authState) => {
        if (!authState) return;

        setAuthState(authState);
        navigate("/");
      })
      .catch(onError);
  };

  const inputHandler = (e) => {
    const name = e.target.name;
    const value = e.target.value;

    setForm((form) => ({ ...form, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormFieldset
        name="username"
        required
        placeholder="用户名"
        value={username}
        handler={inputHandler}
      ></FormFieldset>

      <FormFieldset
        name="email"
        type="email"
        required
        placeholder="邮箱"
        value={email}
        handler={inputHandler}
      ></FormFieldset>

      <FormFieldset
        name="password"
        type="password"
        required
        placeholder="密码"
        value={password}
        handler={inputHandler}
      ></FormFieldset>
      <button className="btn btn-lg btn-primary pull-xs-right">注册</button>
    </form>
  );
}

export default SignUpForm;
