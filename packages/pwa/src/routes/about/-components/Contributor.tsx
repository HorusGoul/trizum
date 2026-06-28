import { AboutLink } from "./AboutLink.js";

interface ContributorProps {
  username: string;
  website?: string;
}

export function Contributor({ username, website }: ContributorProps) {
  const href = website || `https://github.com/${username}`;
  const avatarUrl = `https://github.com/${username}.png`;

  return (
    <AboutLink
      href={href}
      label={
        <div className="flex items-center gap-3">
          <img
            src={avatarUrl}
            alt={`@${username}`}
            className="h-8 w-8 rounded-full"
            loading="lazy"
          />
          <span>@{username}</span>
        </div>
      }
    />
  );
}
