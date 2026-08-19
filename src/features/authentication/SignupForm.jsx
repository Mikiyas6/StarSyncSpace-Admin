import { useForm } from "react-hook-form";
import Button from "../../ui/Button";
import Form from "../../ui/Form";
import FormRow from "../../ui/FormRow";
import Input from "../../ui/Input";
import { useSignup } from "./useSignup";
import Spinner from "../../ui/Spinner";
// Email regex: /\S+@\S+\.\S+/

function SignupForm() {
  const { register, handleSubmit, formState, getValues, reset } = useForm();
  const { signUp, isSigningup } = useSignup();
  const { errors } = formState;
  function onSubmit(data) {
    const { fullName, email, password } = data;
    signUp(
      { fullName, email, password },
      {
        onSettled: () => {
          reset();
        },
      }
    );
  }
  if (isSigningup) return <Spinner />;
  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      {/* The handleSubmit function will call the function passed as an argument with the form data as an argument */}
      <FormRow label="Full name" error={errors?.fullName?.message}>
        <Input
          type="text"
          id="fullName"
          {...register("fullName", { required: "This field is required" })}
          disabled={isSigningup}
        />
      </FormRow>

      <FormRow label="Email address" error={errors?.email?.message}>
        {/* The register function will register the input with the form */}
        <Input
          type="email"
          id="email"
          {...register("email", {
            required: "This field is required",
            pattern: {
              value: /\S+@\S+\.\S+/,
              message: "Invalid email address",
            },
          })}
          disabled={isSigningup}
        />
      </FormRow>

      <FormRow
        label="Password (min 8 characters)"
        error={errors?.password?.message}
      >
        <Input
          type="password"
          id="password"
          {...register("password", {
            required: "This field is required",
            minLength: {
              value: 8,
              message: "Password needs a minimum of 8 characters",
            },
          })}
          disabled={isSigningup}
        />
      </FormRow>

      <FormRow label="Repeat password" error={errors?.passwordConfirm?.message}>
        <Input
          type="password"
          id="passwordConfirm"
          {...register("passwordConfirm", {
            required: "This field is required",
            validate: (value) =>
              value === getValues().password || "Passwords need to match",
          })}
          disabled={isSigningup}
        />
      </FormRow>

      <FormRow>
        {/* type is an HTML attribute! */}
        <Button
          onClick={reset}
          disabled={isSigningup}
          variation="secondary"
          type="reset"
        >
          Cancel
        </Button>
        <Button disabled={isSigningup}>Create new user</Button>
      </FormRow>
    </Form>
  );
}

export default SignupForm;
