import { useMemo, useState } from "react";
import styled from "styled-components";
import { useForm } from "react-hook-form";
import Input from "../../ui/Input";
import Textarea from "../../ui/Textarea";
import Button from "../../ui/Button";
import Form from "../../ui/Form";
import FormRow from "../../ui/FormRow";
import TagEditor from "./TagEditor";
import ImageDropzone from "./ImageDropzone";
import ExistingImagesManager from "./ExistingImagesManager";
import { useCreateMenuItem } from "./useCreateMenuItem";
import { useEditMenuItem } from "./useEditMenuItem";
import { useMenuOverview } from "./useMenuOverview";

const Scrollable = styled.div`
  max-height: calc(100vh - 10rem);
  overflow-y: auto;
  padding-right: 0.8rem;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--color-grey-300);
    border-radius: 3px;
  }
`;

const Group = styled.section`
  padding: 1.2rem 0;

  &:not(:last-child) {
    border-bottom: 1px solid var(--color-grey-200);
  }
`;

const GroupTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-grey-500);
  margin-bottom: 0.8rem;
`;

const Error = styled.span`
  font-size: 1.4rem;
  color: var(--color-red-700);
`;

const Select = styled.select`
  border: 1px solid var(--color-grey-300);
  background-color: var(--color-grey-0);
  border-radius: var(--border-radius-sm);
  padding: 0.8rem 1.2rem;
  font-size: 1.4rem;
`;

const CheckboxRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1.2rem;
  font-size: 1.4rem;

  input {
    width: 1.8rem;
    height: 1.8rem;
    accent-color: var(--color-brand-600);
  }
`;

const CURRENCIES = ["RWF", "USD", "EUR", "KES", "UGX"];

