// Search for: 'jo', 'fa', 'mar', 'emm', 'ah'
//
// fullName and email only. The guests table has exactly those two
// columns (plus id and created_at); the nationality/countryFlag pairs
// that used to be seeded here did not exist in the database, and since
// PostgREST rejects a whole insert over one unknown column, the Uploader
// could not seed guests at all.

export const guests = [
  {
    // id: 1000,
    fullName: "Jonas Schmedtmann",
    email: "hello@jonas.io",
  },
  {
    fullName: "Jonathan Smith",
    email: "johnsmith@test.eu",
  },
  {
    fullName: "Jonatan Johansson",
    email: "jonatan@example.com",
  },
  {
    fullName: "Jonas Mueller",
    email: "jonas@example.eu",
  },
  {
    fullName: "Jonas Anderson",
    email: "anderson@example.com",
  },
  {
    fullName: "Jonathan Williams",
    email: "jowi@gmail.com",
  },

  // GPT
  {
    fullName: "Emma Watson",
    email: "emma@gmail.com",
  },
  {
    fullName: "Mohammed Ali",
    email: "mohammedali@yahoo.com",
  },
  {
    fullName: "Maria Rodriguez",
    email: "maria@gmail.com",
  },
  {
    fullName: "Li Mei",
    email: "li.mei@hotmail.com",
  },
  {
    fullName: "Khadija Ahmed",
    email: "khadija@gmail.com",
  },
  {
    fullName: "Gabriel Silva",
    email: "gabriel@gmail.com",
  },
  {
    fullName: "Maria Gomez",
    email: "maria@example.com",
  },
  {
    fullName: "Ahmed Hassan",
    email: "ahmed@gmail.com",
  },
  {
    fullName: "John Doe",
    email: "johndoe@gmail.com",
  },
  {
    fullName: "Fatima Ahmed",
    email: "fatima@example.com",
  },
  {
    fullName: "David Smith",
    email: "david@gmail.com",
  },
  {
    fullName: "Marie Dupont",
    email: "marie@gmail.com",
  },
  {
    fullName: "Ramesh Patel",
    email: "ramesh@gmail.com",
  },
  {
    fullName: "Fatimah Al-Sayed",
    email: "fatimah@gmail.com",
  },
  {
    fullName: "Nina Williams",
    email: "nina@hotmail.com",
  },
  {
    fullName: "Taro Tanaka",
    email: "taro@gmail.com",
  },
  {
    fullName: "Abdul Rahman",
    email: "abdul@gmail.com",
  },
  {
    fullName: "Julie Nguyen",
    email: "julie@gmail.com",
  },
  {
    fullName: "Sara Lee",
    email: "sara@gmail.com",
  },
  {
    fullName: "Carlos Gomez",
    email: "carlos@yahoo.com",
  },
  {
    fullName: "Emma Brown",
    email: "emma@gmail.com",
  },
  {
    fullName: "Juan Hernandez",
    email: "juan@yahoo.com",
  },
  {
    fullName: "Ibrahim Ahmed",
    email: "ibrahim@yahoo.com",
  },
  {
    fullName: "Mei Chen",
    email: "mei@gmail.com",
  },
];
