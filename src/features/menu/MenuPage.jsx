import { useState } from "react";
import styled from "styled-components";
import Heading from "../../ui/Heading";
import Button from "../../ui/Button";
import Modal from "../../ui/Modal";
import Spinner from "../../ui/Spinner";
import { Plus } from "lucide-react";
import { ButtonContent } from "../../ui/Button";
import { useMenuOverview } from "./useMenuOverview";
import MenuTable from "./MenuTable";
import CreateMenuItemForm from "./CreateMenuItemForm";
import SectionsManager from "./SectionsManager";

const StyledMenu = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2.4rem;
`;

const PageHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.6rem;
`;

const Description = styled.p`
  font-size: 1.4rem;
  color: var(--color-grey-500);
  max-width: 60ch;
`;

const Tabs = styled.div`
  display: flex;
  gap: 0.8rem;
`;

const Tab = styled.button`
  border: 1px solid var(--color-grey-200);
  background-color: var(--color-grey-0);
  border-radius: var(--border-radius-sm);
  padding: 0.9rem 1.8rem;
  font-size: 1.4rem;
  font-weight: 500;
  color: var(--color-grey-600);
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-grey-400);
  }

  &.active {
    background-color: var(--color-brand-600);
    border-color: var(--color-brand-600);
    color: var(--color-brand-50);
  }
`;

const MissingTable = styled.div`
  background-color: var(--color-yellow-100);
  border: 1px solid var(--color-yellow-700);
  color: var(--color-grey-800);
  border-radius: var(--border-radius-md);
  padding: 2.4rem;
  font-size: 1.5rem;
  line-height: 1.6;
`;

function MenuPage() {
  const {
    data: overview,
    isLoading,
    error,
    ensureCategories,
  } = useMenuOverview();
  const [categoryId, setCategoryId] = useState("");

  if (isLoading) return <Spinner />;

  if (error)
    return (
      <StyledMenu>
        <Heading as="h1">Restaurant menu</Heading>
        <MissingTable>{error.message}</MissingTable>
      </StyledMenu>
    );

  const categories = overview?.categories ?? [];

  function handleTab(id) {
    setCategoryId((prev) => (prev === id ? "" : id));
  }

  return (
    <StyledMenu>
      <PageHeader>
        <div>
          <Heading as="h1">Restaurant menu</Heading>
          <Description>
            Manage categories, sections and items. Changes appear on the
            customer menu at /menu shortly after saving.
          </Description>
        </div>
        <Modal>
          <Modal.Open opens="add-item">
            <Button>
              <ButtonContent>
                <Plus />
                Add menu item
              </ButtonContent>
            </Button>
          </Modal.Open>
          <Modal.Window name="add-item">
            <CreateMenuItemForm />
          </Modal.Window>
        </Modal>
      </PageHeader>

      <Tabs role="tablist" aria-label="Menu category">
        <Tab
          role="tab"
          aria-selected={categoryId === ""}
          className={categoryId === "" ? "active" : ""}
          onClick={() => handleTab("")}
        >
          All
        </Tab>
        {categories.map((cat) => (
          <Tab
            key={cat.id}
            role="tab"
            aria-selected={categoryId === cat.id}
            className={categoryId === cat.id ? "active" : ""}
            onClick={() => handleTab(cat.id)}
          >
            {cat.name}
          </Tab>
        ))}
      </Tabs>

      <div>
        <MenuTable categoryId={categoryId} />
      </div>

      <div>
        <Heading as="h2">Sections</Heading>
        <p style={{ fontSize: "1.3rem", color: "var(--color-grey-500)", margin: "0.8rem 0 1.6rem" }}>
          Create, rename, hide or reorder sections — and the items inside
          them.
        </p>
        <Modal>
          <Modal.Open opens="sections">
            <Button variation="secondary">
              Open section management
            </Button>
          </Modal.Open>
          <Modal.Window name="sections">
            <SectionsManager defaultCategoryId={categoryId || undefined} />
          </Modal.Window>
        </Modal>
      </div>
    </StyledMenu>
  );
}

export default MenuPage;