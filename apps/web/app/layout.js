import "./styles.css";

export const metadata = {
  title: "RoomIt",
  description: "Meeting room booking system"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <a className="brand" href="/">RoomIt</a>
          <nav>
            <a href="/">Rooms</a>
            <a href="/bookings">My bookings</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
