import { memo } from "react";
import { useLiveSelector } from "../hooks/useLiveSelector";
import { formatTime } from "../utils/helpers";

export const Footer = memo(function Footer() {
  const lastMessageAt = useLiveSelector((s) => s.stats.lastMessageAt);

  return (
    <footer className="footer">
      <p>
        Technical Assessment — Front-End Developer (React) by Naveed Aslam · Live Monitoring
        Dashboard
      </p>
      <ul className="footer__meta">
        <li>
          Last message{" "}
          {lastMessageAt === null ? "—" : formatTime(lastMessageAt)}
        </li>
      </ul>
    </footer>
  );
});
