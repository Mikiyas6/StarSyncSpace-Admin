import styled from "styled-components";
import Input from "../../ui/Input";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FileInput from "../../ui/FileInput";
import Textarea from "../../ui/Textarea";

import { useForm } from "react-hook-form";
import { useCreateRoom } from "./useCreateRoom";
import { useEditRoom } from "./useEditRoom";
import RoomImagesManager from "./RoomImagesManager";
import { formatMenuPrice } from "../../utils/helpers";
import { usdForRwf } from "../../utils/fx";
import { useFxRate } from "../fx/useFxRate";
const FormRow = styled.div`
  display: grid;
  align-items: center;
  grid-template-columns: 24rem 1fr 1.2fr;
  gap: 2.4rem;

  padding: 1.2rem 0;

  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    padding-bottom: 0;
  }

  &:not(:last-child) {
    border-bottom: 1px solid var(--color-grey-100);
  }

  &:has(button) {
    display: flex;
    justify-content: flex-end;
    gap: 1.2rem;
  }
`;

const Label = styled.label`
  font-weight: 500;
`;

const Error = styled.span`
  font-size: 1.4rem;
  color: var(--color-red-700);
`;

const Hint = styled.span`
  font-size: 1.4rem;
  color: var(--color-grey-500);
`;
/* "" from an untouched number input is not 0 and is not a number;
   Postgres refuses it in a numeric column. */
