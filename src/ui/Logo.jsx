import styled from "styled-components";

const StyledLogo = styled.div`
  text-align: center;
  margin-bottom: 1.2rem;
`;

const Img = styled.img`
  width: 100%;
  max-width: 17rem;
  height: auto;
`;

function Logo() {
  return (
    <StyledLogo>
      <Img src={`${import.meta.env.BASE_URL}logo.png`} alt="StarSyncSpace logo" />
    </StyledLogo>
  );
}

export default Logo;