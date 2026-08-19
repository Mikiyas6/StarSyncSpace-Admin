import { supabaseUrl } from "../services/supabase";

const imageUrl = `${supabaseUrl}/storage/v1/object/public/cabin-images/`;

const SHARED =
  "The room has its own toilet and bathroom, and a mini-fridge stocked with cookies, bottled water, and soft drinks — free as part of the Day Package, otherwise available as a paid extra. Our restaurant delivers food straight to your door — breakfast, lunch, and dinner (see the menu). Full payment is required at booking and is non-refundable.";
const PACKAGE =
  "Book 4+ hours and get free water and free snacks. Book 10+ hours (or the whole day, 24 hours) and the StarSyncSpace Day Package unlocks: access to the gym, sauna and massage, swimming pool, and free breakfast, lunch, and dinner.";

export const rooms = [
  {
    name: "001",
    maxCapacity: 2,
    regularPrice: 20,
    discount: 0,
    image: imageUrl + "cabin-001.jpg",
    description:
      'A private meeting room for two with a 75-inch smart screen, plug-and-play HDMI, and 500 MB/s Wi-Fi — perfect for a 1:1, a short interview, or a focused work session. ' +
      SHARED +
      " " +
      PACKAGE,
  },
  {
    name: "002",
    maxCapacity: 2,
    regularPrice: 20,
    discount: 3,
    image: imageUrl + "cabin-002.jpg",
    description:
      'A flexible meeting room for two with a 75-inch smart screen, plug-and-play HDMI, and 500 MB/s Wi-Fi — perfect for a 1:1, a short interview, or a focused work session. ' +
      SHARED +
      " " +
      PACKAGE,
  },
  {
    name: "003",
    maxCapacity: 4,
    regularPrice: 35,
    discount: 0,
    image: imageUrl + "cabin-003.jpg",
    description:
      'A relaxed meeting room for four with a 75-inch smart screen, video-conferencing camera, whiteboard wall, and 500 MB/s Wi-Fi — made for team standups, interviews, or client calls. ' +
      SHARED +
      " " +
      PACKAGE,
  },
  {
    name: "004",
    maxCapacity: 4,
    regularPrice: 35,
    discount: 5,
    image: imageUrl + "cabin-004.jpg",
    description:
      'A four-person meeting room with a 75-inch smart screen, video-conferencing camera, whiteboard wall, and 500 MB/s Wi-Fi — made for team standups, interviews, or client calls. ' +
      SHARED +
      " " +
      PACKAGE,
  },
  {
    name: "005",
    maxCapacity: 6,
    regularPrice: 50,
    discount: 0,
    image: imageUrl + "cabin-005.jpg",
    description:
      'A six-person meeting room with two 75-inch smart screens, conference audio, an ergonomic table layout, and 500 MB/s Wi-Fi — comfortable for workshops, reviews, and longer sessions. ' +
      SHARED +
      " " +
      PACKAGE,
  },
  {
    name: "006",
    maxCapacity: 6,
    regularPrice: 50,
    discount: 8,
    image: imageUrl + "cabin-006.jpg",
    description:
      'A six-person meeting room with two 75-inch smart screens, conference audio, an ergonomic table layout, and 500 MB/s Wi-Fi — comfortable for workshops, reviews, and longer sessions. ' +
      SHARED +
      " " +
      PACKAGE,
  },
  {
    name: "007",
    maxCapacity: 8,
    regularPrice: 70,
    discount: 0,
    image: imageUrl + "cabin-007.jpg",
    description:
      'A spacious eight-person room with two 75-inch smart screens, a dedicated conferencing kit, whiteboard wall, and 500 MB/s Wi-Fi — built for design reviews and team workshops. ' +
      SHARED +
      " " +
      PACKAGE,
  },
  {
    name: "008",
    maxCapacity: 10,
    regularPrice: 90,
    discount: 10,
    image: imageUrl + "cabin-008.jpg",
    description:
      'Our largest room, seating ten with a U-shaped layout, three 75-inch smart screens, broadcast-grade audio, and 500 MB/s Wi-Fi — built for offsites, training days, and all-hands. ' +
      SHARED +
      " " +
      PACKAGE,
  },
];