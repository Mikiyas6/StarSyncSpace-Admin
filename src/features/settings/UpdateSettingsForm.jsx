import { useEffect, useState } from "react";
import Form from "../../ui/Form";
import FormRow from "../../ui/FormRow";
import Input from "../../ui/Input";
import Spinner from "../../ui/Spinner";
import Button from "../../ui/Button";
import { useSettings } from "./useSettings";
import { useUpdateSetting } from "./useUpdateSetting";

const FIELDS = [
  {
    name: "business_hours_start",
    label: "Opening time",
    type: "time",
  },
  {
    name: "business_hours_end",
    label: "Closing time",
    type: "time",
  },
  {
    name: "min_booking_duration_minutes",
    label: "Minimum booking (minutes)",
    type: "number",
  },
  {
    name: "max_booking_duration_minutes",
    label: "Maximum booking (minutes)",
    type: "number",
  },
  {
    name: "booking_buffer_minutes",
    label: "Booking buffer (minutes)",
    type: "number",
  },
  {
    name: "contact_form_recipient_email",
    label: "Contact form recipient email",
    type: "email",
  },
];

function UpdateSettingsForm() {
  const { isLoading, settings } = useSettings();
  const { isUpdating, updateSetting } = useUpdateSetting();

  const [values, setValues] = useState({});

  useEffect(() => {
    if (isLoading || !settings) return;
    setValues(
      Object.fromEntries(FIELDS.map((field) => [field.name, settings[field.name] ?? ""])),
    );
  }, [isLoading, settings]);

  if (isLoading) return <Spinner />;

  const changedFields = FIELDS.filter(
    (field) =>
      String(values[field.name] ?? "") !== String(settings?.[field.name] ?? ""),
  );

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleSave() {
    if (changedFields.length === 0 || isUpdating) return;
    const updates = Object.fromEntries(
      changedFields.map((field) => [
        field.name,
        field.type === "number" ? Number(values[field.name]) : values[field.name],
      ]),
    );
    updateSetting(updates);
  }

  return (
    <Form>
      {FIELDS.map((field) => (
        <FormRow key={field.name} label={field.label}>
          <Input
            type={field.type}
            id={`${field.name}-input`}
            name={field.name}
            value={values[field.name] ?? ""}
            onChange={handleChange}
            disabled={isUpdating}
          />
        </FormRow>
      ))}

      <FormRow>
        <Button
          type="button"
          onClick={handleSave}
          disabled={changedFields.length === 0 || isUpdating}
        >
          {isUpdating
            ? "Saving…"
            : changedFields.length > 0
              ? `Update settings (${changedFields.length})`
              : "No changes"}
        </Button>
      </FormRow>
    </Form>
  );
}

export default UpdateSettingsForm;