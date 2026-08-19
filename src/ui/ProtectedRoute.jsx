import { Children, useEffect } from "react";
import { useUser } from "../features/authentication/useUser";
import Spinner from "./Spinner";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

const FullPage = styled.div`
  height: 100vh;
  background-color: var(--color-grey-50);
  display: flex;
  align-items: center;
  justify-content: center;
`;

function ProtectedRoute({ children }) {
  // 1. Load the authenticated user
  const { user, isLoading, isAuthenticated } = useUser();
  const navigate = useNavigate();
  // 2. If the user is not authenticated, we will redirect them to the login page

  useEffect(
    function () {
      if (!isAuthenticated && !isLoading) {
        navigate("/login");
      }
    },
    [isAuthenticated, navigate, isLoading]
  );
  // 3. While that is happening, We will show a loading spinner
  if (isLoading)
    return (
      <FullPage>
        <Spinner />
      </FullPage>
    );
  // 4. If the user is authenticated, we will render the children (AppLayout)

  if (isAuthenticated) return children;
}

export default ProtectedRoute;
