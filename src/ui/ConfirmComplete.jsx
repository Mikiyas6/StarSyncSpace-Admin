import styled from "styled-components";
import Button from "./Button";
import Heading from "./Heading";

const StyledConfirmComplete = styled.div`
  width: 40rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;

  & p {
    color: var(--color-grey-500);
    margin-bottom: 1.2rem;
  }

  & div {
    display: flex;
    justify-content: flex-end;
    gap: 1.2rem;
  }
`;

function ConfirmComplete({ resourceName, onConfirm, disabled, onCloseModal }) {
  return (
    <StyledConfirmComplete>
      <Heading as="h3">Complete {resourceName}</Heading>
      <p>
        Are you sure you want to mark this {resourceName} as complete? This
        action cannot be undone.
      </p>

      <div>
        <Button
          onClick={onCloseModal}
          variation="secondary"
          disabled={disabled}
        >
          Cancel
        </Button>
        <Button onClick={onConfirm} variation="primary" disabled={disabled}>
          Complete
        </Button>
      </div>
    </StyledConfirmComplete>
  );
}

export default ConfirmComplete;