import { useState } from "react";
import AuthPageContainer from "../components/AuthPageContainer";
import SignUpForm from "../components/SignUpForm";

function SignUp() {
  const [errorMessage, setErrorMessage] = useState();

  const handleError = (error) => {
    setErrorMessage(error);
  };

  return (
    <AuthPageContainer
      error={errorMessage}
      path="/login"
      text="已有账号？去登录"
      title="注册"
    >
      <SignUpForm onError={handleError} />
    </AuthPageContainer>
  );
}

export default SignUp;
