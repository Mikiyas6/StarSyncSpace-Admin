import styled from "styled-components";
import LoginForm from "../features/authentication/LoginForm";
import Logo from "../ui/Logo";
import Heading from "../ui/Heading";
import ButtonIcon from "../ui/ButtonIcon";
import { HiOutlineMoon, HiOutlineSun } from "react-icons/hi2";
import { useTheme } from "../context/useTheme";

const LoginLayout = styled.main`
  position: relative;
  min-height: 100vh;
  display: grid;
  grid-template-columns: 48rem;
  align-content: center;
  justify-content: center;
  gap: 3.2rem;
  background-color: var(--color-grey-50);
`;

const ThemeToggle = styled.div`
  position: absolute;
  top: 2.4rem;
  right: 2.4rem;
`;

function Login() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <LoginLayout>
      <ThemeToggle>
        <ButtonIcon
          onClick={toggleTheme}
          title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        >
          {isDark ? <HiOutlineSun /> : <HiOutlineMoon />}
        </ButtonIcon>
      </ThemeToggle>
      <Logo />
      <Heading as="h4">Login to your account</Heading>
      <LoginForm />
    </LoginLayout>
  );
}

export default Login;