import { Link, NavLink, Route, Routes } from "react-router-dom";
import Notes from "./pages/Notes.jsx";
import Settings from "./pages/Settings.jsx";

const links = [
  { to: "/", label: "Notes", end: true },
  { to: "/settings", label: "Settings" },
];

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <img className="brand-mark" src="/favicon.svg" alt="" /> Noter
        </Link>
        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="nav-link">
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Notes />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  );
}
