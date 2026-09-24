import { CalendarPlus } from "lucide-react";

import Button from "../../ui/Button";
import { ButtonContent } from "../../ui/Button";
import Modal from "../../ui/Modal";
import CreateBookingForm from "./CreateBookingForm";

function AddBooking() {
  return (
    <Modal>
      <Modal.Open opens="createBooking">
        <Button>
          <ButtonContent>
            <CalendarPlus size={18} /> New booking
          </ButtonContent>
        </Button>
      </Modal.Open>
      <Modal.Window name="createBooking">
        <CreateBookingForm />
      </Modal.Window>
    </Modal>
  );
}

export default AddBooking;
