import { useForm } from "react-hook-form";
import styled from "styled-components";

import Button from "../../ui/Button";
import Form from "../../ui/Form";
import FormRow from "../../ui/FormRow";
import Input from "../../ui/Input";
import SpinnerMini from "../../ui/SpinnerMini";
import { useSignup } from "./useSignup";

/* The shared <Select> takes options/value/onChange and cannot carry a
   react-hook-form ref through, so the field is a plain <select> wearing
   the same clothes as the rest of the app's inputs. */
const RoleSelect = styled.select`
  border: 1px solid var(--color-grey-300);
  background-color: var(--color-grey-0);
  border-radius: var(--border-radius-sm);
  padding: 0.8rem 1.2rem;
  box-shadow: var(--shadow-sm);
  font-size: 1.4rem;
  font-weight: 500;
  color: var(--color-grey-700);
  width: 100%;

  &:disabled {
    background-color: var(--color-grey-200);
    color: var(--color-grey-500);
  }
`;

/* The form that adds somebody to the team.

   It used to render a full-page <Spinner /> in place of itself while
   submitting, which threw away everything the admin had typed the
   moment they pressed the button — and if the request failed they got
   an empty form back with no idea what had been sent. The controls are
   disabled instead, so the typing stays on screen until it has actually
   worked.

   (It also read `isSigningup` from a hook that returns `isSigningUp`, so
   none of that ever ran: the button was never disabled and a double
   click sent two requests, the second of which failed with "already
   registered" over the top of the first one's success.)
*/
function SignupForm() {
  const { register, handleSubmit, formState, getValues, reset } = useForm({
    defaultValues: { role: "staff" },
  });
  const { signUp, isSigningUp } = useSignup();
  const { errors } = formState;

  function onSubmit({ fullName, email, password, role }) {
    signUp(
      { fullName, email, password, role },
      // Only on success: a rejected address should still be on screen,
      // next to the message explaining why it was rejected.
      { onSuccess: () => reset({ role: "staff" }) },
    );
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label="Full name" error={errors?.fullName?.message}>
        <Input
          type="text"
          id="fullName"
          autoComplete="off"
          {...register("fullName", { required: "This field is required" })}
          disabled={isSigningUp}
        />
      </FormRow>

      <FormRow label="Email address" error={errors?.email?.message}>
        <Input
          type="email"
          id="email"
          autoComplete="off"
          {...register("email", {
            required: "This field is required",
            pattern: {
              value: /\S+@\S+\.\S+/,
              message: "Invalid email address",
            },
          })}
          disabled={isSigningUp}
        />
      </FormRow>

      {/* Hiring an admin straight out took two steps before — create,
          then find the new row and promote it — and the intermediate
          state was a person with the wrong powers. It is one field. */}
      <FormRow label="Role" error={errors?.role?.message}>
        <RoleSelect id="role" {...register("role")} disabled={isSigningUp}>
          <option value="staff">
            Staff — bookings, seat sales, snacks sold or removed
          </option>
          <option value="admin">
            Admin — everything, including prices, rooms and this list
          </option>
        </RoleSelect>
      </FormRow>

      <FormRow
        label="Password (min 8 characters)"
        error={errors?.password?.message}
      >
        <Input
          type="password"
          id="password"
          autoComplete="new-password"
          {...register("password", {
            required: "This field is required",
            minLength: {
              value: 8,
              message: "Password needs a minimum of 8 characters",
            },
          })}
          disabled={isSigningUp}
        />
      </FormRow>

      <FormRow label="Repeat password" error={errors?.passwordConfirm?.message}>
        <Input
          type="password"
          id="passwordConfirm"
          autoComplete="new-password"
          {...register("passwordConfirm", {
            required: "This field is required",
            validate: (value) =>
              value === getValues().password || "Passwords need to match",
          })}
          disabled={isSigningUp}
        />
      </FormRow>

      <FormRow>
        <Button
          onClick={() => reset({ role: "staff" })}
          disabled={isSigningUp}
          variation="secondary"
          type="reset"
        >
          Cancel
        </Button>
        <Button disabled={isSigningUp}>
          {isSigningUp ? <SpinnerMini /> : "Create new user"}
        </Button>
      </FormRow>
    </Form>
  );
}

export default SignupForm;