function CreateMenuItemForm({ itemToEdit = {}, onCloseModal }) {
  const { categories, sections } = useMenuOverview().data ?? {
    categories: [],
    sections: [],
  };

  const editId = itemToEdit.id;
  const isEditSession = Boolean(editId);

  const initialCategoryId = useMemo(() => {
    const section = sections.find((s) => s.id === itemToEdit.section_id);
    return section?.category_id ?? categories[0]?.id ?? "";
  }, [sections, categories, itemToEdit.section_id]);

  const { register, handleSubmit, reset, watch, setValue, formState } =
    useForm({
      defaultValues: isEditSession
        ? {
            name: itemToEdit.name,
            section_id: itemToEdit.section_id,
            description: itemToEdit.description ?? "",
            price: itemToEdit.price,
            currency: itemToEdit.currency,
            preparation_time_minutes:
              itemToEdit.preparation_time_minutes ?? "",
            calories: itemToEdit.calories ?? "",
            ingredients: itemToEdit.ingredients ?? [],
            allergens: itemToEdit.allergens ?? [],
            dietary_tags: itemToEdit.dietary_tags ?? [],
            is_available: itemToEdit.is_available,
            is_featured: itemToEdit.is_featured,
            sort_order: itemToEdit.sort_order ?? 0,
          }
        : {
            currency: "RWF",
            is_available: true,
            is_featured: false,
            sort_order: 0,
            section_id: "",
          },
    });

  const { errors } = formState;
  const categoryId = watch("categoryId") ?? initialCategoryId;
  const sectionId = watch("section_id");

  const categorySections = useMemo(
    () =>
      sections.filter((s) => s.category_id === Number(categoryId)),
    [sections, categoryId]
  );

  const { isCreating, createMenuItem } = useCreateMenuItem();
  const { isEditing, editMenuItem } = useEditMenuItem();
  const isWorking = isCreating || isEditing;

  // New images staged in the form, uploaded together with the item on save.
  const [pendingFiles, setPendingFiles] = useState([]);

  function onSubmit(data) {
    if (isWorking) return;

    const input = {
      ...data,
      original_section_id: itemToEdit.section_id,
    };

    if (!isEditSession) {
      createMenuItem(
        { input, files: pendingFiles },
        {
          onSuccess: () => {
            reset();
            setPendingFiles([]);
            onCloseModal?.();
          },
        }
      );
    } else {
      editMenuItem(
        { id: editId, input, files: pendingFiles },
        {
          onSuccess: () => {
            reset();
            setPendingFiles([]);
            onCloseModal?.();
          },
        }
      );
    }
  }

  return (
    <Scrollable>
      <Form
        onSubmit={handleSubmit(onSubmit)}
        type={onCloseModal ? "modal" : "regular"}
        style={{ width: "100rem", maxWidth: "calc(100vw - 4rem)" }}
      >
        <Group>
          <GroupTitle>Basic information</GroupTitle>

          <FormRow label="Name" error={errors?.name?.message}>
            <Input
              id="name"
              type="text"
              disabled={isWorking}
              placeholder="Grilled tilapia & chips"
              {...register("name", {
                required: "Name is required",
                minLength: {
                  value: 2,
                  message: "Name should be at least 2 characters",
                },
              })}
            />
          </FormRow>

          <FormRow label="Category" error={errors?.categoryId?.message}>
            <Select
              id="categoryId"
              disabled={isWorking}
              defaultValue={initialCategoryId || ""}
              {...register("categoryId", {
                required: "Choose a category",
              })}
            >
              <option value="">Choose a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </FormRow>

          <FormRow label="Section" error={errors?.section_id?.message}>
            {categoryId ? (
              <Select
                id="section_id"
                disabled={isWorking || categorySections.length === 0}
                {...register("section_id", {
                  required: "Choose a section",
                })}
              >
                <option value="">
                  {categorySections.length === 0
                    ? "No sections in this category yet"
                    : "Choose a section"}
                </option>
                {categorySections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input disabled placeholder="Choose a category first" />
            )}
            {categorySections.length === 0 && categoryId && (
              <Error>Add a section to this category in Section management first.</Error>
            )}
          </FormRow>

          <FormRow label="Description" error={errors?.description?.message}>
            <Textarea
              id="description"
              disabled={isWorking}
              rows={3}
              placeholder="What makes this dish worth ordering?"
              {...register("description")}
            />
          </FormRow>

          <FormRow label="Price" error={errors?.price?.message}>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              disabled={isWorking}
              placeholder="12000"
              {...register("price", {
                required: "Price is required",
                min: { value: 0, message: "Price cannot be negative" },
              })}
            />
          </FormRow>

          <FormRow label="Currency" error={errors?.currency?.message}>
            <Select
              id="currency"
              disabled={isWorking}
              {...register("currency", { required: "Currency is required" })}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormRow>
        </Group>

        <Group>
          <GroupTitle>Images</GroupTitle>
          {isEditSession && <ExistingImagesManager menuItemId={editId} />}
          <FormRow label="Photos" error={errors?.images?.message}>
            <ImageDropzone id="itemImages" files={pendingFiles} setFiles={setPendingFiles} />
          </FormRow>
          {!isEditSession && (
            <p style={{ fontSize: "1.2rem", color: "var(--color-grey-500)" }}>
              The first uploaded photo becomes the primary card image.
            </p>
          )}
        </Group>

        <Group>
          <GroupTitle>Additional information</GroupTitle>

          <FormRow
            label="Preparation time (minutes)"
            error={errors?.preparation_time_minutes?.message}
          >
            <Input
              id="preparation_time_minutes"
              type="number"
              min="0"
              step="1"
              disabled={isWorking}
              placeholder="20"
              {...register("preparation_time_minutes", {
                min: {
                  value: 0,
                  message: "Preparation time cannot be negative",
                },
                validate: (v) =>
                  v === "" ||
                  v == null ||
                  Number.isInteger(Number(v)) ||
                  "Use whole minutes",
              })}
            />
          </FormRow>

          <FormRow label="Calories" error={errors?.calories?.message}>
            <Input
              id="calories"
              type="number"
              min="0"
              step="1"
              disabled={isWorking}
              placeholder="540"
              {...register("calories", {
                min: { value: 0, message: "Calories cannot be negative" },
                validate: (v) =>
                  v === "" ||
                  v == null ||
                  Number.isInteger(Number(v)) ||
                  "Use a whole number",
              })}
            />
          </FormRow>

          <FormRow label="Ingredients">
            <TagEditor
              value={watch("ingredients") ?? []}
              onChange={(tags) => setValue("ingredients", tags, { shouldValidate: true })}
              placeholder="e.g. Tilapia, chips, lemon"
            />
          </FormRow>

          <FormRow label="Allergens">
            <TagEditor
              value={watch("allergens") ?? []}
              onChange={(tags) => setValue("allergens", tags)}
              placeholder="e.g. Gluten, Dairy, Fish"
              hint="Shown prominently to guests on the menu."
            />
          </FormRow>

          <FormRow label="Dietary tags">
            <TagEditor
              value={watch("dietary_tags") ?? []}
              onChange={(tags) => setValue("dietary_tags", tags)}
              placeholder="e.g. vegetarian, vegan, gluten-free"
              hint="Used as filters on the customer menu."
            />
          </FormRow>
        </Group>

        <Group>
          <GroupTitle>Display settings</GroupTitle>

          <FormRow label="Available">
            <CheckboxRow>
              <input
                id="is_available"
                type="checkbox"
                disabled={isWorking}
                {...register("is_available")}
              />
              <label htmlFor="is_available">
                Guests can order this item (off = shown as sold out)
              </label>
            </CheckboxRow>
          </FormRow>

          <FormRow label="Featured">
            <CheckboxRow>
              <input
                id="is_featured"
                type="checkbox"
                disabled={isWorking}
                {...register("is_featured")}
              />
              <label htmlFor="is_featured">
                Feature in the Chef&apos;s Recommendations carousel
              </label>
            </CheckboxRow>
          </FormRow>

          <FormRow label="Display order" error={errors?.sort_order?.message}>
            <Input
              id="sort_order"
              type="number"
              min="0"
              step="1"
              disabled={isWorking}
              {...register("sort_order", {
                min: { value: 0, message: "Order cannot be negative" },
                validate: (v) =>
                  Number.isInteger(Number(v)) || "Use a whole number",
              })}
            />
          </FormRow>
        </Group>

        <Group
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "1.2rem",
            borderBottom: "none",
          }}
        >
          <Button
            variation="secondary"
            type="reset"
            onClick={() => onCloseModal?.()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isWorking}>
            {isEditSession ? "Save changes" : "Add menu item"}
          </Button>
        </Group>
      </Form>
    </Scrollable>
  );
}

export default CreateMenuItemForm;