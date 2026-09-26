import styled from "styled-components";

/* ------------------------------------------------------------------
   The brand lockup, the same one the client site shows.

   The admin used to render `public/logo.png` on its own: the black mark
   with "star sync space" baked into the artwork, scaled to 17rem. The
   client never shows that file. Its navbar, mobile bar and footer all
   build the brand from two parts — the gold mark (`logo-mark.png`) next
   to STAR / SYNC / SPACE set in the display face, gold, teal and ink,
   over a small "3Space · Kigali, Rwanda" line. This is that lockup,
   rebuilt in styled-components, at the size the client's footer uses
   because a sidebar has the room for it.

   See StarSyncSpace-Client/app/_components/{Navbar,Footer,MobileNav}.jsx
   for the originals. The colours are the client's own gold and teal
   values, copied into GlobalStyles; keep the two in step.
   ------------------------------------------------------------------ */

const StyledLogo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

/* The mark is a PNG with transparency, so it needs no background and no
   border — but it does need a box that cannot be squashed by the flex
   row when the sidebar is narrow. */
const Mark = styled.img`
  width: 3.2rem;
  height: 3.2rem;
  flex-shrink: 0;
  object-fit: contain;
`;

const Wordmark = styled.div`
  min-width: 0;
`;

const Name = styled.span`
  display: block;
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.25;
  white-space: nowrap;

  & .star {
    color: var(--color-gold-600);
  }
  & .sync {
    color: var(--color-teal-500);
  }
  /* Ink, so it reads dark on the light theme and light on the dark one,
     exactly as the client's primary-900 does. */
  & .space {
    color: var(--color-grey-900);
  }
`;

const Tagline = styled.span`
  display: block;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  color: var(--color-grey-400);
  white-space: nowrap;
`;

function Logo() {
  return (
    <StyledLogo>
      <Mark
        src={`${import.meta.env.BASE_URL}logo-mark.png`}
        alt="3Space | StarSyncSpace logo"
      />
      <Wordmark>
        <Name>
          <span className="star">STAR</span> <span className="sync">SYNC</span>{" "}
          <span className="space">SPACE</span>
        </Name>
        <Tagline>3Space &middot; Kigali, Rwanda</Tagline>
      </Wordmark>
    </StyledLogo>
  );
}

export default Logo;
