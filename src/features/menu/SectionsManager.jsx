import { useState } from "react";
import styled from "styled-components";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Layers,
  ListOrdered,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Modal from "../../ui/Modal";
import Button, { ButtonContent } from "../../ui/Button";
import Input from "../../ui/Input";
import Tag from "../../ui/Tag";
import ConfirmDelete from "../../ui/ConfirmDelete";
import { useMenuOverview } from "./useMenuOverview";
import { useMenuSections } from "./useMenuSections";
import { useMenuOrder } from "./useMenuOrder";

const Scrollable = styled.div`
  max-height: calc(100vh - 10rem);
  overflow-y: auto;
  padding-right: 0.8rem;
`;

const Header = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1.6rem;
  margin-bottom: 0.8rem;
`;

const Title = styled.h3`
  font-size: 1.8rem;
  font-weight: 600;
  font-family: "Space Grotesk";
`;

const Category = styled.div`
  margin-top: 2.4rem;
`;

const CategoryName = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 1.3rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--color-grey-500);
  border-bottom: 1px solid var(--color-grey-200);
  padding-bottom: 0.8rem;
  margin-bottom: 0.8rem;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 2rem 1fr auto auto auto;
  align-items: center;
  gap: 1.2rem;
  padding: 1rem 1.2rem;
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  margin-bottom: 0.8rem;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  &.dragging {
    opacity: 0.4;
    border-style: dashed;
  }
`;

const Handle = styled.span`
  display: inline-flex;
  color: var(--color-grey-400);

  svg {
    width: 1.7rem;
    height: 1.7rem;
  }
`;

const RowName = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;

  span:first-child {
    font-weight: 600;
    font-size: 1.5rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const Count = styled.span`
  font-size: 1.1rem;
  color: var(--color-grey-500);
`;

const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    border-radius: var(--border-radius-sm);
    color: var(--color-grey-500);
    padding: 0.5rem;
    transition: all 0.2s;

    &:hover {
      background-color: var(--color-grey-100);
      color: var(--color-grey-800);
    }

    &.danger:hover {
      background-color: var(--color-red-100);
      color: var(--color-red-700);
    }

    svg {
      width: 1.6rem;
      height: 1.6rem;
    }
  }
`;

const InlineRename = styled.form`
  display: flex;
  gap: 0.8rem;
  align-items: center;
  flex: 1;
  min-width: 0;
`;

const AddForm = styled.form`
  display: flex;
  gap: 1.2rem;
  align-items: center;
  margin-top: 1.6rem;

  select {
    border: 1px solid var(--color-grey-300);
    border-radius: var(--border-radius-sm);
    padding: 0.8rem 1.2rem;
    font-size: 1.4rem;
    background-color: var(--color-grey-0);
  }
`;

const Switch = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  cursor: pointer;

  input {
    appearance: none;
    width: 3.6rem;
    height: 2rem;
    border-radius: 100px;
    background-color: var(--color-grey-300);
    position: relative;
    transition: background-color 0.2s;
    cursor: pointer;

    &::after {
      content: "";
      position: absolute;
      top: 0.2rem;
      left: 0.2rem;
      width: 1.6rem;
      height: 1.6rem;
      border-radius: 50%;
      background-color: #fff;
      transition: transform 0.2s;
    }

    &:checked {
      background-color: var(--color-green-700);

      &::after {
        transform: translateX(1.6rem);
      }
    }
  }

  span {
    font-size: 1.2rem;
    color: var(--color-grey-500);
  }
`;

const ItemOrderList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-top: 1.2rem;
`;

const ItemOrderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1.2rem;
  padding: 0.8rem 1.2rem;
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  &.dragging {
    opacity: 0.4;
  }

  span {
    font-size: 1.4rem;
    font-weight: 500;
  }
`;

const ReorderModal = styled.div`
  width: 60rem;
  max-width: calc(100vw - 4rem);
`;