function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function CreateRoomForm({ roomToEdit = {}, onCloseModal }) {
  const { id: editId, ...editValues } = roomToEdit;
  const isEditSession = Boolean(editId);
  const { isEditing, editRoom } = useEditRoom();
  const { isCreating, createRoom } = useCreateRoom();
  const isWorking = isCreating || isEditing;
  const { register, handleSubmit, reset, getValues, watch, formState } =
    useForm({
      defaultValues: isEditSession ? editValues : {},
    });
  const { errors } = formState;
  /* The hourly franc rate, which is the price for BOTH kinds of room:
     a whole meeting room for an hour, or one desk for an hour. */
  const watchedHourly = watch("hour_rate_rwf");

  /* A room is one of two completely different products, and which one it
     is decides which prices even make sense. Watched rather than read
     once, so the form reshapes itself as soon as the type changes instead
     of asking for an hourly rate for a desk. */
  const roomType = watch("room_type") ?? editValues.room_type ?? "meeting_room";
  const isSharedSpace = roomType === "shared_space";

  const watchedHourRate = watch("hour_rate_rwf");
  const watchedDayRate = watch("day_rate_rwf");
  const watchedMonthRate = watch("month_rate_rwf");

  /* The live rate, so every "≈" on this form is today's conversion rather
     than a number that was true when the code was written. */
  const { rate: rwfPerUsd, isIndicative } = useFxRate();

  function onSubmit(data) {
    /* Three shapes arrive here. A string is the photo the room already
       has and nobody replaced. A FileList with something in it is a new
       upload. A FileList with NOTHING in it is what the browser leaves
       behind when the file dialog is opened and cancelled — and reading
       [0] off that gave undefined, which used to reach the API layer and
       throw on `.name` rather than simply keeping the photo the room
       already had. */
    const picked =
      typeof data.image === "string" ? data.image : data.image?.[0];
    const image = picked ?? (isEditSession ? roomToEdit.image : undefined);

    /* Null out whichever rates do not belong to this kind of room.

       Leaving a stale number behind is how a shared space ends up
       advertising an hourly price on the public site, or a meeting room
       shows a daily desk rate it does not sell. A blank input arrives as
       "", which Postgres will not accept in a numeric column, so the
       empty case has to become null rather than being passed through. */
    const shared = data.room_type === "shared_space";
    // The discount input is not rendered for a shared space, so nothing
    // would arrive for a NOT NULL column.
    if (shared) data.discount = 0;

    /* hour_rate_rwf belongs to BOTH kinds of room since migration 21 —
       a whole room for an hour, or one desk for an hour — so unlike the
       day and month rates it is never nulled out. It used to be
       shared-space-only, with meeting rooms priced from the retired USD
       column. */
    data.hour_rate_rwf = numberOrNull(data.hour_rate_rwf);
    data.day_rate_rwf = shared ? numberOrNull(data.day_rate_rwf) : null;
    data.month_rate_rwf = shared ? numberOrNull(data.month_rate_rwf) : null;

    /* The retired USD columns, written as the conversion of the franc
       price rather than left to contradict it.

       TRANSITIONAL. Nothing reads them (see migration 21) — they are
       kept in step only so that an already-deployed build still
       selecting them during a rollout quotes roughly the right money
       instead of a price from before this edit. Drop both columns, and
       these four lines, once both apps have shipped. */
    data.regularPrice = shared
      ? 0
      : usdForRwf(numberOrNull(data.hour_rate_rwf) ?? 0, rwfPerUsd);
    data.month_rate_usd = shared
      ? usdForRwf(numberOrNull(data.month_rate_rwf) ?? 0, rwfPerUsd) || null
      : null;
    if (isEditSession)
      editRoom(
        { newRoomData: { ...data, image }, id: editId },
        {
          onSuccess: (data) => {
            reset();
            onCloseModal?.();
          },
        }
      );
    else
      createRoom(
        { ...data, image: image },
        {
          onSuccess: (data) => {
            reset();
            onCloseModal?.();
          },
        }
      );
  }
  function onError(errors) {}
  return (
    <Form
      onSubmit={handleSubmit(onSubmit, onError)}
      type={onCloseModal ? "modal" : "regular"}
    >
      <FormRow>
        <label htmlFor="name">Room name</label>
        <Input
          disabled={isWorking}
          type="text"
          id="name"
          {...register("name", { required: "This field is required" })}
        />
        {errors?.name?.message && <Error>{errors.name.message}</Error>}
      </FormRow>
      <FormRow>
        <label htmlFor="room_type">What kind of space is this?</label>
        <select
          id="room_type"
          disabled={isWorking}
          {...register("room_type")}
          style={{
            fontSize: "1.4rem",
            padding: "0.8rem 1.2rem",
            border: "1px solid var(--color-grey-300)",
            borderRadius: "var(--border-radius-sm)",
            backgroundColor: "var(--color-grey-0)",
            color: "var(--color-grey-700)",
            fontWeight: 500,
          }}
        >
          <option value="meeting_room">
            Meeting room — rented whole, by the minute
          </option>
          <option value="shared_space">
            Shared space — sold one seat at a time
          </option>
        </select>
        <Hint>
          {isSharedSpace
            ? "Booking a seat leaves the room available to everyone else — it just has one desk fewer. The public site shows how many are left."
            : "Booking this room makes it unavailable for its whole slot."}
        </Hint>
      </FormRow>

      <FormRow>
        <label htmlFor="maxCapacity">
          {isSharedSpace ? "How many desks?" : "Maximum capacity"}
        </label>
        <Input
          disabled={isWorking}
          type="number"
          id="maxCapacity"
          {...register("maxCapacity", {
            required: "This field is required",
            min: {
              value: 1,
              message: "Capacity should at least be 1",
            },
          })}
        />
        {errors?.maxCapacity?.message ? (
          <Error>{errors.maxCapacity.message}</Error>
        ) : isSharedSpace ? (
          <Hint>
            This is the seat count every &ldquo;14 of 20 seats left&rdquo; is
            worked out from, and the limit the database refuses to oversell.
          </Hint>
        ) : null}
      </FormRow>
      {/* Two products, two ways of charging. Only the one that applies is
          shown, because an hourly rate on a hot desk and a monthly pass on
          a boardroom are both prices nobody can buy. */}
      {isSharedSpace ? (
        <>
          <FormRow>
            <label htmlFor="hour_rate_rwf">
              By the hour — price of ONE SEAT for ONE HOUR (RWF)
            </label>
            <Input
              disabled={isWorking}
              type="number"
              step="1"
              min="0"
              id="hour_rate_rwf"
              {...register("hour_rate_rwf")}
            />
            {watchedHourRate && watchedDayRate ? (
              <Hint>
                A day pass becomes the better buy after{" "}
                {(watchedDayRate / watchedHourRate).toFixed(1)} hours — past
                that, both apps offer the guest the day pass instead of
                charging more for less.
              </Hint>
            ) : (
              <Hint>
                Leave this empty if this space is not sold by the hour — the
                option then disappears from both the website and the booking
                form rather than failing when somebody picks it.
              </Hint>
            )}
          </FormRow>

          <FormRow>
            <label htmlFor="day_rate_rwf">
              Day pass — price of ONE SEAT for ONE DAY (RWF)
            </label>
            <Input
              disabled={isWorking}
              type="number"
              step="1"
              min="0"
              id="day_rate_rwf"
              {...register("day_rate_rwf", {
                required: "A shared space needs a daily seat rate",
                min: { value: 1, message: "Rate must be greater than 0" },
              })}
            />
            {errors?.day_rate_rwf?.message ? (
              <Error>{errors.day_rate_rwf.message}</Error>
            ) : watchedDayRate ? (
              <Hint>
                ≈ ${(watchedDayRate / rwfPerUsd).toFixed(2)} per seat per day
                {isIndicative ? " (indicative rate)" : ""} · a full room of{" "}
                {watch("maxCapacity") || 0} seats is{" "}
                {formatMenuPrice(
                  watchedDayRate * (Number(watch("maxCapacity")) || 0),
                  "RWF",
                )}{" "}
                a day
              </Hint>
            ) : (
              <Hint>
                Quoted in RWF because that is what customers pay. The USD
                figure beside it is derived from today&apos;s exchange rate and
                is never stored.
              </Hint>
            )}
          </FormRow>

          <FormRow>
            <label htmlFor="month_rate_rwf">
              Monthly desk — price of ONE SEAT for ONE MONTH (RWF)
            </label>
            <Input
              disabled={isWorking}
              type="number"
              step="1"
              min="0"
              id="month_rate_rwf"
              {...register("month_rate_rwf", {
                required: "A shared space needs a monthly seat rate",
                min: { value: 1, message: "Rate must be greater than 0" },
              })}
            />
            {errors?.month_rate_rwf?.message ? (
              <Error>{errors.month_rate_rwf.message}</Error>
            ) : watchedMonthRate ? (
              <Hint>
                ≈ ${usdForRwf(watchedMonthRate, rwfPerUsd).toFixed(2)} per seat
                per month, at today&apos;s rate of{" "}
                {Math.round(rwfPerUsd).toLocaleString("en-US")} RWF to the
                dollar{isIndicative ? " (indicative)" : ""}
                {watchedDayRate
                  ? ` — about ${Math.round(
                      watchedMonthRate / watchedDayRate,
                    )} days' worth of day passes`
                  : ""}
              </Hint>
            ) : (
              <Hint>
                In RWF, like every other rate. This price is what a customer
                pays; the dollar figure beside it is only today&apos;s
                conversion and is never stored.
              </Hint>
            )}
          </FormRow>
        </>
      ) : (
        <FormRow>
          <label htmlFor="hour_rate_rwf">
            Price per hour (RWF) — clients are billed per minute
          </label>
          <Input
            disabled={isWorking}
            type="number"
            step="1"
            min="0"
            id="hour_rate_rwf"
            {...register("hour_rate_rwf", {
              required: "This field is required",
              min: { value: 1, message: "Price must be greater than 0" },
            })}
          />
          {errors?.hour_rate_rwf?.message ? (
            <Error>{errors.hour_rate_rwf.message}</Error>
          ) : watchedHourly ? (
            <Hint>
              {formatMenuPrice(Math.round(watchedHourly / 60), "RWF")}/min ·
              &nbsp;≈ ${usdForRwf(watchedHourly, rwfPerUsd).toFixed(2)}/hr at
              today&apos;s rate
              {isIndicative ? " (indicative)" : ""}. The franc price is what is
              charged — it does not move when the exchange rate does.
            </Hint>
          ) : null}
        </FormRow>
      )}
      {/* Discount is a reduction on the HOURLY price, in francs like the
          price it comes off. A shared space is not shown it: seat passes
          are discounted by the monthly rate itself, which is already a
          fraction of the daily one, and with no whole-room hourly price
          to measure against the old "must be less than the price" rule
          could only ever be satisfied by 0 — a required field that was an
          unanswerable question. */}
      {isSharedSpace ? null : (
        <FormRow>
          <label htmlFor="discount">Discount per hour (RWF)</label>
          <Input
            disabled={isWorking}
            type="number"
            step="1"
            min="0"
            id="discount"
            {...register("discount", {
              required: "This field is required",
              validate: (value) =>
                Number(value) <= Number(getValues().hour_rate_rwf) ||
                "Discount should be less than the hourly price",
            })}
          />
          {errors?.discount?.message && (
            <Error>{errors.discount.message}</Error>
          )}
        </FormRow>
      )}
      <FormRow>
        <label htmlFor="description">Description for website</label>
        <Textarea
          type="number"
          id="description"
          {...register("description", { required: "This field is required" })}
        />
        {errors?.description?.message && (
          <Error>{errors.description.message}</Error>
        )}
      </FormRow>
      <FormRow>
        <label htmlFor="image">Room photo</label>
        <FileInput
          disabled={isWorking}
          id="image"
          accept="image/*"
          {...register("image", {
            required: isEditSession ? false : "This field is required",
          })}
        />
        {errors?.image?.message && <Error>{errors.image.message}</Error>}
      </FormRow>
      {isEditSession && <RoomImagesManager roomId={editId} />}
      <FormRow>
        {/* type is an HTML attribute! */}
        <Button
          variation="secondary"
          type="reset"
          onClick={() => onCloseModal?.()}
        >
          Cancel
        </Button>
        <Button disabled={isWorking}>
          {isEditSession ? "Edit room" : "Add room"}
        </Button>
        {errors?.secondary?.message && (
          <Error>{errors.secondary.message}</Error>
        )}
      </FormRow>
    </Form>
  );
}

export default CreateRoomForm;
