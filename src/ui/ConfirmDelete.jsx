import styled from "styled-components";
import Button from "./Button";
import Heading from "./Heading";

const StyledConfirmDelete = styled.div`
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

/* ------------------------------------------------------------------
   Confirming something consequential.

   The copy used to be fixed: "Delete X", "permanently", "cannot be
   undone". That is exactly right for deleting a room, and a lie for
   revoking a staff member's access — which is reversible, keeps their
   name on their history, and is not a delete at all. A dialog that
   overstates what it is about to do is worse than no dialog: the next
   one gets dismissed unread.

   So the three pieces of copy are overridable and every default is what
   it was, which means no existing caller changes behaviour.
   ------------------------------------------------------------------ */
function ConfirmDelete({
  resourceName,
  onConfirm,
  disabled,
  onCloseModal,
  title,
  description,
  confirmLabel = "Delete",
}) {
  return (
    <StyledConfirmDelete>
      <Heading as="h3">{title ?? `Delete ${resourceName}`}</Heading>
      <p>
        {description ??
          `Are you sure you want to delete this ${resourceName} permanently? This action cannot be undone.`}
      </p>

      <div>
        <Button
          onClick={onCloseModal}
          variation="secondary"
          disabled={disabled}
        >
          Cancel
        </Button>
        <Button onClick={onConfirm} variation="danger" disabled={disabled}>
          {confirmLabel}
        </Button>
      </div>
    </StyledConfirmDelete>
  );
}

export default ConfirmDelete;