function SectionRow({ section, itemsInSection, categoryId }) {
  const { updateSection, isUpdating, deleteSection, isDeleting } =
    useMenuSections();
  const { reorderSections, isReorderingSections } = useMenuOrder();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(section.name);
  const [dragIndex, setDragIndex] = useState(null);

  const { data: overview } = useMenuOverview();
  const siblingSections =
    overview?.sections?.filter((s) => s.category_id === categoryId) ?? [];
  const sectionIndex = siblingSections.findIndex((s) => s.id === section.id);

  function move(dir) {
    const target = sectionIndex + dir;
    if (target < 0 || target >= siblingSections.length) return;
    const reordered = [...siblingSections];
    [reordered[sectionIndex], reordered[target]] = [
      reordered[target],
      reordered[sectionIndex],
    ];
    reorderSections(reordered.map((s) => s.id));
  }

  function renameSection(e) {
    e.preventDefault();
    const name = draftName.trim();
    if (!name || name === section.name) {
      setEditing(false);
      setDraftName(section.name);
      return;
    }
    updateSection(
      { id: section.id, updates: { name } },
      { onSuccess: () => setEditing(false) }
    );
  }

  return (
    <Row
      className={dragIndex === section.id ? "dragging" : ""}
      draggable
      onDragStart={(e) => {
        setDragIndex(section.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => setDragIndex(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => {
        if (dragIndex && dragIndex !== section.id) {
          const ids = siblingSections.map((s) => s.id);
          const from = ids.indexOf(dragIndex);
          const to = ids.indexOf(section.id);
          ids.splice(to, 0, ids.splice(from, 1)[0]);
          reorderSections(ids);
        }
        setDragIndex(null);
      }}
    >
      <Handle title="Drag to reorder">
        <GripVertical aria-hidden />
      </Handle>

      {editing ? (
        <InlineRename onSubmit={renameSection}>
          <Input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            aria-label="Section name"
            disabled={isUpdating}
          />
          <Button size="small" disabled={isUpdating || !draftName.trim()}>
            Save
          </Button>
          <Button
            size="small"
            variation="secondary"
            onClick={() => {
              setEditing(false);
              setDraftName(section.name);
            }}
          >
            Cancel
          </Button>
        </InlineRename>
      ) : (
        <RowName>
          <span>{section.name}</span>
          <Count>{itemsInSection} item{itemsInSection === 1 ? "" : "s"}</Count>
          {!section.is_active && <Tag type="red">Hidden</Tag>}
        </RowName>
      )}

      {!editing && (
        <RowActions>
          <button
            onClick={() => move(-1)}
            disabled={sectionIndex === 0}
            aria-label={`Move ${section.name} up`}
            title="Move up"
          >
            <ArrowUp aria-hidden />
          </button>
          <button
            onClick={() => move(1)}
            disabled={sectionIndex === siblingSections.length - 1}
            aria-label={`Move ${section.name} down`}
            title="Move down"
          >
            <ArrowDown aria-hidden />
          </button>
          <button
            onClick={() => setEditing(true)}
            aria-label={`Rename ${section.name}`}
            title="Rename"
          >
            <Pencil aria-hidden />
          </button>
        </RowActions>
      )}

      <Switch>
        <input
          type="checkbox"
          checked={section.is_active}
          onChange={() =>
            updateSection({
              id: section.id,
              updates: { is_active: !section.is_active },
            })
          }
          aria-label={`${section.is_active ? "Hide" : "Show"} ${section.name}`}
        />
        <span>{section.is_active ? "Active" : "Hidden"}</span>
      </Switch>

      <RowActions>
        <Modal>
          <Modal.Open opens="order-items">
            <button
              aria-label={`Reorder items in ${section.name}`}
              title="Reorder items"
            >
              <ListOrdered aria-hidden />
            </button>
          </Modal.Open>
          <Modal.Window name="order-items">
            <ReorderModal>
              <Title>Reorder items — {section.name}</Title>
              <ItemsReorderList sectionId={section.id} />
            </ReorderModal>
          </Modal.Window>
        </Modal>

        <Modal>
          <Modal.Open opens="delete-section">
            <button
              className="danger"
              aria-label={`Delete ${section.name}`}
              title="Delete"
            >
              <Trash2 aria-hidden />
            </button>
          </Modal.Open>
          <Modal.Window name="delete-section">
            <ConfirmDelete
              resourceName={`section "${section.name}"`}
              disabled={isDeleting}
              onConfirm={() => deleteSection(section.id)}
            />
          </Modal.Window>
        </Modal>
      </RowActions>

      {isReorderingSections && <span>saving…</span>}
    </Row>
  );
}

function ItemsReorderList({ sectionId }) {
  const { data: overview } = useMenuOverview();
  const { reorderItems, isReorderingItems } = useMenuOrder();
  const items =
    overview?.items?.filter((i) => i.section_id === sectionId) ?? [];
  const [dragIndex, setDragIndex] = useState(null);

  function handleDrop(targetIndex) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const reordered = [...items];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    reorderItems(reordered.map((i) => i.id));
  }

  if (items.length === 0)
    return <p style={{ marginTop: "1.2rem", color: "var(--color-grey-500)" }}>
      This section has no items yet.
    </p>;

  return (
    <ItemOrderList>
      {items.map((item, index) => (
        <ItemOrderRow
          key={item.id}
          className={dragIndex === index ? "dragging" : ""}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragEnd={() => setDragIndex(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(index)}
        >
          <GripVertical
            style={{ width: "1.6rem", height: "1.6rem", color: "var(--color-grey-400)" }}
            aria-hidden
          />
          <span>{index + 1}.</span>
          <span>{item.name}</span>
          {isReorderingItems && (
            <Tag type="brand" style={{ marginLeft: "auto" }}>
              Saving…
            </Tag>
          )}
        </ItemOrderRow>
      ))}
    </ItemOrderList>
  );
}

function SectionsManager({ onCloseModal, defaultCategoryId }) {
  const { data: overview, ensureCategories } = useMenuOverview();
  const { createSection, isCreating } = useMenuSections();

  const [activeCategoryId, setActiveCategoryId] = useState(
    defaultCategoryId || overview?.categories?.[0]?.id || ""
  );
  const [newName, setNewName] = useState("");

  const categories = overview?.categories ?? [];
  const sections = overview?.sections ?? [];
  const items = overview?.items ?? [];

  const visibleSections = activeCategoryId
    ? sections.filter((s) => s.category_id === activeCategoryId)
    : sections;

  function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !activeCategoryId) return;
    createSection(
      { name, category_id: Number(activeCategoryId) },
      { onSuccess: () => setNewName("") }
    );
  }

  if (!overview) return null;

  if (categories.length === 0)
    return (
      <div style={{ padding: "1.6rem" }}>
        <p style={{ marginBottom: "1.2rem" }}>
          There are no categories yet. Create the Food and Drinks categories to
          get started.
        </p>
        <Button onClick={() => ensureCategories()}>Create categories</Button>
      </div>
    );

  return (
    <Scrollable>
      <Header>
        <Title>Section management</Title>
        <Count>
          {sections.length} section{sections.length === 1 ? "" : "s"}
        </Count>
      </Header>
      <p style={{ fontSize: "1.3rem", color: "var(--color-grey-500)" }}>
        Drag sections or use the arrows to set the order shown on the customer
        menu. Hidden sections stay in the admin but disappear from the website.
      </p>

      <CategoryName>
        <Layers aria-hidden style={{ width: "1.4rem", height: "1.4rem" }} />
        Sections in category:
        <select
          value={activeCategoryId}
          onChange={(e) => setActiveCategoryId(e.target.value)}
          aria-label="Filter sections by category"
          style={{
            border: "1px solid var(--color-grey-300)",
            borderRadius: "var(--border-radius-sm)",
            padding: "0.4rem 0.8rem",
            fontSize: "1.3rem",
            textTransform: "none",
            letterSpacing: "0",
            color: "var(--color-grey-700)",
          }}
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </CategoryName>

      {visibleSections.map((section) => (
        <SectionRow
          key={section.id}
          section={section}
          categoryId={section.category_id}
          itemsInSection={
            items.filter((i) => i.section_id === section.id).length
          }
        />
      ))}

      {visibleSections.length === 0 && (
        <p style={{ fontSize: "1.3rem", color: "var(--color-grey-500)" }}>
          No sections in this category yet — add the first one below.
        </p>
      )}

      <AddForm onSubmit={handleCreate}>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New section name, e.g. Brunch"
          aria-label="New section name"
          disabled={isCreating}
        />
        <Button disabled={isCreating || !newName.trim()}>
          <ButtonContent>
            <Plus aria-hidden style={{ width: "1.6rem", height: "1.6rem" }} />
            Add section
          </ButtonContent>
        </Button>
        <Button
          variation="secondary"
          type="button"
          onClick={() => onCloseModal?.()}
        >
          Done
        </Button>
      </AddForm>
    </Scrollable>
  );
}

export default SectionsManager;