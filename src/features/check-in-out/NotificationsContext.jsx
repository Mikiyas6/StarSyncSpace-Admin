import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import styled from "styled-components";
import { getActiveBookingsEndingSoon } from "../../services/apiBookings";

const TEN_MINUTES = 10 * 60 * 1000;
const POLL_INTERVAL = 30 * 1000;
const HOME_PATH = "/dashboard";

const ToastBox = styled.div`
  display: flex;
  align-items: center;
  gap: 1.2rem;
  min-width: 34rem;
`;

const ToastText = styled.div`
  flex: 1;

  & strong {
    display: block;
    font-size: 1.6rem;
    margin-bottom: 0.2rem;
  }

  & span {
    font-size: 1.3rem;
    color: var(--color-grey-500);
  }
`;

const ToastButton = styled.button`
  background: none;
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-sm);
  color: var(--color-brand-600);
  cursor: pointer;
  font-size: 1.3rem;
  font-family: inherit;
  padding: 0.6rem 1.2rem;

  &:hover {
    background-color: var(--color-brand-50);
  }
`;

function minutesLeft(endTime) {
  return Math.max(
    0,
    Math.floor((new Date(endTime).getTime() - Date.now()) / 60000)
  );
}

const NotificationsContext = createContext();

function NotificationsProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [notifications, setNotifications] = useState([]);
  const timers = useRef(new Set());
  const latestData = useRef([]);
  const toasted = useRef(new Set());

  const { data } = useQuery({
    queryKey: ["room-leaving-notifications"],
    /* Must be wrapped. React Query calls queryFn with a CONTEXT OBJECT
       ({ queryKey, signal, meta }), so passing the function bare handed
       that object to getActiveBookingsEndingSoon's `windowMinutes`
       parameter. object * 60000 is NaN, new Date(NaN).toISOString()
       throws, and the query rejected on every single poll — which is
       why the "10 minutes left" warnings never appeared. */
    queryFn: () => getActiveBookingsEndingSoon(),
    refetchInterval: POLL_INTERVAL,
  });

  useEffect(() => {
    if (!data) return;
    latestData.current = data;
    const now = Date.now();

    for (const booking of data) {
      const remaining = new Date(booking.endTime).getTime() - now;

      if (remaining > TEN_MINUTES) {
        const timer = setTimeout(() => {
          timers.current.delete(timer);
          const fresh = latestData.current.find((b) => b.id === booking.id);
          if (!fresh) return;
          const freshRemaining =
            new Date(fresh.endTime).getTime() - Date.now();
          if (freshRemaining <= TEN_MINUTES && freshRemaining > 0) {
            setNotifications((prev) =>
              prev.some((n) => n.id === fresh.id)
                ? prev
                : [
                    ...prev,
                    {
                      id: fresh.id,
                      roomName: fresh.rooms?.name ?? null,
                      guestName: fresh.guests?.fullName ?? "Guest",
                      endTime: fresh.endTime,
                      seen: false,
                    },
                  ]
            );
          }
        }, remaining - TEN_MINUTES);
        timers.current.add(timer);
      } else if (
        remaining > 0 &&
        !notifications.some((n) => n.id === booking.id)
      ) {
        setNotifications((prev) =>
          prev.some((n) => n.id === booking.id)
            ? prev
            : [
                ...prev,
                {
                  id: booking.id,
                  roomName: booking.rooms?.name ?? null,
                  guestName: booking.guests?.fullName ?? "Guest",
                  endTime: booking.endTime,
                  seen: false,
                },
              ]
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (!notifications.length) return;
    const now = Date.now();
    setNotifications((prev) => {
      const active = new Set(latestData.current.map((b) => b.id));
      const filtered = prev.filter(
        (n) =>
          active.has(n.id) &&
          new Date(n.endTime).getTime() - now > -60 * 1000
      );
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [notifications, data]);

  useEffect(() => {
    const isHome = location.pathname === HOME_PATH;
    if (isHome && notifications.length) {
      for (const n of notifications) {
        if (toasted.current.has(n.id)) continue;
        toasted.current.add(n.id);
        const mins = minutesLeft(n.endTime);
        toast(
          <ToastBox>
            <ToastText>
              <strong>Room {n.roomName ?? "—"} — client must leave soon</strong>
              <span>
                {n.guestName} has{" "}
                {mins === 0 ? "less than a minute" : `${mins} minutes`} left
                before their time in the room is up.
              </span>
            </ToastText>
            <ToastButton onClick={() => navigate(`/bookings/${n.id}`)}>
              View
            </ToastButton>
          </ToastBox>,
          { duration: 10000 }
        );
      }
    }
  }, [notifications, location.pathname, navigate]);

  useEffect(() => {
    const current = timers.current;
    return () => {
      current.forEach((t) => clearTimeout(t));
      current.clear();
    };
  }, []);

  const markAllSeen = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, seen: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.seen).length;

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, markAllSeen }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export { NotificationsContext, NotificationsProvider };